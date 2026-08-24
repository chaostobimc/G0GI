// SQLite via sql.js (pure WASM — kein natives Bauen, kein Segfault-Risiko).
// Die Wrapper-API (q.x.run/get/all, insertScanTx) ist bewusst so gehalten,
// wie der Rest des Codes sie erwartet.
//
// Seit v0.5: listings haben einen eigenen Zeitstempel (ts) — dadurch
// funktionieren Zeitfenster-Queries unabhängig von der Datenquelle
// (Bot-Scans ODER hugosmp-market.net-Live-Feed).
"use strict";

const fs = require("fs");
const path = require("path");
const initSqlJs = require("sql.js");
const config = require("./config");

fs.mkdirSync(config.dataDir, { recursive: true });
const DB_FILE = path.join(config.dataDir, "market.db");

let raw = null;   // sql.js Database
let dirty = false;

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS items (
    key         TEXT PRIMARY KEY,
    name_en     TEXT,
    name_de     TEXT,
    custom_name TEXT
  );

  CREATE TABLE IF NOT EXISTS scans (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    market      TEXT NOT NULL,
    source      TEXT NOT NULL DEFAULT 'bot',
    started_at  INTEGER NOT NULL,
    finished_at INTEGER,
    pages       INTEGER DEFAULT 0,
    listings    INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS listings (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    scan_id   INTEGER NOT NULL REFERENCES scans(id),
    market    TEXT NOT NULL,
    item_key  TEXT NOT NULL,
    item_name TEXT,
    price     REAL NOT NULL,
    qty       INTEGER DEFAULT 1,
    seller    TEXT,
    ts        INTEGER,
    extra     TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_listings_scan ON listings(scan_id);
  CREATE INDEX IF NOT EXISTS idx_listings_item ON listings(item_key);
  CREATE INDEX IF NOT EXISTS idx_listings_market_ts ON listings(market, ts);
  CREATE INDEX IF NOT EXISTS idx_scans_market ON scans(market);
`;

/* ---------- sql.js-Helfer ---------- */
function rows(sql, params) {
  const stmt = raw.prepare(sql);
  try {
    const hasParams = params && (Array.isArray(params) ? params.length : Object.keys(params).length);
    if (hasParams) stmt.bind(params);
    const out = [];
    while (stmt.step()) out.push(stmt.getAsObject());
    return out;
  } finally {
    stmt.free();
  }
}

class Stmt {
  constructor(sql) { this.sql = sql; }
  _params(params) {
    if (params.length === 1 && params[0] && typeof params[0] === "object" && !Array.isArray(params[0])) {
      // sql.js will Named-Parameter mit Präfix (@name) sehen
      const obj = {};
      for (const [k, v] of Object.entries(params[0])) {
        obj[/^[@:$]/.test(k) ? k : `@${k}`] = v;
      }
      return obj;
    }
    return params;
  }
  run(...params) {
    raw.run(this.sql, this._params(params));
    dirty = true;
    const r = rows("SELECT last_insert_rowid() AS id, changes() AS c")[0];
    return { lastInsertRowid: r.id, changes: r.c };
  }
  get(...params) {
    return rows(this.sql, this._params(params))[0];
  }
  all(...params) {
    return rows(this.sql, this._params(params));
  }
}

/* ---------- Persistenz ---------- */
function save() {
  if (!dirty || !raw) return;
  try {
    fs.writeFileSync(DB_FILE, Buffer.from(raw.export()));
    dirty = false;
  } catch (e) {
    console.error("[db] Speichern fehlgeschlagen:", e.message);
  }
}
setInterval(save, 15_000);
process.on("exit", save);
process.on("SIGINT", () => { save(); });

/* ---------- Queries (werden nach init() befüllt) ---------- */
const q = {};

function buildQueries() {
  Object.assign(q, {
    upsertItem: new Stmt(`
      INSERT INTO items (key, name_en, name_de, custom_name)
      VALUES (@key, @name_en, @name_de, @custom_name)
      ON CONFLICT(key) DO UPDATE SET
        name_en = COALESCE(excluded.name_en, items.name_en),
        name_de = COALESCE(excluded.name_de, items.name_de),
        custom_name = COALESCE(excluded.custom_name, items.custom_name)
    `),

    startScan: new Stmt(`INSERT INTO scans (market, source, started_at) VALUES (?, ?, ?)`),
    finishScan: new Stmt(`UPDATE scans SET finished_at = ?, pages = ?, listings = ? WHERE id = ?`),

    insertListing: new Stmt(`
      INSERT INTO listings (scan_id, market, item_key, item_name, price, qty, seller, ts, extra)
      VALUES (@scan_id, @market, @item_key, @item_name, @price, @qty, @seller, @ts, @extra)
    `),

    watermark: new Stmt(`SELECT COALESCE(MAX(ts), 0) AS w FROM listings WHERE market = ?`),
    latestScan: new Stmt(`SELECT * FROM scans WHERE market LIKE ? ORDER BY id DESC LIMIT 1`),
    lastRealScan: new Stmt(`SELECT * FROM scans WHERE source IN ('bot', 'site') ORDER BY id DESC LIMIT 1`),
    recentScans: new Stmt(`SELECT * FROM scans ORDER BY id DESC LIMIT ?`),

    searchAh: new Stmt(`
      SELECT l.item_key AS key,
             MIN(l.price) AS best_price,
             COUNT(*) AS offer_count,
             SUM(l.qty) AS total_qty
      FROM listings l
      WHERE l.market = ? AND l.ts >= ?
      GROUP BY l.item_key
    `),

    searchOrders: new Stmt(`
      SELECT l.item_key AS key,
             MAX(l.price) AS best_price,
             COUNT(*) AS offer_count,
             SUM(l.qty) AS total_qty
      FROM listings l
      WHERE l.market = ? AND l.ts >= ?
      GROUP BY l.item_key
    `),

    currentListings: new Stmt(`
      SELECT l.*
      FROM listings l
      WHERE l.item_key = ? AND l.market = ? AND l.ts >= ?
      ORDER BY l.price ASC
      LIMIT 60
    `),

    history: new Stmt(`
      SELECT (l.ts / ?) * ? AS ts,
             MIN(l.price) AS min_price,
             ROUND(AVG(l.price), 2) AS avg_price,
             COUNT(*) AS n
      FROM listings l
      WHERE l.item_key = ? AND l.market = ? AND l.ts >= ?
      GROUP BY (l.ts / ?)
      ORDER BY ts ASC
    `),

    countRealListings: new Stmt(`SELECT COUNT(*) AS n FROM listings WHERE market IN ('ah', 'orders')`),
    countItems: new Stmt(`SELECT COUNT(*) AS n FROM items`),
  });
}

/* ---------- Transaktion: ein Scan = ein Schreibvorgang ---------- */
function insertScanTx(market, listings, source = "bot") {
  raw.run("BEGIN");
  try {
    const startedAt = Date.now();
    const info = q.startScan.run(market, source, startedAt);
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
        ts: l.ts || startedAt,
        extra: l.extra ? JSON.stringify(l.extra) : null,
      });
      pages = Math.max(pages, l.page || 0);
    }
    q.finishScan.run(Date.now(), pages, listings.length, scanId);
    raw.run("COMMIT");
    dirty = true;
    return scanId;
  } catch (e) {
    try { raw.run("ROLLBACK"); } catch {}
    throw e;
  }
}

/* ---------- Initialisierung (asynchron wegen WASM-Load) ---------- */
async function init() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_FILE)) {
    try {
      raw = new SQL.Database(fs.readFileSync(DB_FILE));
      // alte better-sqlite3-DBs oder alte Schemata → frisch anlegen
      const cols = rows("PRAGMA table_info(listings)").map((c) => c.name);
      if (cols.length && !cols.includes("ts")) {
        console.log("[db] altes Schema erkannt — lege neue DB an.");
        raw = new SQL.Database();
      }
    } catch {
      console.log("[db] vorhandene DB nicht lesbar — lege neue an.");
      raw = new SQL.Database();
    }
  }
  if (!raw) raw = new SQL.Database();

  raw.run(SCHEMA);
  buildQueries();
  console.log(`[db] bereit (${DB_FILE})`);
  return module.exports;
}

// db.db-Kompat (seed.js nutzt db.db.prepare/exec)
const dbShim = {
  prepare: (sql) => new Stmt(sql),
  exec: (sql) => { raw.run(sql); dirty = true; },
};

module.exports = { init, q, insertScanTx, save, db: dbShim };
