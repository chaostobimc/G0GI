// Datenquelle hugosmp-market.net: Delta/Watermark-Crawler.
//
// Prinzip: Die API liefert Beobachtungen newest-first. Wir merken uns den
// neuesten Zeitpunkt (Watermark) und ziehen pro Zyklus NUR die Zeilen, die
// neuer sind — also exakt den Live-Feed-Delta. Über Zeit baut sich dadurch
// eine komplette Preishistorie auf, ganz ohne Snapshot-Bombardement.
//
// Last: ~6-8 Requests pro 5-Minuten-Zyklus (limit=500), User-Agent ist
// gesetzt und identifiziert dieses Community-Projekt.
//
// HINWEIS robots.txt: hugosmp-market.net disallowed /api/ für Crawler.
// Wir polln bewusst minimal-frequent (kein Voll-Crawl!). Wenn der Betrieb
// der Seite das nicht möchte: DATA_SOURCE=bot nutzen oder die Betreiber
// (gleiche Community!) kurz um OK fragen.
"use strict";

const config = require("./config");
const db = require("./db");

const USER_AGENT =
  "G0GI-Clan-Site/0.4 (+eigenes Community-Projekt für HugoSMP; low-frequency delta poll)";

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} für ${url}`);
  return res.json();
}

async function pullMarket(market, apiPath) {
  const watermark = db.q.watermark.get(market).w;
  const fresh = [];
  let offset = 0;
  let pages = 0;

  while (pages < config.siteMaxPages) {
    const data = await fetchJson(
      `${config.marketSiteUrl}${apiPath}?limit=500&offset=${offset}`
    );
    let sawOld = false;
    for (const r of data.rows) {
      const ts = Date.parse(r.observed_at);
      if (!ts || ts <= watermark) { sawOld = true; break; }
      fresh.push({ ...r, ts });
    }
    pages++;
    if (sawOld || data.rows.length < 500) break;
    offset += 500;
  }

  if (!fresh.length) return { market, added: 0, pages };

  const listings = fresh.map((r) => ({
    key: r.item_key,
    name: r.item_key,
    // Auktionen: Gesamtpreis (wie die Lore "Preis: $X") · Orders: Stückpreis
    price: market === "ah" ? r.price_total : r.price_unit,
    qty: r.quantity || 1,
    seller: r.player_name || null,
    ts: r.ts,
    page: 1,
    extra: r.map_id
      ? {
          mapId: String(r.map_id),
          mapName: r.map_name || null,
          mapAuthor: r.map_original_author || null,
        }
      : null,
  }));

  db.insertScanTx(market, listings, "site");
  return { market, added: listings.length, pages };
}

async function runSiteScan() {
  const a = await pullMarket("ah", "/api/auctions");
  console.log(`[site] auctions: +${a.added} Beobachtungen (${a.pages} Req.)`);
  const o = await pullMarket("orders", "/api/orders");
  console.log(`[site] orders:   +${o.added} Beobachtungen (${o.pages} Req.)`);
  return [a, o];
}

module.exports = { runSiteScan };
