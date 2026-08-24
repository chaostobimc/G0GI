// Einstieg: DB vorbereiten, Bot starten (außer DISABLE_BOT=true),
// Scan-Loop legen, API hochfahren.
"use strict";

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
