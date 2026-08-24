// Der Mineflayer-Bot: joinen, Regeln zustimmen, rumstehen, scannen lassen.
//
// Regel-Compliance: Der Bot farmt KEINE Währung und bewegt sich nicht.
// Er steht nach dem Spawnen einfach nur da und liest regelmäßig /ah und /order.
"use strict";

const mineflayer = require("mineflayer");
const config = require("./config");
const parsers = require("./parsers");

const state = {
  status: "offline",       // offline | connecting | spawned | scanning | error
  lastError: null,
  joinedAt: null,
  bot: null,
};

const ACCEPT_PATTERNS = [
  /(akzeptier|zustimm|annehm|einverstanden|bestätig|confirm|accept|agree|yes|ja)\b/i,
  /^[✔✅✓]$/,
];
const ACCEPT_ITEM_NAMES = ["emerald", "lime_concrete", "lime_wool", "lime_terracotta", "green_terracotta"];

function setState(s, err = null) {
  state.status = s;
  if (err) state.lastError = err;
  console.log(`[bot] status: ${s}${err ? " · " + err : ""}`);
}

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

  bot.once("spawn", async () => {
    setState("spawned");
    state.joinedAt = Date.now();
    console.log(`[bot] gespawnt auf ${config.host} als ${bot.username}`);

    // Regeln: Kommando ausführen und den Bestätigungs-Button klicken.
    try { await agreeToRules(bot); } catch (e) {
      console.log(`[bot] Regeln-Bestätigung: ${e.message} (läuft ohne weiter)`);
    }

    // Danach: einfach nur rumstehen.
    if (config.antiAfk) startAntiAfk(bot);
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

/* ---------- Regeln akzeptieren ---------- */
async function agreeToRules(bot) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  await sleep(1500); // kurz ankommen

  if (config.rulesCommand) {
    bot.chat(config.rulesCommand);
    await sleep(1200);
  }

  // Bis zu 15 Sekunden warten, ob ein Regeln-GUI auf geht
  const window = await new Promise((resolve) => {
    if (bot.currentWindow) return resolve(bot.currentWindow);
    const t = setTimeout(() => {
      bot.removeListener("windowOpen", onOpen);
      resolve(null);
    }, 15_000);
    const onOpen = (win) => { clearTimeout(t); resolve(win); };
    bot.on("windowOpen", onOpen);
  });

  if (!window) return;

  const clickAccept = async (win) => {
    const guiCount = Math.max(0, win.slots.length - 36);
    for (let i = 0; i < guiCount; i++) {
      const slot = win.slots[i];
      if (!slot || !slot.name || slot.name === "air") continue;
      const display = parsers.readDisplay(slot);
      const name = display.name || "";
      const looksAccept =
        ACCEPT_PATTERNS.some((re) => re.test(name)) ||
        ACCEPT_ITEM_NAMES.includes(slot.name);
      if (looksAccept) {
        console.log(`[bot] Regeln-Button gefunden: "${name}" (Slot ${i}) — klicke.`);
        await bot.clickWindow(i, 0, 0);
        await sleep(600);
        if (bot.currentWindow) { try { bot.closeWindow(bot.currentWindow); } catch {} }
        return true;
      }
    }
    return false;
  };

  await clickAccept(window);
}

/* ---------- sanftes Anti-AFK (kein Farmen, nur nicht gekickt werden) ---------- */
function startAntiAfk(bot) {
  setInterval(() => {
    if (state.status !== "spawned") return;
    try {
      bot.swingArm();
      // minimal umschauen, ohne die Position zu verlassen
      const yaw = (bot.entity.yaw || 0) + 0.15;
      bot.look(yaw, bot.entity.pitch || 0, false).catch(() => {});
    } catch {}
  }, 4 * 60 * 1000);
}

module.exports = { createBot, state };
