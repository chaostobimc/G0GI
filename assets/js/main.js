/* ============================================================
   G0GI main.js
   Nav, 3D-Scroll-Kram, Reveal-Observer und die ganzen Tools.
   Alles läuft lokal im Browser — kein Backend nötig (kommt später).
   ============================================================ */

"use strict";

/* ---------- kleine Helfer ---------- */
const $  = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- Toast ---------- */
const toastEl = $("#toast");
let toastTimer = null;
function toast(msg, ms = 3200) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), ms);
}

/* ============================================================
   NAV
   ============================================================ */
const nav = $("#nav");
const burger = $("#burger");
const navLinks = $("#navLinks");

burger.addEventListener("click", () => {
  const open = navLinks.classList.toggle("open");
  burger.classList.toggle("open", open);
  burger.setAttribute("aria-expanded", open);
});
// Menü schließen, sobald ein Link angeklickt wurde
$$("a", navLinks).forEach(a => a.addEventListener("click", () => {
  navLinks.classList.remove("open");
  burger.classList.remove("open");
  burger.setAttribute("aria-expanded", "false");
}));

/* ============================================================
   3D-Scroll-Zeugs: Hero-Würfel, Blütenblätter, Parallax, Spin
   Läuft in EINEM rAF-Loop, damit es nicht ruckelt.
   ============================================================ */
const cube = $("#heroCube");
const cubeShadow = $("#cubeShadow");
const parallaxEls = $$("[data-parallax]");
const spinEls = $$("[data-spin]");

/* --- Blütenblätter (Kirschblüten-Regen im Hero) --- */
const canvas = $("#petals");
const ctx = canvas.getContext("2d");
let petals = [];

function sizeCanvas() {
  const hero = canvas.parentElement;
  canvas.width = hero.offsetWidth;
  canvas.height = hero.offsetHeight;
}
sizeCanvas();
window.addEventListener("resize", sizeCanvas);

function makePetal(randomY = false) {
  return {
    x: Math.random() * canvas.width,
    y: randomY ? Math.random() * canvas.height : -12,
    size: 5 + Math.random() * 7,
    speedY: 0.4 + Math.random() * 0.9,
    swayAmp: 20 + Math.random() * 30,
    swaySpeed: 0.5 + Math.random() * 1.2,
    phase: Math.random() * Math.PI * 2,
    rot: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 0.04,
    hue: Math.random() < 0.5 ? "#ffb3c1" : "#ff8fa3",
    alpha: 0.35 + Math.random() * 0.4,
  };
}
function initPetals() {
  const count = Math.min(46, Math.floor(canvas.width / 28));
  petals = Array.from({ length: count }, () => makePetal(true));
}
initPetals();

