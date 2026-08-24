// Scan-Engine: öffnet /ah bzw. /order, liest alle Seiten aus und klickt
// sich so schnell wie möglich durch die Seiten.
//
// Tempo: Nach jedem Klick wird nur darauf gewartet, dass sich das Fenster
// tatsächlich geändert hat (neues Fenster oder Slot-Update) — keine festen
// Wartezeiten pro Seite außer PAGE_DELAY_MS als kleine Atempause für den Server.
"use strict";

const fs = require("fs");
const path = require("path");
const config = require("./config");
const parsers = require("./parsers");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function slotsHash(window) {
  // kompakter Hash über die GUI-Slots (ohne Spieler-Inventar am Ende)
  const guiSlots = window.slots.slice(0, Math.max(0, window.slots.length - 36));
  return guiSlots
    .map((s) => (s && s.name ? `${s.name}:${s.count}:${s.metadata || 0}` : "_"))
    .join("|");
}

// Warten, bis sich das Fenster nach einem Klick ändert (oder Timeout)
function waitForWindowChange(bot, oldWindow, oldHash, timeoutMs = 3000) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (val) => {
      if (done) return;
      done = true;
      bot.removeListener("windowOpen", onOpen);
      clearTimeout(timer);
      resolve(val);
    };
    const onOpen = (win) => finish(win);
    const timer = setTimeout(() => finish(bot.currentWindow), timeoutMs);
    bot.on("windowOpen", onOpen);

    // Manche Plugins aktualisieren nur die Slots im selben Fenster:
    if (oldWindow && oldWindow.updateSlot) {
      const check = setInterval(() => {
        if (done) { clearInterval(check); return; }
        if (slotsHash(oldWindow) !== oldHash) {
          clearInterval(check);
          finish(oldWindow);
        }
      }, 40);
      setTimeout(() => clearInterval(check), timeoutMs);
    }
  });
}

function waitForWindowOpen(bot, timeoutMs = 6000) {
  return new Promise((resolve) => {
    if (bot.currentWindow) { resolve(bot.currentWindow); return; }
    let done = false;
    const finish = (val) => {
      if (done) return;
      done = true;
      bot.removeListener("windowOpen", onOpen);
      clearTimeout(timer);
      resolve(val);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    const onOpen = (win) => finish(win);
    bot.on("windowOpen", onOpen);
  });
}

// Weiter-Button: auf hugosmp.net ist das ein fester Slot (blaue Pfeil-
// Textur, durchs Texture-Pack umbenannt — Namens-Erkennung ist da
// unzuverlässig, also primär per Slot). Fallback: Namensmuster.
function findNextPageSlot(window) {
  const fixed = window.slots[config.nextSlot];
  if (fixed && fixed.name && fixed.name !== "air") return config.nextSlot;

  const guiCount = Math.max(0, window.slots.length - 36);
  for (let i = 0; i < guiCount; i++) {
    const slot = window.slots[i];
    if (!slot || !slot.name || slot.name === "air") continue;
    const display = parsers.readDisplay(slot);
    if (parsers.isNextPageSlot(display, slot)) return i;
  }
  return -1;
}

// "0-35" → [0, 35]
function parseRange(str) {
  const [a, b] = String(str).split("-").map((n) => parseInt(n, 10));
  return [Number.isNaN(a) ? 0 : a, Number.isNaN(b) ? 35 : b];
}

function dumpToFile(market, pageNum, data) {
  if (!config.scraperDebug) return;
  const dir = path.join(config.dataDir, "dumps");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(
    dir,
    `${market}-p${String(pageNum).padStart(3, "0")}-${Date.now()}.json`
  );
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

/* ---------- ein Markt komplett durchscannen ---------- */
async function scanMarket(bot, { command, market }) {
  const listings = [];
  const result = { market, command, pages: 0, listings: 0, error: null };

  // eventuell noch offenes Fenster schließen
  if (bot.currentWindow) {
    try { bot.closeWindow(bot.currentWindow); } catch {}
    await sleep(200);
  }

  bot.chat(command);
  let window = await waitForWindowOpen(bot, 6000);
  if (!window) {
    result.error = `Kein Fenster nach ${command} — öffnet der Befehl ein GUI?`;
    return result;
  }
  await sleep(config.pageDelayMs);

  let page = 1;
  const seenHashes = new Set();

  while (page <= config.maxPages) {
    window = bot.currentWindow;
    if (!window) break;

    const hash = slotsHash(window);
    if (seenHashes.has(hash)) break; // Schleifen-Schutz: Seite schon gesehen
    seenHashes.add(hash);

    parsers && dumpToFile(market, page, parsers.dumpWindow(window));

    // Listings dieser Seite einsammeln (nur der Item-Bereich, Slots 0–35)
    const [r0, r1] = parseRange(config.listingSlots);
    for (let i = r0; i <= Math.min(r1, window.slots.length - 1); i++) {
      const listing = parsers.parseListing(window.slots[i], page);
      if (listing) listings.push(listing);
    }

    // nächste Seite?
    const nextSlot = findNextPageSlot(window);
    if (nextSlot === -1) break;

    try {
      await bot.clickWindow(nextSlot, 0, 0);
    } catch (e) {
      result.error = `Klick auf Weiter-Button fehlgeschlagen: ${e.message}`;
      break;
    }

    await waitForWindowChange(bot, window, hash, 3000);
    await sleep(config.pageDelayMs); // kleine Atempause, mehr nicht
    page++;
  }

  if (bot.currentWindow) {
    try { bot.closeWindow(bot.currentWindow); } catch {}
  }

  result.pages = page;
  result.listings = listings.length;
  result.items = listings;
  return result;
}

/* ---------- beide Märkte scannen und speichern ---------- */
async function runFullScan(bot, db) {
  const results = [];

  const ah = await scanMarket(bot, { command: config.ahCommand, market: "ah" });
  if (ah.items && ah.items.length) db.insertScanTx("ah", ah.items);
  results.push(ah);
  console.log(`[scan] /ah: ${ah.listings} Listings auf ${ah.pages} Seiten${ah.error ? " · FEHLER: " + ah.error : ""}`);

  await sleep(2500); // kurz Luft zwischen den GUIs

  const orders = await scanMarket(bot, { command: config.orderCommand, market: "orders" });
  if (orders.items && orders.items.length) db.insertScanTx("orders", orders.items);
  results.push(orders);
  console.log(`[scan] /order: ${orders.listings} Listings auf ${orders.pages} Seiten${orders.error ? " · FEHLER: " + orders.error : ""}`);

  return results;
}

module.exports = { scanMarket, runFullScan };
