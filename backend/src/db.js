// SQLite-Schema und alle Queries an einer Stelle.
"use strict";

const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const config = require("./config");

fs.mkdirSync(config.dataDir, { recursive: true });

const db = new Database(path.join(config.dataDir, "market.db"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    key         TEXT PRIMARY KEY,   -- z. B. minecraft:diamond_sword oder custom:xyz
    name_en     TEXT,
    name_de     TEXT,
    custom_name TEXT                -- falls der Server das Item umbenennt hat
  );

  CREATE TABLE IF NOT EXISTS scans (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    market      TEXT NOT NULL,      -- ah | orders | demo-ah | demo-orders
    started_at  INTEGER NOT NULL,
    finished_at INTEGER,
    pages       INTEGER DEFAULT 0,
    listings    INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS listings (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    scan_id   INTEGER NOT NULL REFERENCES scans(id),
    market    TEXT NOT NULL,        -- ah | orders | demo-*
    item_key  TEXT NOT NULL,
    item_name TEXT,                 -- Anzeige-Name aus dem GUI
    price     REAL NOT NULL,        -- Auktionen: Gesamtpreis · Orders: Stückpreis
    qty       INTEGER DEFAULT 1,
    seller    TEXT,
    extra     TEXT                  -- rohe Lore als JSON, falls gebraucht
  );

  CREATE INDEX IF NOT EXISTS idx_listings_scan ON listings(scan_id);
  CREATE INDEX IF NOT EXISTS idx_listings_item ON listings(item_key);
  CREATE INDEX IF NOT EXISTS idx_scans_market ON scans(market);
`);

/* ---------- vorbereitet ---------- */
const q = {
  upsertItem: db.prepare(`
    INSERT INTO items (key, name_en, name_de, custom_name)
    VALUES (@key, @name_en, @name_de, @custom_name)
    ON CONFLICT(key) DO UPDATE SET
      name_en = COALESCE(excluded.name_en, items.name_en),
      name_de = COALESCE(excluded.name_de, items.name_de),
      custom_name = COALESCE(excluded.custom_name, items.custom_name)
  `),

  startScan: db.prepare(`INSERT INTO scans (market, started_at) VALUES (?, ?)`),
  finishScan: db.prepare(`
    UPDATE scans SET finished_at = ?, pages = ?, listings = ? WHERE id = ?
  `),

  insertListing: db.prepare(`
    INSERT INTO listings (scan_id, market, item_key, item_name, price, qty, seller, extra)
    VALUES (@scan_id, @market, @item_key, @item_name, @price, @qty, @seller, @extra)
  `),

  latestScan: db.prepare(`
    SELECT * FROM scans WHERE market LIKE ? ORDER BY id DESC LIMIT 1
  `),

  lastRealScan: db.prepare(`
    SELECT * FROM scans WHERE market IN ('ah', 'orders') ORDER BY id DESC LIMIT 1
  `),

  recentScans: db.prepare(`
    SELECT * FROM scans ORDER BY id DESC LIMIT ?
  `),

  // aktuelle Bestpreise je Item (Auktionen = günstigster Gesamtpreis)
  searchAh: db.prepare(`
    SELECT l.item_key AS key,
           i.name_en, i.name_de,
           MIN(l.price) AS best_price,
           COUNT(*) AS offer_count,
           SUM(l.qty) AS total_qty
    FROM listings l
    LEFT JOIN items i ON i.key = l.item_key
    WHERE l.scan_id = (SELECT MAX(id) FROM scans WHERE market = ?)
      AND l.market = ?
    GROUP BY l.item_key
  `),

  // aktuelle Bestpreise je Item (Orders = höchster Stückpreis = bestes Gebot)
  searchOrders: db.prepare(`
    SELECT l.item_key AS key,
           i.name_en, i.name_de,
           MAX(l.price) AS best_price,
           COUNT(*) AS offer_count,
           SUM(l.qty) AS total_qty
    FROM listings l
    LEFT JOIN items i ON i.key = l.item_key
    WHERE l.scan_id = (SELECT MAX(id) FROM scans WHERE market = ?)
      AND l.market = ?
    GROUP BY l.item_key
  `),

  currentListings: db.prepare(`
    SELECT l.*, s.finished_at AS ts
    FROM listings l
    JOIN scans s ON s.id = l.scan_id
    WHERE l.item_key = ? AND l.market = ?
      AND l.scan_id = (SELECT MAX(id) FROM scans WHERE market = ?)
    ORDER BY l.price ASC
  `),

  history: db.prepare(`
    SELECT s.finished_at AS ts,
           MIN(l.price) AS min_price,
           ROUND(AVG(l.price), 2) AS avg_price,
           COUNT(*) AS n
    FROM listings l
    JOIN scans s ON s.id = l.scan_id
    WHERE l.item_key = ? AND l.market = ?
      AND s.finished_at IS NOT NULL
      AND s.finished_at >= ?
    GROUP BY s.id
    ORDER BY s.id ASC
  `),

  countRealListings: db.prepare(`
    SELECT COUNT(*) AS n FROM listings WHERE market IN ('ah', 'orders')
  `),

  countItems: db.prepare(`SELECT COUNT(*) AS n FROM items`),
};

/* ---------- Scan-Transaktion: ein Scan = ein Atom-Schreibvorgang ---------- */
const insertScanTx = db.transaction((market, listings) => {
  const startedAt = Date.now();
  const info = q.startScan.run(market, startedAt);
  const scanId = info.lastInsertRowid;
  let pages = 0;
  for (const l of listings) {
    q.insertListing.run({
      scan_id: scanId,
      market,
      item_key: l.key,
      item_name: l.name || null,
      price: l.price,
      qty: l.qty || 1,
      seller: l.seller || null,
      extra: l.extra ? JSON.stringify(l.extra) : null,
    });
    pages = Math.max(pages, l.page || 0);
  }
  q.finishScan.run(Date.now(), pages, listings.length, scanId);
  return scanId;
});

module.exports = { db, q, insertScanTx };