function drawPetals(t) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const p of petals) {
    p.y += p.speedY;
    p.rot += p.rotSpeed;
    const x = p.x + Math.sin(t * 0.001 * p.swaySpeed + p.phase) * p.swayAmp;
    if (p.y > canvas.height + 14) Object.assign(p, makePetal(false));

    ctx.save();
    ctx.translate(x, p.y);
    ctx.rotate(p.rot);
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.hue;
    // kleines Blütenblatt: leicht längliche, abgerundete Form
    ctx.beginPath();
    ctx.ellipse(0, 0, p.size * 0.62, p.size, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

/* --- Haupt-Loop --- */
let lastScroll = window.scrollY;
function frame(t) {
  const y = window.scrollY;

  // Nav-Hintergrund
  nav.classList.toggle("scrolled", y > 40);

  if (!reducedMotion) {
    // Würfel: Eigenrotation + Scroll-Kopplung
    if (cube) {
      const rotY = t * 0.022 + y * 0.22;
      const rotX = -16 + Math.sin(t * 0.0009) * 7 + Math.min(y * 0.05, 40);
      const floatY = Math.sin(t * 0.0012) * 10;
      cube.style.transform = `translateY(${floatY}px) rotateX(${rotX}deg) rotateY(${rotY}deg)`;
      if (cubeShadow) {
        const s = 1 - Math.min(y / 1200, 0.4);
        cubeShadow.style.transform = `scale(${s + floatY * 0.008})`;
        cubeShadow.style.opacity = 0.9 - floatY * 0.02;
      }
    }

    // Parallax-Blobs
    for (const el of parallaxEls) {
      const speed = parseFloat(el.dataset.parallax) || 0;
      el.style.transform = `translateY(${y * speed}px)`;
    }

    // Scroll-Spin (Kirsche im Tools-Header)
    for (const el of spinEls) {
      const r = el.getBoundingClientRect();
      const progress = 1 - (r.top + r.height / 2) / window.innerHeight; // 0..~1
      el.style.transform = `rotate(${progress * 260}deg)`;
    }

    // Blüten nur zeichnen, solange der Hero sichtbar ist
    if (y < canvas.height + 100) drawPetals(t);
  }

  lastScroll = y;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/* ============================================================
   REVEAL beim Scrollen (3D-Kipp-Effekt)
   ============================================================ */
const revealObserver = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (e.isIntersecting) {
      e.target.classList.add("in");
      revealObserver.unobserve(e.target);
    }
  }
}, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });
$$(".reveal").forEach(el => revealObserver.observe(el));

/* ============================================================
   Zähler (Statistiken im Manifest)
   ============================================================ */
function animateCount(el) {
  const target = parseInt(el.dataset.count, 10) || 0;
  const dur = 1200;
  const start = performance.now();
  function tick(now) {
    const p = Math.min((now - start) / dur, 1);
    // ease-out, fühlt sich weniger roboterhaft an
    el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
const countObserver = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (e.isIntersecting) {
      if (reducedMotion) e.target.textContent = e.target.dataset.count;
      else animateCount(e.target);
      countObserver.unobserve(e.target);
    }
  }
}, { threshold: 0.6 });
$$(".stat-num").forEach(el => countObserver.observe(el));

/* ============================================================
   TEAM-Karten: Maus-Tilt (3D)
   ============================================================ */
$$("[data-tilt]").forEach(card => {
  card.addEventListener("mousemove", (ev) => {
    if (reducedMotion) return;
    const r = card.getBoundingClientRect();
    const px = (ev.clientX - r.left) / r.width - 0.5;
    const py = (ev.clientY - r.top) / r.height - 0.5;
    card.style.transform =
      `perspective(700px) rotateY(${px * 10}deg) rotateX(${-py * 10}deg) translateY(-4px)`;
  });
  card.addEventListener("mouseleave", () => {
    card.style.transform = "";
  });
});

/* ============================================================
   TOOL 1: Weg-Rechner
   ============================================================ */
const SPEEDS = [
  { label: "Zu Fuß", ms: 4.3, icon: "🚶" },
  { label: "Sprinten", ms: 7.0, icon: "🏃" },
  { label: "Pferd", ms: 9.5, icon: "🐎" },
  { label: "Elytra + Raketen", ms: 32, icon: "🪂" },
];

function fmtTime(sec) {
  if (sec < 60) return `${Math.round(sec)} Sek.`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  if (m < 60) return s ? `${m} Min. ${s} Sek.` : `${m} Min.`;
  const h = Math.floor(m / 60);
  return `${h} Std. ${m % 60} Min.`;
}

