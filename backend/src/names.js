// Zweispachige Item-Namen: Englisch aus minecraft-data, Deutsch aus der
// offiziellen Mojang-Übersetzung (kuratiert für die gängigsten Handels-Items).
// Suche funktioniert damit auf DE und EN gleichzeitig.
"use strict";

const mcData = require("minecraft-data");
const config = require("./config");

// Offizielle deutsche Namen (de_de.json), ID ohne minecraft:-Präfix
const GERMAN = {
  // --- Blöcke & Baustoffe ---
  stone: "Stein", cobblestone: "Bruchstein", granite: "Granit", diorite: "Diorit",
  andesite: "Andesit", deepslate: "Tiefenschiefer", tuff: "Tuffstein", calcite: "Kalzit",
  dirt: "Erde", grass_block: "Grasblock", podzol: "Podsol", mycelium: "Myzel",
  sand: "Sand", red_sand: "Roter Sand", gravel: "Kies", clay: "Ton",
  oak_log: "Eichenstamm", spruce_log: "Fichtenstamm", birch_log: "Birkenstamm",
  jungle_log: "Tropenbaumstamm", acacia_log: "Akazienstamm", dark_oak_log: "Schwarzeichenstamm",
  cherry_log: "Kirschstamm", mangrove_log: "Mangrovenstamm", bamboo_block: "Bambusblock",
  oak_planks: "Eichenholzbretter", spruce_planks: "Fichtenholzbretter", birch_planks: "Birkenholzbretter",
  jungle_planks: "Tropenholzbretter", acacia_planks: "Akazienholzbretter",
  dark_oak_planks: "Schwarzeichenholzbretter", cherry_planks: "Kirschholzbretter",
  oak_leaves: "Eichenlaub", cherry_leaves: "Kirschlaub", oak_sapling: "Eichensetzling",
  cherry_sapling: "Kirschsetzling", glass: "Glas", tinted_glass: "Getöntes Glas",
  obsidian: "Obsidian", crying_obsidian: "Weinender Obsidian", bedrock: "Grundgestein",
  sandstone: "Sandstein", terracotta: "Terrakotta", white_terracotta: "Weiße Terrakotta",
  quartz_block: "Quarzblock", prismarine: "Prismarin", dark_prismarine: "Dunkler Prismarin",
  sea_lantern: "Seelaterne", glowstone: "Glowstone", shroomlight: "Pilzlicht",
  shulker_box: "Shulker-Kiste", bricks: "Ziegelsteine", stone_bricks: "Steinziegel",
  mossy_cobblestone: "Bemooster Bruchstein", mossy_stone_bricks: "Bemooste Steinziegel",
  snow_block: "Schneeblock", ice: "Eis", packed_ice: "Packeis", blue_ice: "Blaueis",
  sponge: "Schwamm", bookshelf: "Bücherregal", tnt: "TNT", chest: "Truhe",
  barrel: "Fass", ladder: "Leiter", vine: "Ranken", lily_pad: "Seerosenblatt",
  white_wool: "Weiße Wolle", red_wool: "Rote Wolle", black_wool: "Schwarze Wolle",
  honeycomb_block: "Honigwabenblock", amethyst_block: "Amethystblock",
  copper_block: "Kupferblock", dripstone_block: "Tropfsteinblock",

  // --- Erze & Materialien ---
  coal: "Kohle", charcoal: "Holzkohle", iron_ingot: "Eisenbarren", gold_ingot: "Goldbarren",
  copper_ingot: "Kupferbarren", netherite_ingot: "Netheritebarren",
  netherite_scrap: "Netheritebruchstück", diamond: "Diamant", emerald: "Smaragd",
  lapis_lazuli: "Lapislazuli", redstone: "Redstone", quartz: "Netherquarz",
  amethyst_shard: "Amethystscherbe", raw_iron: "Rohes Eisen", raw_gold: "Rohes Gold",
  raw_copper: "Rohes Kupfer", ancient_debris: "Antiker Schutt", nether_star: "Netherstern",
  echo_shard: "Echoscherbe", coal_block: "Kohleblock", iron_block: "Eisenblock",
  gold_block: "Goldblock", diamond_block: "Diamantblock", emerald_block: "Smaragdblock",
  netherite_block: "Netheriteblock", lapis_block: "Lapislazuliblock",
  redstone_block: "Redstone-Block",

  // --- Werkzeuge & Waffen ---
  wooden_sword: "Holzschwert", stone_sword: "Steinschwert", iron_sword: "Eisenschwert",
  golden_sword: "Goldschwert", diamond_sword: "Diamantschwert", netherite_sword: "Netheriteschwert",
  iron_pickaxe: "Eisenspitzhacke", diamond_pickaxe: "Diamantspitzhacke",
  netherite_pickaxe: "Netheritespitzhacke", diamond_axe: "Diamantaxt",
  netherite_axe: "Netheriteaxt", diamond_shovel: "Diamantschaufel", diamond_hoe: "Diamanthacke",
  bow: "Bogen", crossbow: "Armbrust", trident: "Dreizack", mace: "Keule",
  shield: "Schild", fishing_rod: "Angel", shears: "Schere", flint_and_steel: "Feuerzeug",
  spyglass: "Fernglas", brush: "Pinsel",

  // --- Rüstung ---
  leather_helmet: "Lederkappe", leather_chestplate: "Lederjacke",
  leather_leggings: "Lederhose", leather_boots: "Lederstiefel",
  chainmail_helmet: "Kettenhelm", chainmail_chestplate: "Kettenhemd",
  iron_helmet: "Eisenhelm", iron_chestplate: "Eisenharnisch",
  iron_leggings: "Eisenbeinschutz", iron_boots: "Eisenstiefel",
  golden_helmet: "Goldhelm", golden_chestplate: "Goldharnisch",
  diamond_helmet: "Diamanthelm", diamond_chestplate: "Diamantharnisch",
  diamond_leggings: "Diamantbeinschutz", diamond_boots: "Diamantstiefel",
  netherite_helmet: "Netheritehelm", netherite_chestplate: "Netheriteharnisch",
  netherite_leggings: "Netheritebeinschutz", netherite_boots: "Netheritestiefel",
  turtle_helmet: "Schildkrötenpanzer", wolf_armor: "Wolfspanzer",

  // --- Essen ---
  bread: "Brot", apple: "Apfel", golden_apple: "Goldener Apfel",
  enchanted_golden_apple: "Verzauberter goldener Apfel", cooked_beef: "Steak",
  cooked_porkchop: "Gebratenes Schweinefleisch", cooked_chicken: "Gebratenes Hähnchen",
  cooked_mutton: "Gebratenes Hammelfleisch", cooked_cod: "Gebratener Kabeljau",
  cooked_salmon: "Gebratener Lachs", golden_carrot: "Goldene Karotte", cake: "Kuchen",
  cookie: "Keks", pumpkin_pie: "Kürbiskuchen", sweet_berries: "Süßbeeren",
  glow_berries: "Glühbeeren", chorus_fruit: "Chorusfrucht", dried_kelp: "Getrockneter Seetang",
  mushroom_stew: "Pilzsuppe", rabbit_stew: "Kaninchenragout", beetroot_soup: "Borschtsch",

  // --- Farm & Natur ---
  wheat: "Weizen", wheat_seeds: "Weizenkörner", carrot: "Karotte", potato: "Kartoffel",
  beetroot: "Rote Bete", beetroot_seeds: "Rote-Bete-Samen", sugar_cane: "Zuckerrohr",
  cactus: "Kaktus", melon: "Melone", melon_slice: "Melonenscheibe", pumpkin: "Kürbis",
  cocoa_beans: "Kakaobohnen", nether_wart: "Netherwarze", bamboo: "Bambus",
  egg: "Ei", hay_block: "Heublock", bone_meal: "Knochenmehl", honey_bottle: "Honigflasche",
  honeycomb: "Honigwabe", sugar: "Zucker", paper: "Papier", moss_block: "Moosblock",
  spore_blossom: "Sporenblüte", flowering_azalea: "Blühende Azalee",

  // --- Mob-Drops ---
  rotten_flesh: "Verrottetes Fleisch", bone: "Knochen", string: "Faden",
  spider_eye: "Spinnenauge", gunpowder: "Schwarzpulver", ender_pearl: "Enderperle",
  eye_of_ender: "Enderauge", blaze_rod: "Lohenrute", blaze_powder: "Lohenpulver",
  ghast_tear: "Ghastträne", magma_cream: "Magmacreme", slime_ball: "Schleimball",
  leather: "Leder", feather: "Feder", ink_sac: "Tintenbeutel",
  glow_ink_sac: "Leuchttintenbeutel", phantom_membrane: "Phantomhaut",
  shulker_shell: "Shulker-Schale", dragon_breath: "Drachenatem",
  wither_skeleton_skull: "Witherskelettschädel", creeper_head: "Creeperkopf",
  zombie_head: "Zombiekopf", skeleton_skull: "Skelettschädel", piglin_head: "Piglinkopf",
  totem_of_undying: "Totem der Unsterblichkeit", experience_bottle: "Erfahrungsfläschchen",
  prismarine_shard: "Prismarinscherbe", prismarine_crystals: "Prismarinkristalle",
  nautilus_shell: "Nautilusschale", heart_of_the_sea: "Herz des Meeres",
  rabbit_hide: "Kaninchenfell", rabbit_foot: "Hasenpfote", breeze_rod: "Windrute",
  ominous_trial_key: "Unheilvoller Prüfungsschlüssel", trial_key: "Prüfungsschlüssel",
  heavy_core: "Schwerer Kern", wind_charge: "Windkapsel",

  // --- Redstone ---
  redstone_torch: "Redstone-Fackel", repeater: "Redstone-Verstärker",
  comparator: "Redstone-Komparator", piston: "Kolben", sticky_piston: "Klebriger Kolben",
  observer: "Beobachter", hopper: "Trichter", dispenser: "Werfer", dropper: "Spender",
  rail: "Schiene", powered_rail: "Antriebsschiene", activator_rail: "Aktivierungsschiene",
  detector_rail: "Sensorschiene", lever: "Hebel", slime_block: "Schleimblock",
  honey_block: "Honigblock", target: "Zielblock", daylight_detector: "Tageslichtsensor",
  note_block: "Notenblock", redstone_lamp: "Redstone-Lampe",

  // --- Teure / besondere Blöcke ---
  beacon: "Leuchtfeuer", conduit: "Aquisator", dragon_egg: "Drachenei",
  ender_chest: "Endertruhe", enchanting_table: "Zaubertisch", anvil: "Amboss",
  smithing_table: "Schmiedetisch", grindstone: "Schleifstein",
  blast_furnace: "Schmelzofen", smoker: "Räucherofen", lodestone: "Leitstein",
  respawn_anchor: "Seelenanker", end_crystal: "Enderkristall",
  decorated_pot: "Verzierter Krug", trial_spawner: "Prüfungs-Spawner",
  vault: "Tresor", budding_amethyst: "Amethystknospenblock",

  // --- Brauen & Tränke ---
  glass_bottle: "Glasflasche", brewing_stand: "Braustand", cauldron: "Kessel",
  fermented_spider_eye: "Fermentiertes Spinnenauge",
  glistering_melon_slice: "Glitzernde Melonenscheibe", water_bottle: "Wasserflasche",
  potion: "Trank", splash_potion: "Wurftrank", lingering_potion: "Verweiltrank",

  // --- Sonstiges ---
  book: "Buch", enchanted_book: "Verzaubertes Buch", writable_book: "Buch und Feder",
  map: "Karte", filled_map: "Karte", compass: "Kompass", recovery_compass: "Bergungskompass",
  clock: "Uhr", bucket: "Eimer", water_bucket: "Wassereimer", lava_bucket: "Lavaeimer",
  milk_bucket: "Milcheimer", powder_snow_bucket: "Pulverschneeeimer",
  name_tag: "Namensschild", saddle: "Sattel", lead: "Leine",
  crafting_table: "Werkbank", furnace: "Ofen", torch: "Fackel", soul_torch: "Seelenfackel",
  lantern: "Laterne", soul_lantern: "Seelenlaterne", bundle: "Bündel",
  firework_rocket: "Feuerwerksrakete", firework_star: "Feuerwerksstern",
  music_disc_cat: "Schallplatte (Cat)", music_disc_pigstep: "Schallplatte (Pigstep)",
  music_disc_otherside: "Schallplatte (Otherside)", music_disc_5: "Schallplatte (5)",
  goat_horn: "Bockshorn", elytra: "Elytren", end_rod: "Endstab",
  chorus_flower: "Chorusblüte", end_stone: "Endstein", purpur_block: "Purpurblock",
  scaffolding: "Baugerüst",

  // --- Spawner-Kram (häufig auf Economy-Servern) ---
  spawner: "Spawner",
};

