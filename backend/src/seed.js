// Demo-Preisdaten für Frontend-Tests, bevor der Bot echte Scans liefert.
// Klar als "demo-*" markiert, damit sie nie mit echten Daten verwechselt werden.
"use strict";

const db = require("./db");
const { getNames } = require("./names");

// Basis-Preise (fiktiv) + Schwankung
const DEMO_ITEMS = [
  ["minecraft:diamond", 900],
  ["minecraft:netherite_ingot", 8500],
  ["minecraft:netherite_scrap", 2100],
  ["minecraft:elytra", 15000],
  ["minecraft:totem_of_undying", 3500],
  ["minecraft:enchanted_golden_apple", 6000],
  ["minecraft:nether_star", 7000],
  ["minecraft:shulker_shell", 1200],
  ["minecraft:diamond_sword", 1500],
  ["minecraft:diamond_pickaxe", 1800],
  ["minecraft:netherite_pickaxe", 12000],
  ["minecraft:golden_carrot", 35],
  ["minecraft:cooked_beef", 8],
  ["minecraft:bread", 3],
  ["minecraft:ender_pearl", 120],
  ["minecraft:blaze_rod", 90],
  ["minecraft:slime_ball", 45],
  ["minecraft:experience_bottle", 60],
  ["minecraft:lapis_lazuli", 25],
  ["minecraft:emerald", 150],
  ["minecraft:quartz", 30],
  ["minecraft:amethyst_shard", 40],
  ["minecraft:shulker_box", 2200],
  ["minecraft:beacon", 20000],
  ["minecraft:trident", 4500],
  ["minecraft:saddle", 400],
  ["minecraft:name_tag", 250],
  ["minecraft:spawner", 30000],
  ["minecraft:oak_log", 2],
  ["minecraft:stone", 1],
];

// deterministischer Zufall, damit Demo-Daten stabil aussehen
let seedState = 42;
function rnd() {
  seedState = (seedState * 1103515245 + 12345) & 0x7fffffff;
  return seedState / 0x7fffffff;
}

function seedDemo() {
  const { q, insertScanTx } = db;
  const realCount = q.countRealListings.get().n;
  const existing = db.db.prepare(
    "SELECT COUNT(*) AS n FROM scans WHERE market LIKE 'demo-%'"
  ).get().n;

  if (realCount > 0 || existing > 0) {
    console.log("[seed] Demo-Daten übersprungen (echte oder vorhandene Daten da).");
    return false;
  }

  console.log("[seed] Erzeuge Demo-Preisdaten …");

  // 7 Tage Historie, 4 Scans pro Tag
  const now = Date.now();
  const days = 7;
  const perDay = 4;
  const stepMs = (24 * 3600 * 1000) / perDay;

  // Preis-Pfade je Item vorbereiten
  const paths = {};
  for (const [key, base] of DEMO_ITEMS) {
    let p = base * (0.8 + rnd() * 0.4);
    const arr = [];
    for (let i = 0; i < days * perDay; i++) {
      p = Math.max(base * 0.4, p * (0.94 + rnd() * 0.14));
      arr.push(Math.round(p));
    }
    paths[key] = arr;
  }

  for (let t = 0; t < days * perDay; t++) {
    const ts = now - (days * perDay - 1 - t) * stepMs;

    for (const market of ["demo-ah", "demo-orders"]) {
      const listings = [];
      for (const [key] of DEMO_ITEMS) {
        const base = paths[key][t];
        // ein paar Angebote pro Item
        const offers = 1 + Math.floor(rnd() * 3);
        for (let o = 0; o < offers; o++) {
          const jitter = 0.9 + rnd() * 0.25;
          const price = Math.max(1, Math.round(base * jitter));
          const names = getNames(key);
          listings.push({
            key,
            name: names.en || key,
            price,
            qty: market === "demo-ah" ? 1 + Math.floor(rnd() * 8) : 8 + Math.floor(rnd() * 56),
            seller: null,
            page: 1,
            ts,
          });
        }
      }
      // Zeitstempel des Scans setzen wir über einen kleinen Umweg
      const scanId = insertScanTx(market, listings, "seed");
      db.db.prepare("UPDATE scans SET started_at=?, finished_at=? WHERE id=?").run(ts, ts, scanId);
    }
  }

  console.log(`[seed] fertig: ${DEMO_ITEMS.length} Items × ${days} Tage.`);
  return true;
}

module.exports = { seedDemo };