function calcWeg() {
  const x1 = parseFloat($("#wegX1").value), z1 = parseFloat($("#wegZ1").value);
  const x2 = parseFloat($("#wegX2").value), z2 = parseFloat($("#wegZ2").value);
  const out = $("#wegOut");
  if ([x1, z1, x2, z2].some(Number.isNaN)) {
    out.innerHTML = '<span class="tool-hint">Bitte alle vier Koordinaten eintragen.</span>';
    return;
  }
  const dist = Math.hypot(x2 - x1, z2 - z1);
  const rows = SPEEDS.map(s =>
    `<div>${s.icon} ${s.label}: <strong>${fmtTime(dist / s.ms)}</strong></div>`
  ).join("");
  out.innerHTML = `
    <div class="big">${Math.round(dist).toLocaleString("de-DE")} Blöcke</div>
    ${rows}
    <div style="margin-top:.5rem">🔥 Nether-Shortcut: Portal bei
      <strong>X ${Math.round(x1 / 8)}, Z ${Math.round(z1 / 8)}</strong> bauen (8:1-Regel).</div>`;
}
$("#wegCalc").addEventListener("click", calcWeg);

/* ============================================================
   TOOL 2: Bau-Rechner
   ============================================================ */
function calcBau() {
  const l = parseInt($("#bauL").value, 10);
  const w = parseInt($("#bauW").value, 10);
  const h = parseInt($("#bauH").value, 10);
  const floor = $("#bauFloor").checked;
  const ceil = $("#bauCeil").checked;
  const out = $("#bauOut");

  if (!l || !w || !h || l < 1 || w < 1 || h < 1) {
    out.innerHTML = '<span class="tool-hint">Maße müssen mindestens 1 sein.</span>';
    return;
  }
  // Wände = Umfang * Höhe, minus die 4 Ecken, die doppelt zählen würden
  const walls = 2 * (l + w) * h - 4 * h;
  const extras = (floor ? l * w : 0) + (ceil ? l * w : 0);
  const total = walls + extras;
  const stacks = Math.floor(total / 64);
  const rest = total % 64;

  out.innerHTML = `
    <div class="big">${total.toLocaleString("de-DE")} Blöcke</div>
    <div>Wände: <strong>${walls.toLocaleString("de-DE")}</strong>${floor ? ` · Boden: <strong>${(l * w).toLocaleString("de-DE")}</strong>` : ""}${ceil ? ` · Decke: <strong>${(l * w).toLocaleString("de-DE")}</strong>` : ""}</div>
    <div>= <strong>${stacks} Stacks</strong>${rest ? ` + ${rest}` : ""} Blöcke. ${stacks >= 9 ? "Nimm eine Schulkiste mit." : "Passt locker ins Inventar."}</div>`;
}
["bauL", "bauW", "bauH"].forEach(id => $("#" + id).addEventListener("input", calcBau));
["bauFloor", "bauCeil"].forEach(id => $("#" + id).addEventListener("change", calcBau));
calcBau();

/* ============================================================
   TOOL 3: Farm-Rechner
   Werte sind Faustregeln aus Fritzis Farmen, keine Wissenschaft.
   ============================================================ */
const CROP_RATES = {
  weizen:     { name: "Weizen",   perHour: 1.0, drop: "Weizen" },
  karotte:    { name: "Karotten", perHour: 3.0, drop: "Karotten" },
  kartoffel:  { name: "Kartoffeln", perHour: 3.0, drop: "Kartoffeln" },
  zuckerrohr: { name: "Zuckerrohr", perHour: 1.0, drop: "Zuckerrohr" },
  melone:     { name: "Melonen",  perHour: 1.4, drop: "Melonenstücke" },
  kuerbis:    { name: "Kürbisse", perHour: 1.0, drop: "Kürbisse" },
};

function calcFarm() {
  const crop = CROP_RATES[$("#farmCrop").value];
  const count = Math.max(1, parseInt($("#farmCount").value, 10) || 0);
  const perHour = crop.perHour * count;
  const perDay = perHour * 24;
  const stacks = (perDay / 64).toFixed(1);
  $("#farmOut").innerHTML = `
    <div><strong>${perHour.toLocaleString("de-DE", { maximumFractionDigits: 0 })}</strong> ${crop.drop} pro Stunde</div>
    <div>≈ <strong>${perDay.toLocaleString("de-DE", { maximumFractionDigits: 0 })}</strong> pro Tag (24 h)
      · etwa <strong>${stacks.replace(".", ",")} Stacks</strong></div>`;
}
$("#farmCrop").addEventListener("change", calcFarm);
$("#farmCount").addEventListener("input", calcFarm);
calcFarm();