let mcItems = null;
function getMcItems() {
  if (!mcItems) {
    try {
      mcItems = mcData(config.version).itemsArray;
    } catch {
      // Version unbekannt → auf eine bekannte ausweichen
      mcItems = mcData("1.21.1").itemsArray;
    }
  }
  return mcItems;
}

let mcEffects = null;
function getMcEffects() {
  if (!mcEffects) {
    try { mcEffects = mcData(config.version).effectsArray || []; }
    catch { mcEffects = mcData("1.21.1").effectsArray || []; }
  }
  return mcEffects;
}

// Verzauberungs-Namen EN/DE (die gängigsten auf dem Server)
const ENCHANTS = {
  mending: ["Mending", "Reparatur"], protection: ["Protection", "Schutz"],
  fire_protection: ["Fire Protection", "Feuerschutz"], blast_protection: ["Blast Protection", "Explosionsschutz"],
  projectile_protection: ["Projectile Protection", "Schusssicherung"], unbreaking: ["Unbreaking", "Haltbarkeit"],
  efficiency: ["Efficiency", "Effizienz"], fortune: ["Fortune", "Glück"], silk_touch: ["Silk Touch", "Behutsamkeit"],
  sharpness: ["Sharpness", "Schärfe"], smite: ["Smite", "Bann"], knockback: ["Knockback", "Rückstoß"],
  fire_aspect: ["Fire Aspect", "Verbrennung"], looting: ["Looting", "Plünderung"],
  sweeping_edge: ["Sweeping Edge", "Schwungkraft"], power: ["Power", "Stärke"], punch: ["Punch", "Schlag"],
  flame: ["Flame", "Flamme"], infinity: ["Infinity", "Unendlichkeit"],
  feather_falling: ["Feather Falling", "Federfall"], depth_strider: ["Depth Strider", "Wasserläufer"],
  respiration: ["Respiration", "Atmung"], aqua_affinity: ["Aqua Affinity", "Wasseraffinität"],
  swift_sneak: ["Swift Sneak", "Huschendes Schleichen"], riptide: ["Riptide", "Sog"],
  loyalty: ["Loyalty", "Treue"], impaling: ["Impaling", "Harpune"],
  wind_burst: ["Wind Burst", "Windstoß"], density: ["Density", "Dichte"], breach: ["Breach", "Durchbruch"],
  luck_of_the_sea: ["Luck of the Sea", "Glück des Meeres"], lure: ["Lure", "Köder"],
};
const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
const lvl = (n) => ROMAN[parseInt(n, 10)] || n;

