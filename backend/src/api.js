// Express-API + statische Auslieferung der Website + Item-Icons.
// Alle Preis-Queries laufen über Zeitfenster (searchWindowMin), dadurch
// funktionieren Bot-Scans UND Site-Live-Feed mit derselben Logik.
"use strict";

const fs = require("fs");
const path = require("path");
const express = require("express");
const config = require("./config");
const db = require("./db");
const names = require("./names");
const bot = require("./bot");

const app = express();
const repoRoot = path.join(__dirname, "..", "..");

// Icon-Quellen: erst 1.21.11, Fallback älter
const ICON_DIRS = ["1.21.11", "1.21.1", "1.21.4", "1.20.2"].map(
  (v) => path.join(repoRoot, "backend", "node_modules", "minecraft-assets", "minecraft-assets", "data", v, "items")
);

/* ---------- Sicherheitskram ---------- */
app.use((req, res, next) => {
  // .env, node_modules und data/ niemals ausliefern
  if (/^\/(backend(\/|$)|\.env|\.git)/.test(req.path)) {
    return res.status(404).send("nicht gefunden");
  }
  next();
});

/* ---------- Such-Helfer (DE + EN, inkl. Verzauberungs-Varianten) ---------- */
function itemSearchText(key) {
  const n = names.getNames(key);
  const raw = String(key)
    .replace(/^minecraft:/, "")
    .replace(/[/:+]/g, " ")
    .replace(/_/g, " ");
  return [n.en, n.de, raw].filter(Boolean).join(" ").toLowerCase();
}

const windowMs = () => config.searchWindowMin * 60_000;

/* ---------- Routen ---------- */

app.get("/api/status", (req, res) => {
  const lastAh = db.q.latestScan.get("ah") || db.q.latestScan.get("demo-ah");
  const lastOrders = db.q.latestScan.get("orders") || db.q.latestScan.get("demo-orders");
  const real = db.q.lastRealScan.get();
  res.json({
    source: config.dataSource,
    bot: {
      status: config.dataSource === "bot" ? bot.state.status : "deaktiviert (Site-Modus)",
      lastError: bot.state.lastError,
      username: config.username,
      server: `${config.host}:${config.port}`,
      version: config.version,
    },
    demo: !real,
    scans: { ah: lastAh || null, orders: lastOrders || null, lastReal: real || null },
    itemsKnown: db.q.countItems.get().n,
    searchWindowMin: config.searchWindowMin,
  });
});

// Artikelsuche: q trifft auf deutsche UND englische Namen + Varianten
app.get("/api/items", (req, res) => {
  const q = (req.query.q || "").toLowerCase().trim();
  const market = req.query.market === "orders" ? "orders" : req.query.market === "ah" ? "ah" : "all";
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
  const since = Date.now() - windowMs();

  // Demo-Fallback, solange keine echten Daten da sind
  const hasReal = db.q.countRealListings.get().n > 0;
  const ahMarket = hasReal ? "ah" : "demo-ah";
  const orMarket = hasReal ? "orders" : "demo-orders";

  const rowsAh = market !== "orders" ? db.q.searchAh.all(ahMarket, since) : [];
  const rowsOr = market !== "ah" ? db.q.searchOrders.all(orMarket, since) : [];

  const byKey = new Map();
  for (const r of rowsAh) {
    const n = names.getNames(r.key);
    byKey.set(r.key, { key: r.key, en: n.en, de: n.de, ah: { best: r.best_price, count: r.offer_count, qty: r.total_qty } });
  }
  for (const r of rowsOr) {
    const n = names.getNames(r.key);
    const e = byKey.get(r.key) || { key: r.key, en: n.en, de: n.de, ah: null };
    e.orders = { best: r.best_price, count: r.offer_count, qty: r.total_qty };
    byKey.set(r.key, e);
  }

  let items = [...byKey.values()];
  if (q) {
    const terms = q.split(/\s+/);
    items = items.filter((it) => {
      const hay = itemSearchText(it.key);
      return terms.every((t) => hay.includes(t));
    });
  }

  items.sort((a, b) => (a.de || a.en || "").localeCompare(b.de || b.en || "", "de"));
  res.json({ demo: !hasReal, source: config.dataSource, total: items.length, items: items.slice(0, limit) });
});

// aktuelle Listings eines Items (Zeitfenster)
app.get("/api/item/:key", (req, res) => {
  const key = decodeURIComponent(req.params.key);
  const since = Date.now() - windowMs();
  const hasReal = db.q.countRealListings.get().n > 0;
  const out = { key, names: names.getNames(key), markets: {} };
  out.markets.ah = db.q.currentListings.all(key, hasReal ? "ah" : "demo-ah", since);
  out.markets.orders = db.q.currentListings.all(key, hasReal ? "orders" : "demo-orders", since);
  res.json(out);
});

// Preisverlauf für den Graphen (Zeitkörbe)
app.get("/api/item/:key/history", (req, res) => {
  const key = decodeURIComponent(req.params.key);
  const days = Math.min(parseInt(req.query.days, 10) || 14, 60);
  const since = Date.now() - days * 24 * 3600 * 1000;
  const bucket = config.historyBucketMin * 60_000;
  const hasReal = db.q.countRealListings.get().n > 0;

  const out = { key, days, series: {} };
  for (const m of ["ah", "orders"]) {
    const market = hasReal ? m : `demo-${m}`;
    out.series[m] = db.q.history.all(bucket, bucket, key, market, since, bucket);
  }
  out.demo = !hasReal;
  res.json(out);
});

app.get("/api/scans", (req, res) => {
  res.json(db.q.recentScans.all(parseInt(req.query.limit, 10) || 20));
});

/* ---------- Item-Icons (Varianten → Basis-Item) ---------- */
app.get("/icons/:name.png", (req, res) => {
  const id = names.keyBase(decodeURIComponent(req.params.name));
  for (const dir of ICON_DIRS) {
    const file = path.join(dir, `${id}.png`);
    if (fs.existsSync(file)) {
      res.setHeader("Cache-Control", "public, max-age=86400");
      return res.sendFile(file);
    }
  }
  res.setHeader("Content-Type", "image/png");
  res.send(Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    "base64"
  ));
});

/* ---------- Website ---------- */
app.use(express.static(repoRoot, { extensions: ["html"] }));

function start() {
  app.listen(config.apiPort, "0.0.0.0", () => {
    console.log(`[api] läuft auf http://0.0.0.0:${config.apiPort} · market.html für den Market-Tab`);
  });
}

module.exports = { start };