/* ============================================================
   TOOL 4: Raid-Packliste (localStorage)
   ============================================================ */
const PACK_KEY = "gogi_packlist_v1";
const DEFAULT_PACK = [
  { name: "Totem der Unsterblichkeit ×4", done: false },
  { name: "Goldene Äpfel ×12", done: false },
  { name: "Enderperlen ×6", done: false },
  { name: "Pfeile ×64", done: false },
  { name: "Schild", done: false },
  { name: "Wassereimer", done: false },
  { name: "Steak ×64", done: false },
  { name: "Ersatz-Spitzhacke", done: false },
];

let packList = [];
try {
  const saved = JSON.parse(localStorage.getItem(PACK_KEY));
  packList = Array.isArray(saved) ? saved : DEFAULT_PACK;
} catch { packList = DEFAULT_PACK; }

function savePack() {
  localStorage.setItem(PACK_KEY, JSON.stringify(packList));
}

function renderPack() {
  const ul = $("#packList");
  ul.innerHTML = "";
  packList.forEach((item, i) => {
    const li = document.createElement("li");
    if (item.done) li.classList.add("done");

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = item.done;
    cb.addEventListener("change", () => {
      packList[i].done = cb.checked;
      li.classList.toggle("done", cb.checked);
      savePack();
      updatePackBar();
    });

    const span = document.createElement("span");
    span.textContent = item.name;

    const del = document.createElement("button");
    del.type = "button";
    del.className = "pack-del";
    del.title = "Entfernen";
    del.textContent = "✕";
    del.addEventListener("click", () => {
      packList.splice(i, 1);
      savePack();
      renderPack();
    });

    li.append(cb, span, del);
    ul.appendChild(li);
  });
  updatePackBar();
}

function updatePackBar() {
  const total = packList.length;
  const done = packList.filter(i => i.done).length;
  $("#packBar").style.width = total ? `${(done / total) * 100}%` : "0%";
}

$("#packAddForm").addEventListener("submit", (ev) => {
  ev.preventDefault();
  const input = $("#packAddInput");
  const val = input.value.trim();
  if (!val) return;
  packList.push({ name: val, done: false });
  input.value = "";
  savePack();
  renderPack();
});
renderPack();

/* ============================================================
   TOOL 5: Event-Countdown (localStorage, tickt jede Sekunde)
   ============================================================ */
const EVENT_KEY = "gogi_event_v1";
let eventInterval = null;

function loadEvent() {
  try {
    const ev = JSON.parse(localStorage.getItem(EVENT_KEY));
    if (ev && ev.date) {
      $("#eventName").value = ev.name || "";
      $("#eventDate").value = ev.date;
      startCountdown();
    }
  } catch { /* nichts gespeichert, alles gut */ }
}

function renderCountdown() {
  const ev = JSON.parse(localStorage.getItem(EVENT_KEY));
  const out = $("#eventOut");
  if (!ev || !ev.date) {
    out.innerHTML = '<span class="tool-hint">Noch kein Event eingetragen.</span>';
    return;
  }
  const target = new Date(ev.date).getTime();
  const diff = target - Date.now();
  if (Number.isNaN(target)) {
    out.innerHTML = '<span class="tool-hint">Datum ungültig.</span>';
    return;
  }
  if (diff <= 0) {
    out.innerHTML = `<div class="cd-name">${escapeHtml(ev.name || "Event")}</div>
      <div class="cd-over">🍒 Das Event läuft — oder ist schon Geschichte!</div>`;
    return;
  }
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  out.innerHTML = `
    <div class="cd-name">${escapeHtml(ev.name || "Event")}</div>
    <div class="countdown-grid">
      <div class="cd-cell"><b>${d}</b><span>Tage</span></div>
      <div class="cd-cell"><b>${h}</b><span>Std.</span></div>
      <div class="cd-cell"><b>${m}</b><span>Min.</span></div>
      <div class="cd-cell"><b>${s}</b><span>Sek.</span></div>
    </div>`;
}

