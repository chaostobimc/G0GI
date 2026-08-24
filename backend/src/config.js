// Konfiguration aus .env — mit sinnvollen Defaults für HugoSMP.
"use strict";

require("dotenv").config();

const bool = (v, def = false) =>
  v === undefined ? def : !["0", "false", "no", "off"].includes(String(v).toLowerCase());

const int = (v, def) => {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? def : n;
};

module.exports = {
  // Server
  host: process.env.MC_HOST || "hugosmp.net",
  port: int(process.env.MC_PORT, 25565),
  version: process.env.MC_VERSION || "1.21.11",

  // Account
  auth: (process.env.AUTH || "offline").toLowerCase(), // offline | microsoft
  username: process.env.USERNAME || "G0GI_Market",

  // Regeln
  rulesCommand: process.env.RULES_COMMAND || "/rules",

  // Scraper
  ahCommand: process.env.AH_COMMAND || "/ah",
  orderCommand: process.env.ORDER_COMMAND || "/order",
  scanIntervalMin: int(process.env.SCAN_INTERVAL_MIN, 30),
  pageDelayMs: int(process.env.PAGE_DELAY_MS, 250),
  maxPages: int(process.env.MAX_PAGES, 200),

  // Bot-Verhalten
  antiAfk: bool(process.env.ANTI_AFK, true),
  scraperDebug: bool(process.env.SCRAPER_DEBUG, false),

  // API
  apiPort: int(process.env.API_PORT, 8080),
  seedDemoData: bool(process.env.SEED_DEMO_DATA, true),

  // Pfade
  dataDir: require("path").join(__dirname, "..", "data"),
};
