// Einstieg: DB vorbereiten, Bot starten (außer DISABLE_BOT=true),
// Scan-Loop legen, API hochfahren.
"use strict";

// Node-Versionscheck VOR allen nativen Requires — better-sqlite3@13 und
// mineflayer@4.37 brauchen Node >= 22. Auf älteren Nodes gäbe es sonst
// kryptische Segfaults statt einer klaren Meldung.
const NODE_MAJOR = parseInt(process.versions.node.split(".")[0], 10);
if (NODE_MAJOR < 22) {
  console.error("╔══════════════════════════════════════════════════════════╗");
  console.error("║  G0GI Market braucht Node.js >= 22, du hast " + process.versions.node.padEnd(10) + "  ║");
  console.error("║                                                            ║");
  console.error("║  Fix:  nvm install 22 && nvm use 22                        ║");
  console.error("║        danach: rm -rf node_modules && npm install          ║");
  console.error("╚══════════════════════════════════════════════════════════╝");
  process.exit(1);
}

const config = require("./config");
const db = require("./db");
const bot = require("./bot");
const scraper = require("./scraper");
const { seedDemo } = require("./seed");
const api = require("./api");

const DISABLE_BOT = ["1", "true", "yes"].includes(String(process.env.DISABLE_BOT).toLowerCase());

async function main() {
  console.log("🍒 G0GI Market-Backend startet");
  console.log(`   Server: ${config.host}:${config.port} (${config.version}) · Bot-User: ${config.username}`);

  if (config.seedDemoData) seedDemo();

  api.start();

  if (DISABLE_BOT) {
    console.log("[bot] DISABLE_BOT=true — Bot wird nicht gestartet (nur API/Demo-Modus).");
    return;
  }

  let botRef = null;
  let scanning = false;

  const connect = () => {
    botRef = bot.createBot();

    botRef.once("spawn", async () => {
      // ersten Scan kurz nach dem Spawn anstoßen
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
        if (scanning || bot.state.status === "scanning") return;
        scanning = true;
        try {
          await scraper.runFullScan(botRef, db);
        } catch (e) {
          console.error("[scan] Fehler:", e.message);
        } finally {
          scanning = false;
        }
      }, config.scanIntervalMin * 60 * 1000);
    });

    // Reconnect mit Backoff, falls die Verbindung weg ist
    botRef.on("end", () => {
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
