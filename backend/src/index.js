// Einstieg: DB vorbereiten, Bot starten (außer DISABLE_BOT=true),
// Scan-Loop legen, API hochfahren.
"use strict";

// Node-Versionscheck: der Mineflayer-Bot braucht Node >= 22.
// Der Site-Modus (Datenquelle hugosmp-market.net) läuft auch auf älteren
// Nodes — da gibt es nur eine Warnung.
const NODE_MAJOR = parseInt(process.versions.node.split(".")[0], 10);
const SITE_MODE = (process.env.DATA_SOURCE || "site").toLowerCase() === "site";
if (NODE_MAJOR < 22 && !SITE_MODE) {
  console.error("╔══════════════════════════════════════════════════════════╗");
  console.error("║  Der Bot-Modus braucht Node.js >= 22, du hast " + process.versions.node.padEnd(10) + "  ║");
  console.error("║  Fix:  nvm install 22 && nvm use 22                        ║");
  console.error("║  (oder DATA_SOURCE=site nutzen, läuft auch ohne)         ║");
  console.error("╚══════════════════════════════════════════════════════════╝");
  process.exit(1);
}
if (NODE_MAJOR < 22) console.warn(`[warn] Node ${process.versions.node} — Site-Modus ok, Bot-Modus bräuchte Node 22.`);

const config = require("./config");
const db = require("./db");
const bot = require("./bot");
const scraper = require("./scraper");
const marketSite = require("./marketSite");
const { seedDemo } = require("./seed");
const api = require("./api");

const DISABLE_BOT = ["1", "true", "yes"].includes(String(process.env.DISABLE_BOT).toLowerCase());

async function main() {
  console.log("🍒 G0GI Market-Backend startet");
  console.log(`   Server: ${config.host}:${config.port} (${config.version}) · Bot-User: ${config.username}`);

  await db.init(); // sql.js/WASM laden, Schema sicherstellen

  if (config.seedDemoData) seedDemo();

  api.start();

  /* ---------- Datenquelle 1: hugosmp-market.net (Standard) ---------- */
  if (config.dataSource === "site") {
    console.log(`[site] Datenquelle: ${config.marketSiteUrl}`);
    console.log(`[site] Delta-Scan alle ${config.scanIntervalMin} min (kein Voll-Crawl).`);
    const scan = async () => {
      try {
        await marketSite.runSiteScan();
      } catch (e) {
        console.error("[site] Fehler:", e.message);
      }
    };
    setTimeout(scan, 3_000);
    setInterval(scan, config.scanIntervalMin * 60_000);
    return;
  }

  /* ---------- Datenquelle 2: eigener Mineflayer-Bot ---------- */
  if (DISABLE_BOT) {
    console.log("[bot] DISABLE_BOT=true — Bot wird nicht gestartet (nur API/Demo-Modus).");
    return;
  }

  let botRef = null;
  let scanning = false;
  let scansScheduled = false;

  const scheduleScans = () => {
    if (scansScheduled) return;
    scansScheduled = true;

    // erster Scan 15 s nach Login — auch wenn der Spawn (Limbo) noch aussteht,
    // GUIs funktionieren auf dem Server dann meist schon
    setTimeout(async () => {
      if (scanning) return;
      scanning = true;
      try {
        await scraper.runFullScan(botRef, db);
      } catch (e) {
        console.error("[scan] Fehler:", e.message);
      } finally {
        scanning = false;
      }
    }, 15_000);

    // danach regelmäßig
    setInterval(async () => {
      if (scanning) return;
      scanning = true;
      try {
        await scraper.runFullScan(botRef, db);
      } catch (e) {
        console.error("[scan] Fehler:", e.message);
      } finally {
        scanning = false;
      }
    }, config.scanIntervalMin * 60 * 1000);
  };

  const connect = () => {
    botRef = bot.createBot();

    // Scans an den LOGIN koppeln, nicht an den Spawn (Limbo-Server!)
    botRef.once("login", scheduleScans);

    // Reconnect mit Backoff, falls die Verbindung weg ist
    botRef.on("end", () => {
      scansScheduled = false;
      setTimeout(() => {
        console.log("[bot] Reconnect …");
        connect();
      }, 15_000);
    });
  };

  connect();
}

process.on("SIGINT", () => {
  console.log("\n🍒 Beende …");
  try { bot.state.bot && bot.state.bot.quit(); } catch {}
  process.exit(0);
});

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
