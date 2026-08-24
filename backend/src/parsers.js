// GUI-Parser: zieht aus AH-/Order-Slots Item + Preis + Verkäufer.
//
// Layout per Screenshot vermessen (/ah und /order identisch):
// 6 Reihen × 9 Slots · Listings in Slots 0–35 (Reihe 1–4), Reihe 5 =
// Scrollbar-Deko, Reihe 6 = Navigation (Weiter-Button = Slot 50).
// Das Texture-Pack ändert nur das Aussehen, nicht die Slot-Positionen.
// Der Preis steht in der Item-Lore (Formate: CONFIG.pricePatterns unten).
// SCRAPER_DEBUG=true schreibt Roh-Dumps nach backend/data/dumps/, falls
// ein Format mal nicht matcht.
"use strict";

const config = require("./config");

/* ---------- einstellbare Muster ---------- */
const CONFIG = {
  // Regex-Muster für Preise in Name/Lore (Gruppe 1 = Zahl, optional Gruppe 2 = k/m)
  pricePatterns: [
    /(?:preis|kosten|kauf(?:en)?(?:\s*für)?|sofortkauf|startgebot|gebot|buy(?:\s*it)?\s*(?:now)?(?:\s*for)?|cost|price)[:\s]*([0-9][0-9.,]*)\s*(k|m)?/i,
    /([0-9][0-9.,]*)\s*(k|m)\b/i,
    /\$\s*([0-9][0-9.,]*)/i,
    /([0-9][0-9.,]*)\s*(?:\$|coins?|credits?|mark)/i,
  ],
  // Muster für Verkäufer-Zeilen
  sellerPatterns: [
    /(?:verkäufer|verkäuferin|von|spieler|seller|listed\s*by|by)[:\s]+([A-Za-z0-9_]{3,16})/i,
  ],
  // Slots, die NUR Navigation/Deko sind (werden übersprungen)
  navPatterns: [
    /^(seite|page)\b/i,
    /^(nächste|vorherige|next|previous|back|zurück|weiter|close|schließen|exit|beenden)/i,
    /^[»«><←→✔✖x\-]+$/i,
  ],
  // Items, die als "Nächste Seite"-Button gelten
  nextPagePatterns: [/^(nächste|next|weiter)\b/i, /[»»>]{1,3}.*seite/i, /^seite.*[»>]/i],
  prevPagePatterns: [/^(vorherige|previous|zurück|back)\b/i, /[««<]{1,3}.*seite/i],
  // Typische Deko-Items, die keine Listings sind
  junkItemNames: [
    "gray_stained_glass_pane", "black_stained_glass_pane", "red_stained_glass_pane",
    "light_gray_stained_glass_pane", "brown_stained_glass_pane", "barrier",
    "filled_map", "book", "air",
  ],
};

/* ---------- NBT/Lore-Helfer ---------- */

// Textkomponenten (JSON-String, Array oder Plain) zu Klartext reduzieren
function componentToText(comp) {
  if (comp == null) return "";
  if (typeof comp === "string") {
    const trimmed = comp.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try { return componentToText(JSON.parse(trimmed)); } catch { return comp; }
    }
    return comp;
  }
  if (Array.isArray(comp)) return comp.map(componentToText).join("");
  if (typeof comp === "object") {
    let out = comp.text ?? "";
    if (comp.extra) out += componentToText(comp.extra);
    return out;
  }
  return String(comp);
}

function readDisplay(slot) {
  const out = { name: null, lore: [] };
  const nbt = slot && slot.nbt;
  if (!nbt || !nbt.value) return out;

  const display = nbt.value.display;
  if (!display || !display.value) return out;

  const name = display.value.Name;
  if (name) out.name = componentToText(name.value ?? name);

  const lore = display.value.Lore;
  if (lore && lore.value && Array.isArray(lore.value.value)) {
    out.lore = lore.value.value.map((l) => componentToText(l.value ?? l));
  } else if (lore && Array.isArray(lore.value)) {
    out.lore = lore.value.map((l) => componentToText(l));
  }
  return out;
}

// Farbcodes (§x) und typische Formatierungsreste entfernen
function stripFormatting(s) {
  return String(s).replace(/§./g, "").replace(/[\u00A7]/g, "").trim();
}