function startCountdown() {
  clearInterval(eventInterval);
  renderCountdown();
  eventInterval = setInterval(renderCountdown, 1000);
}

$("#eventSave").addEventListener("click", () => {
  const name = $("#eventName").value.trim();
  const date = $("#eventDate").value;
  if (!date) {
    toast("Wann soll das Event denn stattfinden? 🕐");
    return;
  }
  localStorage.setItem(EVENT_KEY, JSON.stringify({ name, date }));
  startCountdown();
  toast("Countdown gesetzt! ⏳");
});
loadEvent();

/* ============================================================
   TOOL 6a: Kampfruf-Generator
   ============================================================ */
const RUF_A = [
  "Bei Kirschkern und Kirschglibber",
  "Beim Saft der letzten Kirsche",
  "Auf roten Stein und rotes Herz",
  "Bei Hugos heiligem Kirschhain",
  "Auf jede Beere, die wir pflücken",
];
const RUF_B = [
  "wir bauen höher als der Server erlaubt",
  "unsere Mauern lachen über Creeper",
  "kein Acker ist vor uns sicher",
  "unsere Elytra kennen keine Angst",
  "selbst der Enderdrache kriegt Marmelade ab",
];
const RUF_C = [
  "G0GI vor!",
  "Kirsche hoch!",
  "Rot ist, was wir bauen!",
  "für den Clan!",
  "bis zur letzten Schaufel!",
];
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

$("#rufBtn").addEventListener("click", () => {
  const box = $("#rufBox");
  box.textContent = `„${pick(RUF_A)} — ${pick(RUF_B)} ... ${pick(RUF_C)}“`;
  box.classList.remove("pop");
  void box.offsetWidth; // Animation neu triggern, ja das ist wirklich nötig
  box.classList.add("pop");
});

/* ============================================================
   TOOL 6b: Loot-Roulette
   ============================================================ */
let rouletteTimer = null;
$("#rouletteBtn").addEventListener("click", () => {
  const names = $("#rouletteNames").value
    .split(/[\n,;]+/)
    .map(n => n.trim())
    .filter(Boolean);
  const out = $("#rouletteOut");
  if (names.length < 2) {
    out.innerHTML = '<span class="tool-hint">Mindestens zwei Namen eintragen — wer soll sonst verlieren?</span>';
    return;
  }
  clearInterval(rouletteTimer);
  let ticks = 0;
  rouletteTimer = setInterval(() => {
    out.innerHTML = `🎰 <strong>${escapeHtml(pick(names))}</strong>`;
    ticks++;
    if (ticks > 12) {
      clearInterval(rouletteTimer);
      const winner = pick(names);
      out.innerHTML = `🏆 Loot geht an: <strong>${escapeHtml(winner)}</strong> — Neid ist verboten.`;
      toast(`${winner} hat das Loot-Roulette gewonnen! 🍒`);
    }
  }, 90);
});

/* ============================================================
   Bewerbungs-Formular (Frontend-Demo)
   ============================================================ */
$("#joinForm").addEventListener("submit", (ev) => {
  ev.preventDefault();
  const name = $("#joinName").value.trim() || "Niemand";
  toast(`Danke, ${name}! Bewerbung registriert … ähm, zumindest im Herzen. (Backend kommt später — bis dahin: Discord!)`, 5000);
  ev.target.reset();
});

/* ---------- Mini-XSS-Schutz für alles, was wir mit innerHTML aus Nutzereingaben bauen ---------- */
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

console.log("%c🍒 G0GI — schön, dass du in der Konsole bist. Backend kommt später.", "color:#e02546;font-weight:bold;font-size:14px");
