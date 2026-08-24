// Express-API + statische Auslieferung der Website + Item-Icons.
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

// Icon-Quellen: erst 1.21.11, Fallback 1.21.1
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

/* ---------- Name-Index für die Suche (DE + EN) ---------- */
const indexByKey = new Map();
const searchIndex = names.buildIndex();
for (const e of searchIndex) indexByKey.set(e.key, e);

function itemSearchText(key) {
  const idx = indexByKey.get(key);
  if (idx) return idx.hay;
  return key.toLowerCase().replace(/_/g, " ");
}

// ah|orders → echtes Markt-Kürzel oder Demo-Fallback
function marketKey(market) {
  const real = db.q.latestScan.get(market);
  if (real) return { market, demo: false };
  const demo = db.q.latestScan.get(`demo-${market}`);
  if (demo) return { market: `demo-${market}`, demo: true };
  return null;
}

/* ---------- Routen ---------- */

app.get("/api/status", (req, res) => {
  const real = db.q.lastRealScan.get();
  const lastAh = db.q.latestScan.get("ah") || db.q.latestScan.get("demo-ah");
  const lastOrders = db.q.latestScan.get("orders") || db.q.latestScan.get("demo-orders");
  res.json({
    bot: {
      status: bot.state.status,
      lastError: bot.state.lastError,
      joinedAt: bot.state.joinedAt,
      username: config.username,
      server: `${config.host}:${config.port}`,
      version: config.version,
    },
    demo: !real,
    scans: {
      ah: lastAh || null,
      orders: lastOrders || null,
      lastReal: real || null,
    },
    itemsKnown: db.q.countItems.get().n,
  });
});

// Artikelsuche: q trifft auf deutsche UND englische Namen + IDs
app.get("/api/items", (req, res) => {
  const q = (req.query.q || "").toLowerCase().trim();
  const market = req.query.market === "orders" ? "orders" : req.query.market === "ah" ? "ah" : "all";
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);

  const mkAh = market !== "orders" ? marketKey("ah") : null;
  const mkOr = market !== "ah" ? marketKey("orders") : null;

  const rowsAh = mkAh ? db.q.searchAh.all(mkAh.market, mkAh.market) : [];
  const rowsOr = mkOr ? db.q.searchOrders.all(mkOr.market, mkOr.market) : [];

  const byKey = new Map();
  for (const r of rowsAh) {
    byKey.set(r.key, {
      key: r.key,
      en: r.name_en || indexByKey.get(r.key)?.en || r.key,
      de: r.name_de || indexByKey.get(r.key)?.de || null,
      ah: { best: r.best_price, count: r.offer_count, qty: r.total_qty },
    });
  }
  for (const r of rowsOr) {
    const e = byKey.get(r.key) || {
      key: r.key,
      en: r.name_en || indexByKey.get(r.key)?.en || r.key,
      de: r.name_de || indexByKey.get(r.key)?.de || null,
      ah: null,
    };
    e.orders = { best: r.best_price, count: r.offer_count, qty: r.total_qty };
    byKey.set(r.key, e);
  }

  let items = [...byKey.values()];
  if (q) {
    const terms = q.split(/\s+/);
    items = items.filter((it) => {
      const hay = itemSearchText(it.key) + " " + (it.de || "") + " " + (it.en || "");
      return terms.every((t) => hay.includes(t));
    });
  }

  items.sort((a, b) => (a.de || a.en || "").localeCompare(b.de || b.en || "", "de"));
  res.json({
    demo: !db.q.lastRealScan.get(),
    total: items.length,
    items: items.slice(0, limit),
  });
});

// aktuelle Listings eines Items
app.get("/api/item/:key", (req, res) => {
  const key = decodeURIComponent(req.params.key);
  const out = { key, names: names.getNames(key), markets: {} };

  for (const m of ["ah", "orders"]) {
    const mk = marketKey(m);
    if (!mk) continue;
    out.markets[m] = db.q.currentListings.all(key, mk.market, mk.market);
  }
  res.json(out);
});

// Preisverlauf für den Graphen
app.get("/api/item/:key/history", (req, res) => {
  const key = decodeURIComponent(req.params.key);
  const days = Math.min(parseInt(req.query.days, 10) || 14, 60);
  const since = Date.now() - days * 24 * 3600 * 1000;

  const out = { key, days, series: {} };
  for (const m of ["ah", "orders"]) {
    const mk = marketKey(m);
    if (!mk) { out.series[m] = []; continue; }
    out.series[m] = db.q.history.all(key, mk.market, since);
    out.demoMarket = mk.demo;
  }
  res.json(out);
});

app.get("/api/scans", (req, res) => {
  res.json(db.q.recentScans.all(parseInt(req.query.limit, 10) || 20));
});

/* ---------- Item-Icons ---------- */
app.get("/icons/:name.png", (req, res) => {
  const id = names.normalizeId(req.params.name);
  for (const dir of ICON_DIRS) {
    const file = path.join(dir, `${id}.png`);
    if (fs.existsSync(file)) {
      res.setHeader("Cache-Control", "public, max-age=86400");
      return res.sendFile(file);
    }
  }
  // Fallback: 1x1 transparent
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
