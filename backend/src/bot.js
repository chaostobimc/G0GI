// Der Mineflayer-Bot: joinen, Regeln zustimmen, rumstehen, scannen lassen.
//
// Regel-Compliance: Der Bot farmt KEINE Währung und bewegt sich nicht.
// Er steht nach dem Spawnen einfach nur da und liest regelmäßig /ah und /order.
//
// WICHTIG (HugoSMP): Der Server hält Spieler nach dem Login evtl. in einem
// Limbo-Zustand, bis die Regeln bestätigt sind — das spawn-Event kommt dann
// erst NACH der Bestätigung. Deshalb läuft die Regeln-Logik ab 'login' und
// ein globaler Fenster-Listener klickt den Akzeptieren-Button, sobald er da ist.
"use strict";

const mineflayer = require("mineflayer");
const config = require("./config");
const parsers = require("./parsers");

const state = {
  status: "offline",       // offline | connecting | limbo | spawned | error
  lastError: null,
  joinedAt: null,
  bot: null,
  rulesAccepted: false,
};

const ACCEPT_PATTERNS = [
  /(akzeptier|zustimm|annehm|einverstanden|bestätig|regeln\s*(gelesen|akzept)|confirm|accept|agree|i\s*agree|yes|ja)\b/i,
  /^[✔✅✓]$/,
];
const ACCEPT_ITEM_NAMES = ["emerald", "lime_concrete", "lime_wool", "lime_terracotta", "green_terracotta"];

function setState(s, err = null) {
  state.status = s;
  if (err) state.lastError = err;
  console.log(`[bot] status: ${s}${err ? " · " + err : ""}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function createBot() {
  setState("connecting");

  const opts = {
    host: config.host,
    port: config.port,
    username: config.username,
    version: config.version,
    hideErrors: false,
    checkTimeoutInterval: 60_000,
  };
  if (config.auth === "microsoft") opts.auth = "microsoft";

  const bot = mineflayer.createBot(opts);
  state.bot = bot;

  /* ---------- Login (auch ohne Spawn, falls Limbo) ---------- */
  bot.once("login", async () => {
    setState("limbo");
    state.joinedAt = Date.now();
    console.log(`[bot] eingeloggt auf ${config.host} als ${bot.username} — warte auf Spawn/Regeln`);

    if (config.antiAfk) startAntiAfk(bot);

    // Globaler Listener: sobald IRGENDEIN Fenster mit Akzeptieren-Button
    // aufgeht (Regeln-GUI), klicken — egal ob vor oder nach dem Spawn.
    bot.on("windowOpen", (win) => {
      maybeClickAccept(bot, win).catch((e) =>
        console.log(`[bot] Accept-Klick fehlgeschlagen: ${e.message}`)
      );
    });

    // aktiver Versuch: /rules ausführen
    await sleep(2000);
    try {
      await agreeToRules(bot);
    } catch (e) {
      console.log(`[bot] Regeln-Versuch 1: ${e.message} — warte auf GUI/Spawn`);
    }

    // Fallback: falls nach 20 s immer noch keine Bestätigung, erneut versuchen
    setTimeout(async () => {
      if (!state.rulesAccepted) {
        try { await agreeToRules(bot); } catch {}
      }
    }, 20_000);
  });

  bot.once("spawn", async () => {
    setState("spawned");
    console.log("[bot] gespawnt — vollständig auf dem Server");
    if (!state.rulesAccepted) {
      try { await agreeToRules(bot); } catch {}
    }
  });

  bot.on("kicked", (reason) => {
    setState("error", typeof reason === "string" ? reason : JSON.stringify(reason));
  });
  bot.on("error", (err) => setState("error", err.message));
  bot.on("end", (reason) => {
    if (state.status !== "error") setState("offline", reason);
  });

  return bot;
}

/* ---------- Akzeptieren-Button in einem Fenster finden & klicken ---------- */
async function maybeClickAccept(bot, win) {
  await sleep(300); // Slots erst setzen lassen
  const guiCount = Math.max(0, win.slots.length - 36);
  for (let i = 0; i < guiCount; i++) {
    const slot = win.slots[i];
    if (!slot || !slot.name || slot.name === "air") continue;
    const display = parsers.readDisplay(slot);
    const name = display.name || "";
    const looksAccept =
      ACCEPT_PATTERNS.some((re) => re.test(name)) ||
      (ACCEPT_ITEM_NAMES.includes(slot.name) && ACCEPT_PATTERNS.some((re) => re.test(display.lore.join(" "))));
    if (looksAccept) {
      console.log(`[bot] Regeln-Button gefunden: "${name}" (Slot ${i}) — klicke.`);
      await bot.clickWindow(i, 0, 0);
      state.rulesAccepted = true;
      await sleep(600);
      if (bot.currentWindow) { try { bot.closeWindow(bot.currentWindow); } catch {} }
      return true;
    }
  }
  return false;
}

/* ---------- Regeln aktiv anstoßen ---------- */
async function agreeToRules(bot) {
  if (config.rulesCommand) {
    bot.chat(config.rulesCommand);
    await sleep(1200);
  }
  // optional: festen Bestätigungs-Text senden, falls der Server das erwartet
  if (config.rulesAcceptChat) {
    bot.chat(config.rulesAcceptChat);
    await sleep(800);
  }
  // wenn gerade ein Fenster offen ist: direkt drin suchen
  if (bot.currentWindow) {
    await maybeClickAccept(bot, bot.currentWindow);
  }
}

/* ---------- sanftes Anti-AFK (kein Farmen, nur nicht gekickt werden) ---------- */
function startAntiAfk(bot) {
  setInterval(() => {
    if (state.status === "offline" || state.status === "error") return;
    try {
      bot.swingArm();
      const yaw = (bot.entity ? bot.entity.yaw : 0) + 0.15;
      const pitch = bot.entity ? bot.entity.pitch : 0;
      if (bot.look) bot.look(yaw, pitch, false).catch(() => {});
    } catch {}
  }, 4 * 60 * 1000);
}

module.exports = { createBot, state };
