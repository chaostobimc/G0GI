/* ============================================================
   G0GI Market-Tab: Suche, Item-Grid, Detail-Overlay, Preisgraph
   ============================================================ */
"use strict";

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

const fmtPrice = (n) =>
  n == null ? "–" : new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(n) + " $";

const fmtTime = (ts) => {
  if (!ts) return "–";
  const diff = Date.now() - ts;
  if (diff < 90_000) return "gerade eben";
  if (diff < 3_600_000) return `vor ${Math.round(diff / 60_000)} min`;
  if (diff < 86_400_000) return `vor ${Math.round(diff / 3_600_000)} h`;
  return new Date(ts).toLocaleDateString("de-DE");
};

async function api(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

/* ---------- Nav (wie auf der Hauptseite) ---------- */
const burger = $("#burger");
const navLinks = $("#navLinks");
burger.addEventListener("click", () => {
  const open = navLinks.classList.toggle("open");
  burger.classList.toggle("open", open);
  burger.setAttribute("aria-expanded", open);
});
$$("a", navLinks).forEach(a => a.addEventListener("click", () => {
  navLinks.classList.remove("open");
  burger.classList.remove("open");
}));

/* ---------- Status-Leiste ---------- */
const BOT_LABELS = {
  offline: "offline",
  connecting: "verbindet …",
  spawned: "online · steht am Spawn",
  scanning: "scannt den Markt …",
  error: "Fehler",
};

async function refreshStatus() {
  try {
    const s = await api("/api/status");
    const dot = $("#botDot");
    dot.className = "status-dot" + (
      s.bot.status === "spawned" || s.bot.status === "scanning" ? " online" :
      s.bot.status === "error" ? " error" :
      s.bot.status === "connecting" ? " scanning" : ""
    );
    $("#botStatus").textContent = BOT_LABELS[s.bot.status] || s.bot.status;
    const last = s.scans.ah || s.scans.orders;
    $("#lastScan").textContent = last ? fmtTime(last.finished_at || last.started_at) + (s.demo ? " (Demo)" : "") : "noch keiner";
    $("#itemCount").textContent = s.itemsKnown || "–";

    const info = $("#resultInfo");
    if (s.demo && info && !info.dataset.demoShown) {
      info.dataset.demoShown = "1";
    }
  } catch {
    $("#botStatus").textContent = "API nicht erreichbar";
  }
}
refreshStatus();
setInterval(refreshStatus, 30_000);

/* ---------- Suche & Grid ---------- */
const grid = $("#itemGrid");
const searchInput = $("#searchInput");
let currentMarket = "all";
let currentItems = [];

const esc = (s) => String(s ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#039;");

function iconUrl(key) {
  return `/icons/${encodeURIComponent(String(key).replace(/^minecraft:/, ""))}.png`;
}

async function runSearch() {
  const q = searchInput.value.trim();
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  params.set("market", currentMarket === "all" ? "all" : currentMarket);
  params.set("limit", "500");

  try {
    const data = await api(`/api/items?${params}`);
    currentItems = data.items;
    renderGrid(data);
  } catch (e) {
    grid.innerHTML = `<div class="empty-state"><span class="big-emoji">⚠️</span>API nicht erreichbar — läuft das Backend? (<code>npm start</code> in <code>backend/</code>)</div>`;
  }
}

function renderGrid(data) {
  const info = $("#resultInfo");
  const demoNote = data.demo ? " · Demo-Daten, bis der Bot den ersten echten Scan liefert" : "";

  if (!data.items.length) {
    info.textContent = "";
    grid.innerHTML = `<div class="empty-state">
      <span class="big-emoji">🔍</span>
      Keine Items gefunden${searchInput.value.trim() ? ` für „${esc(searchInput.value.trim())}“` : ""}.<br>
      Versuch es mit dem deutschen oder englischen Namen.${demoNote ? "<br>" + demoNote : ""}
    </div>`;
    return;
  }

  info.textContent = `${data.total} Item${data.total === 1 ? "" : "s"}${demoNote}`;

  grid.innerHTML = data.items.map((it, i) => {
    const de = esc(it.de || it.en || it.key);
    const en = esc(it.en || "");
    const priceTags = [];
    if (it.ah) priceTags.push(`<div class="price-tag">Auktion ab<b>${fmtPrice(it.ah.best)}</b></div>`);
    if (it.orders) priceTags.push(`<div class="price-tag orders">Order bis<b>${fmtPrice(it.orders.best)}</b></div>`);
    return `<button class="item-card reveal in" style="--d:${Math.min(i, 12) * 0.03}s" data-key="${esc(it.key)}">
      <div class="item-card-top">
        <div class="item-icon"><img loading="lazy" src="${iconUrl(it.key)}" alt=""></div>
        <div>
          <div class="item-name-de">${de}</div>
          <div class="item-name-en">${en}</div>
        </div>
      </div>
      <div class="item-prices">${priceTags.join("") || '<div class="price-tag">kein Angebot</div>'}</div>
    </button>`;
  }).join("");

  $$(".item-card", grid).forEach(card =>
    card.addEventListener("click", () => openDetail(card.dataset.key))
  );
}

let searchTimer = null;
searchInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(runSearch, 250);
});