// "minecraft:diamond_pickaxe/efficiency:5+mending:1" → "diamond_pickaxe"
function keyBase(key) {
  return String(key).replace(/^minecraft:/, "").split("/")[0].split(":")[0];
}
// "…/efficiency:5+mending:1" → "efficiency:5+mending:1"
function keyVariant(key) {
  const m = String(key).match(/\/(.+)$/);
  return m ? m[1] : null;
}

// lesbares Label für den Varianten-Anhang, z. B. "Effizienz V, Reparatur I"
function variantLabels(key) {
  const v = keyVariant(key);
  if (!v) return null;
  const en = [], de = [];
  for (const part of v.split("+")) {
    const [id, level] = part.split(":");
    if (id === "mending" || ENCHANTS[id]) {
      const e = ENCHANTS[id] || [id, id];
      en.push(`${e[0]} ${level ? lvl(level) : ""}`.trim());
      de.push(`${e[1]} ${level ? lvl(level) : ""}`.trim());
    } else if (/^p\d+$/.test(id) || /^f\d+$/.test(id)) {
      // Trank-/Feuerwerk-Code: Effekt-Name nachschlagen, sonst roh
      const effId = parseInt(id.slice(1), 10);
      const eff = getMcEffects().find((x) => x.id === effId);
      en.push(eff ? eff.displayName : id);
      de.push(eff ? eff.displayName : id);
    } else {
      en.push(id); de.push(id);
    }
  }
  return { en: en.join(", "), de: de.join(", ") };
}