/* ---------- Preis-Parsing ---------- */

// "1.500" → 1500 (de) · "1,500" → 1500 (en) · "1.500,50" → 1500.5 · "2.5" → 2.5
function parseNumber(raw) {
  let s = String(raw).trim();
  const hasDot = s.includes(".");
  const hasComma = s.includes(",");

  if (hasDot && hasComma) {
    // was zuletzt kommt, ist das Dezimalzeichen
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (hasComma) {
    if (/^\d{1,3}(,\d{3})+$/.test(s)) s = s.replace(/,/g, "");       // en-Tausender
    else if (/,\d{3}$/.test(s) && s.split(",").length === 2 && !/,000$/.test(s)) s = s.replace(",", ""); // en: 1,500
    else s = s.replace(",", ".");                                     // de-Dezimal
  } else if (hasDot) {
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");      // de-Tausender: 1.500
    // sonst Einzelpunkt → Dezimalpunkt, passt schon
  }
  const n = parseFloat(s);
  return Number.isNaN(n) ? null : n;
}

function extractPrice(text) {
  const t = stripFormatting(text);
  for (const re of CONFIG.pricePatterns) {
    const m = t.match(re);
    if (!m) continue;
    let n = parseNumber(m[1]);
    if (n == null) continue;
    const suffix = (m[2] || "").toLowerCase();
    if (suffix === "k") n *= 1_000;
    if (suffix === "m") n *= 1_000_000;
    if (n > 0) return n;
  }
  return null;
}

function extractSeller(text) {
  const t = stripFormatting(text);
  for (const re of CONFIG.sellerPatterns) {
    const m = t.match(re);
    if (m) return m[1];
  }
  return null;
}

/* ---------- Slot-Klassifizierung ---------- */

function isNavSlot(display) {
  const name = display.name || "";
  return CONFIG.navPatterns.some((re) => re.test(name));
}

function isJunkItem(slot) {
  return CONFIG.junkItemNames.includes(slot.name);
}

function isNextPageSlot(display, slot) {
  const name = display.name || "";
  if (CONFIG.nextPagePatterns.some((re) => re.test(name))) return true;
  // klassischer Fall: Pfeil ohne Preis im Namen
  if ((slot.name === "arrow" || slot.name === "spectral_arrow") && !extractPrice(name)) {
    if (/seite|page/i.test(name)) return true;
  }
  return false;
}

function isPrevPageSlot(display, slot) {
  const name = display.name || "";
  if (CONFIG.prevPagePatterns.some((re) => re.test(name))) return true;
  if ((slot.name === "arrow" || slot.name === "spectral_arrow") && /zurück|vorherige|back|previous/i.test(name)) return true;
  return false;
}

/* ---------- Haupt-Parser ---------- */

// slot → Listing oder null
function parseListing(slot, pageNum) {
  if (!slot || !slot.name || slot.name === "air") return null;
  if (isJunkItem(slot)) return null;

  const display = readDisplay(slot);
  if (isNavSlot(display)) return null;

  const haystack = [display.name || "", ...display.lore].join("\n");
  const price = extractPrice(haystack);
  if (price == null) return null; // ohne Preis kein Listing

  const key = `minecraft:${slot.name}`;
  return {
    key,
    name: stripFormatting(display.name || slot.name),
    price,
    qty: slot.count || 1,
    seller: extractSeller(haystack),
    page: pageNum,
    extra: display.lore,
  };
}

// Roher Dump eines Fensters (für Debug / GUI-Analyse)
function dumpWindow(window) {
  const slots = [];
  for (let i = 0; i < window.slots.length; i++) {
    const s = window.slots[i];
    if (!s || s.name === "air" || !s.name) continue;
    const display = readDisplay(s);
    slots.push({
      slot: i,
      item: s.name,
      count: s.count,
      displayName: display.name ? stripFormatting(display.name) : null,
      lore: display.lore.map(stripFormatting),
    });
  }
  return { type: window.type, title: window.title, slots };
}

module.exports = {
  CONFIG,
  parseListing,
  dumpWindow,
  isNextPageSlot,
  isPrevPageSlot,
  readDisplay,
  stripFormatting,
  parseNumber,
};