$$(".chip").forEach(chip => chip.addEventListener("click", () => {
  $$(".chip").forEach(c => c.classList.remove("active"));
  chip.classList.add("active");
  currentMarket = chip.dataset.market;
  runSearch();
}));

runSearch();
// Hintergrund-Update alle 60 Sekunden — der Bot scannt den Markt alle
// 5 Minuten, neue Preise landen so kurz nach dem Scan auf der Seite.
// Beim Tippen wird die Suche ohnehin sofort neu angestoßen.
setInterval(runSearch, 60_000);

/* ---------- Detail-Overlay ---------- */
const overlay = $("#detailOverlay");
let detailKey = null;
let detailDays = 14;

async function openDetail(key) {
  detailKey = key;
  overlay.classList.add("open");
  document.body.style.overflow = "hidden";

  const item = currentItems.find(i => i.key === key) || {};
  $("#detailIcon").src = iconUrl(key);
  $("#detailName").textContent = item.de || item.en || key;
  $("#detailNameEn").textContent = item.en ? `${item.en} · ${key}` : key;

  $("#chartArea").innerHTML = '<p class="listing-none">Lade Preisverlauf …</p>';
  $("#ahListings").innerHTML = "";
  $("#orderListings").innerHTML = "";

  // Listings
  try {
    const d = await api(`/api/item/${encodeURIComponent(key)}`);
    $("#ahListings").innerHTML = renderListings(d.markets.ah, "ah");
    $("#orderListings").innerHTML = renderListings(d.markets.orders, "orders");
  } catch {
    $("#ahListings").innerHTML = '<p class="listing-none">Fehler beim Laden.</p>';
  }

  loadHistory();
}