// "minecraft:diamond_sword" → "diamond_sword"
function normalizeId(name) {
  if (!name) return null;
  return String(name).replace(/^minecraft:/, "").toLowerCase();
}

// Namen zu einem Item-Key liefern (auch für Varianten-Keys wie
// "diamond_pickaxe/efficiency:5" oder "minecraft:x")
function getNames(key) {
  const id = keyBase(key);
  const item = getMcItems().find((i) => i.name === id);
  const v = variantLabels(key);
  return {
    en: item ? (v ? `${item.displayName} (${v.en})` : item.displayName) : id.replace(/_/g, " "),
    de: GERMAN[id] ? (v ? `${GERMAN[id]} (${v.de})` : GERMAN[id]) : GERMAN[id] || null,
  };
}

// Alle bekannten Items für den Suchindex (EN + DE)
function buildIndex() {
  const idx = [];
  const seen = new Set();

  for (const item of getMcItems()) {
    const de = GERMAN[item.name];
    const hay = [item.name.replace(/_/g, " "), item.displayName, de || ""]
      .join(" ")
      .toLowerCase();
    idx.push({ key: `minecraft:${item.name}`, en: item.displayName, de, hay });
    seen.add(item.name);
  }
  // reine DE-Einträge, die minecraft-data evtl. nicht kennt
  for (const [id, de] of Object.entries(GERMAN)) {
    if (!seen.has(id)) {
      idx.push({ key: `minecraft:${id}`, en: id.replace(/_/g, " "), de, hay: `${id.replace(/_/g, " ")} ${de}`.toLowerCase() });
    }
  }
  return idx;
}

module.exports = { GERMAN, normalizeId, getNames, buildIndex, keyBase, keyVariant, variantLabels };