function renderListings(listings, market) {
  if (!listings || !listings.length) return '<p class="listing-none">Aktuell keine Einträge.</p>';
  const rows = listings.slice(0, 12).map(l => `
    <tr>
      <td class="price">${fmtPrice(l.price)}</td>
      <td>${l.qty}×</td>
      <td>${l.seller ? esc(l.seller) : "–"}</td>
      <td>${fmtTime(l.ts)}</td>
    </tr>`).join("");
  return `<table class="listing-table">
    <thead><tr><th>${market === "ah" ? "Gesamtpreis" : "Stückpreis"}</th><th>Menge</th><th>Spieler</th><th>Stand</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function closeDetail() {
  overlay.classList.remove("open");
  document.body.style.overflow = "";
  detailKey = null;
}
$("#detailClose").addEventListener("click", closeDetail);
overlay.addEventListener("click", (e) => { if (e.target === overlay) closeDetail(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDetail(); });

$$(".range-btn").forEach(btn => btn.addEventListener("click", () => {
  $$(".range-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  detailDays = parseInt(btn.dataset.days, 10);
  if (detailKey) loadHistory();
}));

async function loadHistory() {
  try {
    const h = await api(`/api/item/${encodeURIComponent(detailKey)}/history?days=${detailDays}`);
    drawChart(h);
  } catch {
    $("#chartArea").innerHTML = '<p class="listing-none">Preisverlauf nicht verfügbar.</p>';
  }
}

/* ---------- SVG-Preisgraph (handgebaut, keine externe Lib) ---------- */
function drawChart(h) {
  const area = $("#chartArea");
  const tip = $("#chartTip");

  const series = [
    { key: "ah", color: "#e02546", data: h.series.ah || [] },
    { key: "orders", color: "#7fd8a2", data: h.series.orders || [] },
  ].filter(s => s.data.length);

  if (!series.length) {
    area.innerHTML = '<p class="listing-none">Noch keine Preisdaten für diesen Zeitraum — der Graph füllt sich mit jedem Scan.</p>';
    return;
  }

  const W = 800, H = 260, padL = 62, padR = 16, padT = 14, padB = 30;
  const all = series.flatMap(s => s.data.map(d => d.min_price));
  const min = Math.min(...all), max = Math.max(...all);
  const span = max - min || 1;

  const tsMin = Math.min(...series.flatMap(s => s.data.map(d => d.ts)));
  const tsMax = Math.max(...series.flatMap(s => s.data.map(d => d.ts)));
  const tsSpan = tsMax - tsMin || 1;

  const x = (ts) => padL + ((ts - tsMin) / tsSpan) * (W - padL - padR);
  const y = (v) => padT + (1 - (v - min) / span) * (H - padT - padB);

  // Gitter + Y-Labels
  let gridLines = "";
  const ySteps = 4;
  for (let i = 0; i <= ySteps; i++) {
    const v = min + (span * i) / ySteps;
    const yy = y(v);
    gridLines += `<line x1="${padL}" y1="${yy}" x2="${W - padR}" y2="${yy}" stroke="#472129" stroke-width="1" stroke-dasharray="4 5"/>`;
    gridLines += `<text x="${padL - 8}" y="${yy + 4}" text-anchor="end" fill="#cbb3ae" font-size="11">${new Intl.NumberFormat("de-DE", { notation: span > 10000 ? "compact" : "standard", maximumFractionDigits: 0 }).format(v)}</text>`;
  }
  // X-Labels (5 Marken)
  for (let i = 0; i <= 4; i++) {
    const ts = tsMin + (tsSpan * i) / 4;
    const xx = x(ts);
    const label = new Date(ts).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
    gridLines += `<text x="${xx}" y="${H - 8}" text-anchor="middle" fill="#cbb3ae" font-size="11">${label}</text>`;
  }

  const paths = series.map(s => {
    const pts = s.data.map(d => `${x(d.ts).toFixed(1)},${y(d.min_price).toFixed(1)}`);
    const line = `<polyline points="${pts.join(" ")}" fill="none" stroke="${s.color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
    const areaPath = `<polygon points="${padL},${H - padB} ${pts.join(" ")} ${W - padR},${H - padB}" fill="${s.color}" opacity=".08"/>`;
    const dots = s.data.map(d =>
      `<circle cx="${x(d.ts).toFixed(1)}" cy="${y(d.min_price).toFixed(1)}" r="3" fill="${s.color}" class="chart-dot"
        data-ts="${d.ts}" data-price="${d.min_price}" data-market="${s.key}"/>`
    ).join("");
    return areaPath + line + dots;
  }).join("");

  area.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-height:280px" id="priceChart">${gridLines}${paths}</svg>`;

  // Hover-Tooltip über Event-Delegation
  const svg = $("#priceChart");
  const box = area.closest(".chart-box");
  svg.addEventListener("mousemove", (e) => {
    const dot = e.target.closest(".chart-dot");
    if (!dot) { tip.style.display = "none"; return; }
    const r = box.getBoundingClientRect();
    tip.style.display = "block";
    tip.style.left = `${e.clientX - r.left}px`;
    tip.style.top = `${e.clientY - r.top}px`;
    const when = new Date(parseInt(dot.dataset.ts, 10)).toLocaleString("de-DE", {
      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
    });
    tip.textContent = `${dot.dataset.market === "ah" ? "Auktion" : "Order"} · ${fmtPrice(parseFloat(dot.dataset.price))} · ${when}`;
  });
  svg.addEventListener("mouseleave", () => { tip.style.display = "none"; });
}
