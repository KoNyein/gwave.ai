#!/usr/bin/env node
/**
 * Generates supabase/seed/knowledge_seed.sql — 200 cannabis strains and
 * 100 minerals/metals. Strain attributes are derived deterministically from
 * the strain name (stable across runs); mineral data is curated real-world
 * reference data.
 *
 * Run: node scripts/generate-knowledge-seed.mjs
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "supabase",
  "seed",
  "knowledge_seed.sql",
);

// --- deterministic helpers --------------------------------------------------

function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick(list, seed, count) {
  const chosen = [];
  let cursor = seed;
  const pool = [...list];
  for (let i = 0; i < count && pool.length > 0; i += 1) {
    cursor = (Math.imul(cursor, 1103515245) + 12345) >>> 0;
    chosen.push(pool.splice(cursor % pool.length, 1)[0]);
  }
  return chosen;
}

function between(seed, min, max, step = 1) {
  const span = Math.floor((max - min) / step) + 1;
  return min + ((seed >>> 0) % span) * step;
}

function q(text) {
  return `'${String(text).replace(/'/g, "''")}'`;
}

function arr(items) {
  return `array[${items.map(q).join(", ")}]::text[]`;
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/#/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// --- strains -----------------------------------------------------------------

const EFFECTS = [
  "relaxed", "happy", "euphoric", "uplifted", "sleepy", "creative",
  "focused", "energetic", "talkative", "giggly", "hungry", "tingly",
];
const FLAVORS = [
  "earthy", "sweet", "citrus", "pine", "berry", "diesel", "skunk",
  "grape", "lemon", "tropical", "spicy", "herbal", "woody", "vanilla",
  "mint", "mango", "floral", "pepper", "cheese", "apple",
];
const TERPENES = [
  "myrcene", "limonene", "caryophyllene", "pinene", "linalool",
  "humulene", "terpinolene", "ocimene",
];

// [name, type] — i = indica, s = sativa, h = hybrid
const STRAINS = [
  ["OG Kush", "h"], ["Sour Diesel", "s"], ["Blue Dream", "h"],
  ["Girl Scout Cookies", "h"], ["Granddaddy Purple", "i"],
  ["White Widow", "h"], ["AK-47", "h"], ["Northern Lights", "i"],
  ["Pineapple Express", "h"], ["Jack Herer", "s"], ["Green Crack", "s"],
  ["Gorilla Glue #4", "h"], ["Gelato", "h"], ["Wedding Cake", "h"],
  ["Zkittlez", "i"], ["Runtz", "h"], ["Purple Punch", "i"],
  ["Durban Poison", "s"], ["Trainwreck", "h"], ["Bubba Kush", "i"],
  ["Skywalker OG", "i"], ["Chemdawg", "h"], ["Super Silver Haze", "s"],
  ["Amnesia Haze", "s"], ["Maui Wowie", "s"], ["Strawberry Cough", "s"],
  ["Cherry Pie", "h"], ["Do-Si-Dos", "i"], ["Sunset Sherbet", "h"],
  ["Forbidden Fruit", "i"], ["Banana Kush", "h"], ["Blueberry", "i"],
  ["Super Lemon Haze", "s"], ["Lemon Haze", "s"], ["Tangie", "s"],
  ["Clementine", "s"], ["Mimosa", "h"], ["GMO Cookies", "i"],
  ["Animal Cookies", "h"], ["Thin Mint GSC", "h"], ["Platinum GSC", "h"],
  ["Biscotti", "i"], ["Cereal Milk", "h"], ["Apple Fritter", "h"],
  ["Miracle Alien Cookies", "h"], ["Ice Cream Cake", "i"],
  ["Jealousy", "h"], ["Gushers", "h"], ["White Runtz", "h"],
  ["Pink Runtz", "h"], ["Blue Cookies", "h"], ["Cookies and Cream", "h"],
  ["Gelato 41", "h"], ["Gelato 33", "h"], ["Larry OG", "h"],
  ["Fire OG", "h"], ["Tahoe OG", "h"], ["SFV OG", "h"],
  ["King Louis XIII", "i"], ["Master Kush", "i"], ["Hindu Kush", "i"],
  ["Afghan Kush", "i"], ["Purple Kush", "i"], ["Critical Kush", "i"],
  ["Bubble Gum", "h"], ["Cheese", "h"], ["Blue Cheese", "i"],
  ["UK Cheese", "h"], ["Skunk #1", "h"], ["Super Skunk", "i"],
  ["Island Sweet Skunk", "s"], ["Sour OG", "h"], ["Headband", "h"],
  ["LA Confidential", "i"], ["God's Gift", "i"], ["Blackberry Kush", "i"],
  ["Purple Urkle", "i"], ["Grape Ape", "i"], ["Mendo Breath", "i"],
  ["Peanut Butter Breath", "h"], ["Garlic Cookies", "i"],
  ["Motorbreath", "i"], ["Sundae Driver", "h"], ["Wedding Crasher", "h"],
  ["Slurricane", "i"], ["Kush Mints", "h"], ["Animal Mints", "h"],
  ["London Pound Cake", "i"], ["Lemon Cherry Gelato", "h"],
  ["Georgia Pie", "h"], ["Cheetah Piss", "h"], ["Gary Payton", "h"],
  ["Oreoz", "h"], ["Grease Monkey", "h"], ["Mochi", "h"],
  ["Zookies", "h"], ["Han Solo Burger", "h"], ["Divorce Cake", "h"],
  ["Rainbow Belts", "h"], ["Candy Rain", "h"], ["Permanent Marker", "h"],
  ["RS11", "h"], ["Studio 54", "h"], ["Super Boof", "h"],
  ["Blue Zushi", "h"], ["Pave", "h"], ["Bacio Gelato", "h"],
  ["Sherb Cream Pie", "h"], ["White Truffle", "i"], ["Truffle Butter", "i"],
  ["Purple Haze", "s"], ["Acapulco Gold", "s"], ["Panama Red", "s"],
  ["Colombian Gold", "s"], ["Thai Stick", "s"], ["Chocolate Thai", "s"],
  ["Malawi Gold", "s"], ["Lamb's Bread", "s"], ["Red Congolese", "s"],
  ["Ghost Train Haze", "s"], ["Moby Dick", "s"], ["Candyland", "s"],
  ["Chocolope", "s"], ["Golden Goat", "s"], ["Cinex", "s"],
  ["Harlequin", "s"], ["ACDC", "h"], ["Charlotte's Web", "s"],
  ["Cannatonic", "h"], ["Ringo's Gift", "h"], ["Harle-Tsu", "h"],
  ["Sour Tsunami", "h"], ["CBD Critical Mass", "i"], ["Pennywise", "i"],
  ["Stephen Hawking Kush", "i"], ["Critical Mass", "i"],
  ["Big Bud", "i"], ["Chronic", "h"], ["White Rhino", "i"],
  ["Romulan", "i"], ["Sensi Star", "i"], ["Hash Plant", "i"],
  ["Afghani", "i"], ["Pakistani Chitral Kush", "i"], ["Mazar", "i"],
  ["Herijuana", "i"], ["Ice Wreck", "h"], ["White Fire OG", "h"],
  ["Stardawg", "h"], ["Snowman", "h"], ["The White", "h"],
  ["Triangle Kush", "i"], ["Josh D OG", "i"], ["Ghost OG", "h"],
  ["Banana OG", "i"], ["Lemon Tree", "h"], ["Lemon Skunk", "h"],
  ["Grapefruit", "s"], ["Orange Cookies", "h"], ["Agent Orange", "h"],
  ["Tropicana Cookies", "s"], ["Sour Tangie", "s"], ["XJ-13", "h"],
  ["J1", "h"], ["Allen Wrench", "s"], ["NYC Diesel", "s"],
  ["East Coast Sour Diesel", "s"], ["Chem 91", "h"], ["Chem 4", "h"],
  ["Alien OG", "h"], ["Space Queen", "h"], ["Tangerine Dream", "h"],
  ["Vortex", "s"], ["Jack the Ripper", "s"], ["Qrazy Train", "h"],
  ["Querkle", "i"], ["Plushberry", "i"], ["Dutch Treat", "h"],
  ["Snoop's Dream", "i"], ["Blue Magoo", "i"], ["Berry White", "i"],
  ["White Berry", "i"], ["Black Domina", "i"], ["Nebula", "h"],
  ["Kali Mist", "s"], ["Destroyer", "s"], ["Neville's Haze", "s"],
  ["Mango Kush", "i"], ["Papaya", "i"], ["Strawberry Banana", "h"],
  ["Banana Split", "h"], ["Melonade", "s"], ["Watermelon Zkittlez", "i"],
  ["Cherry Gelato", "h"], ["Black Cherry Soda", "h"],
  ["Pink Panties", "i"], ["Bacon Strips", "i"], ["Donny Burger", "h"],
  ["MAC 1", "h"], ["Cap Junky", "h"], ["Apples and Bananas", "h"],
  ["Point Break", "h"], ["Trop Cherry", "s"], ["Cherry Popperz", "h"],
  ["Gastro Pop", "h"], ["Devil Driver", "h"], ["Sour Garlic Cookies", "h"],
];

const CBD_RICH = new Set([
  "Harlequin", "ACDC", "Charlotte's Web", "Cannatonic", "Ringo's Gift",
  "Harle-Tsu", "Sour Tsunami", "CBD Critical Mass", "Pennywise",
  "Stephen Hawking Kush",
]);

const TYPE_NAME = { i: "indica", s: "sativa", h: "hybrid" };

const STRAIN_BLURB = {
  indica:
    "An indica known for deep body relaxation, best reserved for evenings and lazy nights in.",
  sativa:
    "A sativa prized for its energizing, cerebral lift that suits daytime creativity and social sessions.",
  hybrid:
    "A balanced hybrid offering the best of both worlds — a smooth head high that settles into gentle body calm.",
};

// Expand the curated classics into a ~2000-strain catalogue. Real strain names
// pair a modifier with a base; we combine them deterministically so the extra
// entries are unique and plausible. Type is derived from the name hash so the
// same name always maps to the same indica/sativa/hybrid.
const NAME_PREFIX = [
  "Blue", "Purple", "Green", "White", "Pink", "Black", "Golden", "Silver",
  "Northern", "Sour", "Sweet", "Super", "Lemon", "Cherry", "Grape",
  "Strawberry", "Banana", "Mango", "Orange", "Frosted", "Platinum", "Royal",
  "Crystal", "Ghost", "Diamond", "Alien", "Cosmic", "Tropical", "Island",
  "Mountain", "Jungle", "Arctic", "Desert", "Electric", "Atomic", "Mystic",
  "Holy", "Dragon", "Tiger", "Panther", "Gorilla", "Wild", "Frozen", "Amber",
  "Ruby", "Emerald", "Jade", "Velvet", "Midnight", "Solar", "Lunar", "Crimson",
  "Neon", "Turbo", "Mega", "Ultra", "Double", "Triple", "Rainbow", "Sunset",
];
const NAME_BASE = [
  "Kush", "Haze", "Diesel", "OG", "Widow", "Dream", "Punch", "Cookies",
  "Gelato", "Runtz", "Cake", "Glue", "Skunk", "Cheese", "Berry", "Trainwreck",
  "Express", "Lights", "Poison", "Fire", "Frost", "Fuel", "Gas", "Sherbet",
  "Crack", "Mist", "Storm", "Thunder", "Breath", "Gushers", "Tangie", "Mimosa",
  "Biscotti", "Sorbet", "Wreck", "Bomb", "Rocket", "Star", "Cloud", "Wave",
  "Rush", "Bliss", "Fusion", "Blossom", "Nectar", "Crush", "Splash", "Cream",
];
const STRAIN_CODES = ["i", "s", "h"];
const TARGET_STRAINS = 2000;

const ALL_STRAINS = (() => {
  const seen = new Set(STRAINS.map(([n]) => n));
  const out = STRAINS.slice();
  outer: for (const p of NAME_PREFIX) {
    for (const b of NAME_BASE) {
      const name = `${p} ${b}`;
      if (seen.has(name)) continue;
      seen.add(name);
      out.push([name, STRAIN_CODES[hash(name) % 3]]);
      if (out.length >= TARGET_STRAINS) break outer;
    }
  }
  return out;
})();

function strainRow([name, code]) {
  const type = TYPE_NAME[code];
  const seed = hash(name);
  const cbdRich = CBD_RICH.has(name);

  const thc = cbdRich
    ? between(seed, 40, 90) / 10
    : between(seed, 140, code === "h" ? 280 : 250) / 10;
  const cbd = cbdRich ? between(seed >>> 3, 80, 160) / 10 : between(seed >>> 3, 1, 12) / 10;
  const effects = pick(EFFECTS, seed, 3 + (seed % 3));
  const flavors = pick(FLAVORS, seed >>> 5, 3);
  const terpenes = pick(TERPENES, seed >>> 9, 3);
  const difficulty = ["easy", "moderate", "hard"][seed % 3];
  const flowering =
    code === "i"
      ? between(seed >>> 2, 7, 9)
      : code === "s"
        ? between(seed >>> 2, 9, 12)
        : between(seed >>> 2, 8, 10);
  const yieldIndoor = `${between(seed >>> 4, 350, 550, 25)}-${between(seed >>> 4, 350, 550, 25) + 100} g/m²`;
  const yieldOutdoor = `${between(seed >>> 6, 450, 750, 50)}-${between(seed >>> 6, 450, 750, 50) + 150} g/plant`;
  const description = `${name} — ${STRAIN_BLURB[type]} Expect ${flavors.join(", ")} flavors with dominant ${terpenes[0]}, most often leaving users feeling ${effects.slice(0, 2).join(" and ")}.${cbdRich ? " A CBD-rich cultivar favored for therapeutic use with minimal intoxication." : ""}`;

  return `(${q(name)}, ${q(slugify(name))}, ${q(type)}, ${thc.toFixed(1)}, ${cbd.toFixed(1)}, ${arr(effects)}, ${arr(flavors)}, ${arr(terpenes)}, ${q(difficulty)}, ${flowering}, ${q(yieldIndoor)}, ${q(yieldOutdoor)}, ${q(description)})`;
}

// --- minerals ----------------------------------------------------------------
// [name, symbol/formula, category, mohs, density g/cm3, uses[], extraProps]

const MINERALS = [
  ["Quartz", "SiO2", "Silicate", 7, 2.65, ["glassmaking", "electronics", "jewelry"], { crystal_system: "trigonal", luster: "vitreous" }],
  ["Feldspar", "KAlSi3O8", "Silicate", 6, 2.56, ["ceramics", "glassmaking"], { crystal_system: "monoclinic" }],
  ["Muscovite", "KAl2(AlSi3O10)(OH)2", "Silicate", 2.5, 2.82, ["electrical insulation", "cosmetics"], { luster: "pearly" }],
  ["Biotite", "K(Mg,Fe)3AlSi3O10(OH)2", "Silicate", 2.75, 3.09, ["insulation", "drilling fluid"], {}],
  ["Olivine", "(Mg,Fe)2SiO4", "Silicate", 6.75, 3.32, ["refractory sand", "gemstone (peridot)"], { color: "olive green" }],
  ["Augite", "(Ca,Na)(Mg,Fe,Al)(Si,Al)2O6", "Silicate", 5.75, 3.4, ["rock-forming mineral"], {}],
  ["Hornblende", "Ca2(Mg,Fe,Al)5(Al,Si)8O22(OH)2", "Silicate", 5.5, 3.2, ["aggregate"], {}],
  ["Kaolinite", "Al2Si2O5(OH)4", "Silicate", 2.25, 2.6, ["ceramics", "paper coating", "cosmetics"], {}],
  ["Talc", "Mg3Si4O10(OH)2", "Silicate", 1, 2.75, ["talcum powder", "lubricants", "ceramics"], { note: "softest mineral (Mohs 1)" }],
  ["Garnet", "X3Y2(SiO4)3", "Silicate", 7, 3.9, ["abrasives", "waterjet cutting", "gemstone"], {}],
  ["Zircon", "ZrSiO4", "Silicate", 7.5, 4.65, ["gemstone", "zirconium ore", "radiometric dating"], {}],
  ["Beryl", "Be3Al2Si6O18", "Silicate", 7.75, 2.76, ["beryllium ore", "gemstone (emerald, aquamarine)"], {}],
  ["Tourmaline", "complex borosilicate", "Silicate", 7, 3.06, ["gemstone", "pressure sensors"], { property: "piezoelectric" }],
  ["Topaz", "Al2SiO4(F,OH)2", "Silicate", 8, 3.55, ["gemstone", "Mohs reference"], { note: "Mohs hardness reference 8" }],
  ["Epidote", "Ca2(Al,Fe)3(SiO4)3(OH)", "Silicate", 6.5, 3.45, ["collector mineral"], {}],
  ["Serpentine", "Mg3Si2O5(OH)4", "Silicate", 3.5, 2.55, ["ornamental stone", "historic asbestos source"], {}],
  ["Chlorite", "(Mg,Fe)3(Si,Al)4O10(OH)2", "Silicate", 2.25, 2.65, ["rock-forming mineral"], {}],
  ["Andalusite", "Al2SiO5", "Silicate", 7, 3.15, ["refractories", "spark plugs"], {}],
  ["Kyanite", "Al2SiO5", "Silicate", 5.5, 3.6, ["refractories", "ceramics"], { note: "hardness varies by direction" }],
  ["Sillimanite", "Al2SiO5", "Silicate", 7, 3.24, ["refractories"], {}],
  ["Staurolite", "Fe2Al9O6(SiO4)4(O,OH)2", "Silicate", 7.25, 3.75, ["collector mineral (fairy crosses)"], {}],
  ["Sodalite", "Na8Al6Si6O24Cl2", "Silicate", 5.75, 2.29, ["ornamental stone"], { color: "royal blue" }],
  ["Lazurite", "Na3CaAl3Si3O12S", "Silicate", 5.25, 2.4, ["lapis lazuli pigment", "jewelry"], {}],
  ["Nepheline", "(Na,K)AlSiO4", "Silicate", 5.75, 2.6, ["glass", "ceramics"], {}],
  ["Leucite", "KAlSi2O6", "Silicate", 5.75, 2.47, ["potassium fertilizer source"], {}],
  ["Wollastonite", "CaSiO3", "Silicate", 4.75, 2.9, ["ceramics", "plastics filler"], {}],
  ["Rhodonite", "MnSiO3", "Silicate", 5.75, 3.6, ["ornamental stone"], { color: "rose pink" }],
  ["Prehnite", "Ca2Al2Si3O10(OH)2", "Silicate", 6.25, 2.87, ["gemstone"], {}],
  ["Calcite", "CaCO3", "Carbonate", 3, 2.71, ["cement", "soil treatment", "optics"], { property: "strong birefringence" }],
  ["Aragonite", "CaCO3", "Carbonate", 3.75, 2.93, ["aquarium substrate", "collector mineral"], {}],
  ["Dolomite", "CaMg(CO3)2", "Carbonate", 3.75, 2.85, ["construction stone", "magnesium source"], {}],
  ["Magnesite", "MgCO3", "Carbonate", 4, 3.0, ["refractories", "magnesium ore"], {}],
  ["Siderite", "FeCO3", "Carbonate", 3.75, 3.96, ["iron ore"], {}],
  ["Rhodochrosite", "MnCO3", "Carbonate", 3.75, 3.7, ["manganese ore", "gemstone"], { color: "rose red" }],
  ["Smithsonite", "ZnCO3", "Carbonate", 4.5, 4.45, ["zinc ore", "collector mineral"], {}],
  ["Malachite", "Cu2CO3(OH)2", "Carbonate", 3.75, 4.0, ["copper ore", "ornamental stone", "pigment"], { color: "banded green" }],
  ["Azurite", "Cu3(CO3)2(OH)2", "Carbonate", 3.75, 3.83, ["copper ore", "historic blue pigment"], { color: "azure blue" }],
  ["Cerussite", "PbCO3", "Carbonate", 3.25, 6.55, ["lead ore"], {}],
  ["Gypsum", "CaSO4·2H2O", "Sulfate", 2, 2.32, ["plaster", "drywall", "cement retarder"], { note: "Mohs reference 2" }],
  ["Anhydrite", "CaSO4", "Sulfate", 3.25, 2.97, ["cement", "soil conditioner"], {}],
  ["Barite", "BaSO4", "Sulfate", 3.25, 4.48, ["drilling mud", "radiology contrast"], { note: "unusually dense for a light-colored mineral" }],
  ["Celestine", "SrSO4", "Sulfate", 3.25, 3.96, ["strontium ore", "fireworks"], { color: "sky blue" }],
  ["Epsomite", "MgSO4·7H2O", "Sulfate", 2.25, 1.67, ["epsom salt", "agriculture"], {}],
  ["Halite", "NaCl", "Halide", 2.25, 2.17, ["table salt", "road de-icing", "chemical feedstock"], { taste: "salty" }],
  ["Fluorite", "CaF2", "Halide", 4, 3.18, ["flux in steelmaking", "optics", "hydrofluoric acid"], { note: "Mohs reference 4; often fluorescent" }],
  ["Sylvite", "KCl", "Halide", 2, 1.99, ["potash fertilizer"], {}],
  ["Cryolite", "Na3AlF6", "Halide", 2.5, 2.97, ["aluminum smelting flux"], {}],
  ["Apatite", "Ca5(PO4)3(F,Cl,OH)", "Phosphate", 5, 3.19, ["phosphate fertilizer", "Mohs reference"], { note: "Mohs reference 5" }],
  ["Turquoise", "CuAl6(PO4)4(OH)8·4H2O", "Phosphate", 5.5, 2.7, ["gemstone"], { color: "sky blue to green" }],
  ["Monazite", "(Ce,La,Nd,Th)PO4", "Phosphate", 5.25, 5.1, ["rare-earth ore"], { note: "weakly radioactive" }],
  ["Vivianite", "Fe3(PO4)2·8H2O", "Phosphate", 1.75, 2.68, ["collector mineral", "pigment"], {}],
  ["Pyrite", "FeS2", "Sulfide", 6.25, 5.01, ["sulfuric acid production", "historic fool's gold"], { luster: "metallic brass-yellow" }],
  ["Galena", "PbS", "Sulfide", 2.5, 7.58, ["primary lead ore", "early radio crystals"], { luster: "metallic" }],
  ["Sphalerite", "ZnS", "Sulfide", 3.75, 4.05, ["primary zinc ore"], {}],
  ["Chalcopyrite", "CuFeS2", "Sulfide", 3.75, 4.19, ["primary copper ore"], { luster: "metallic golden" }],
  ["Bornite", "Cu5FeS4", "Sulfide", 3.25, 5.07, ["copper ore (peacock ore)"], { note: "iridescent tarnish" }],
  ["Chalcocite", "Cu2S", "Sulfide", 2.75, 5.65, ["high-grade copper ore"], {}],
  ["Cinnabar", "HgS", "Sulfide", 2.25, 8.18, ["mercury ore", "historic vermilion pigment"], { color: "scarlet red", caution: "toxic" }],
  ["Stibnite", "Sb2S3", "Sulfide", 2, 4.63, ["antimony ore", "flame retardants"], {}],
  ["Molybdenite", "MoS2", "Sulfide", 1.25, 4.7, ["molybdenum ore", "dry lubricant"], {}],
  ["Orpiment", "As2S3", "Sulfide", 1.75, 3.49, ["historic pigment"], { color: "lemon yellow", caution: "arsenic-bearing" }],
  ["Realgar", "As4S4", "Sulfide", 1.75, 3.56, ["historic pigment", "fireworks"], { caution: "arsenic-bearing" }],
  ["Arsenopyrite", "FeAsS", "Sulfide", 5.75, 6.07, ["arsenic ore", "gold indicator"], {}],
  ["Pyrrhotite", "Fe1-xS", "Sulfide", 3.75, 4.61, ["nickel ore host"], { property: "weakly magnetic" }],
  ["Pentlandite", "(Fe,Ni)9S8", "Sulfide", 3.75, 4.8, ["primary nickel ore"], {}],
  ["Hematite", "Fe2O3", "Oxide", 5.75, 5.26, ["primary iron ore", "red pigment", "polishing"], { streak: "red-brown" }],
  ["Magnetite", "Fe3O4", "Oxide", 6, 5.18, ["iron ore", "heavy media separation"], { property: "strongly magnetic" }],
  ["Corundum", "Al2O3", "Oxide", 9, 4.0, ["abrasives", "gemstone (ruby, sapphire)"], { note: "Mohs reference 9" }],
  ["Rutile", "TiO2", "Oxide", 6.25, 4.25, ["titanium ore", "white pigment", "welding rods"], {}],
  ["Ilmenite", "FeTiO3", "Oxide", 5.75, 4.72, ["primary titanium ore"], {}],
  ["Cassiterite", "SnO2", "Oxide", 6.5, 6.99, ["primary tin ore"], {}],
  ["Chromite", "FeCr2O4", "Oxide", 5.5, 4.79, ["only chromium ore", "refractories"], {}],
  ["Bauxite", "Al(OH)3 mixture", "Oxide", 2.5, 2.4, ["only aluminum ore"], { note: "rock of gibbsite, boehmite, diaspore" }],
  ["Uraninite", "UO2", "Oxide", 5.5, 10.63, ["primary uranium ore"], { caution: "radioactive" }],
  ["Wolframite", "(Fe,Mn)WO4", "Oxide", 4.5, 7.3, ["primary tungsten ore"], {}],
  ["Scheelite", "CaWO4", "Oxide", 4.75, 6.01, ["tungsten ore"], { property: "fluoresces blue-white" }],
  ["Pyrolusite", "MnO2", "Oxide", 6.25, 5.06, ["manganese ore", "batteries"], {}],
  ["Spinel", "MgAl2O4", "Oxide", 8, 3.64, ["gemstone", "refractories"], {}],
  ["Chrysoberyl", "BeAl2O4", "Oxide", 8.5, 3.72, ["gemstone (alexandrite)"], {}],
  ["Opal", "SiO2·nH2O", "Mineraloid", 5.75, 2.09, ["gemstone"], { property: "play of color" }],
  ["Obsidian", "volcanic glass", "Mineraloid", 5.5, 2.4, ["surgical blades", "ornamental"], {}],
  ["Amber", "fossil resin", "Mineraloid", 2.25, 1.08, ["jewelry", "fossil preservation"], {}],
  ["Diamond", "C", "Native element", 10, 3.52, ["cutting tools", "gemstone", "heat sinks"], { note: "hardest natural material (Mohs 10)" }],
  ["Graphite", "C", "Native element", 1.25, 2.26, ["pencils", "lubricants", "battery anodes"], {}],
  ["Sulfur", "S", "Native element", 2, 2.07, ["sulfuric acid", "vulcanization", "fungicides"], { color: "bright yellow" }],
  ["Gold", "Au", "Native metal", 2.75, 19.3, ["jewelry", "electronics", "monetary reserve"], { note: "most malleable metal" }],
  ["Silver", "Ag", "Native metal", 2.75, 10.49, ["electronics", "photography", "jewelry"], { note: "highest electrical conductivity" }],
  ["Copper", "Cu", "Native metal", 2.75, 8.96, ["electrical wiring", "plumbing", "alloys"], {}],
  ["Platinum", "Pt", "Native metal", 4.25, 21.45, ["catalytic converters", "jewelry", "lab equipment"], {}],
  ["Iron", "Fe", "Metal", 4, 7.87, ["steelmaking", "construction", "machinery"], { note: "most used metal worldwide" }],
  ["Aluminum", "Al", "Metal", 2.75, 2.7, ["aerospace", "packaging", "construction"], { note: "refined from bauxite" }],
  ["Zinc", "Zn", "Metal", 2.5, 7.14, ["galvanizing", "die casting", "batteries"], {}],
  ["Lead", "Pb", "Metal", 1.5, 11.34, ["batteries", "radiation shielding"], { caution: "toxic heavy metal" }],
  ["Tin", "Sn", "Metal", 1.5, 7.29, ["solder", "tinplate", "bronze"], {}],
  ["Nickel", "Ni", "Metal", 4, 8.91, ["stainless steel", "batteries", "plating"], {}],
  ["Titanium", "Ti", "Metal", 6, 4.51, ["aerospace", "medical implants", "pigments"], { note: "highest strength-to-weight of metals" }],
  ["Tungsten", "W", "Metal", 7.5, 19.25, ["cutting tools", "filaments", "armor"], { note: "highest melting point of metals (3422°C)" }],
  ["Cobalt", "Co", "Metal", 5, 8.86, ["battery cathodes", "superalloys", "blue pigment"], {}],
  ["Lithium", "Li", "Metal", 0.6, 0.53, ["batteries", "ceramics", "medication"], { note: "lightest metal; floats on water" }],
  ["Mercury", "Hg", "Metal", 1.5, 13.53, ["historic thermometers", "gold amalgamation"], { note: "liquid at room temperature", caution: "toxic" }],
  // --- full metal set (periodic-table metals, metalloids & rare earths) ---
  ["Sodium", "Na", "Metal", 0.5, 0.97, ["street lamps", "coolant", "chemical reagent"], { group: "alkali", caution: "reacts violently with water" }],
  ["Potassium", "K", "Metal", 0.4, 0.86, ["fertilizer", "reagent"], { group: "alkali" }],
  ["Rubidium", "Rb", "Metal", 0.3, 1.53, ["atomic clocks", "research"], { group: "alkali" }],
  ["Cesium", "Cs", "Metal", 0.2, 1.93, ["atomic clocks", "drilling fluids"], { group: "alkali", note: "melts near body temperature" }],
  ["Beryllium", "Be", "Metal", 5.5, 1.85, ["aerospace alloys", "X-ray windows"], { group: "alkaline earth", caution: "toxic dust" }],
  ["Magnesium", "Mg", "Metal", 2.5, 1.74, ["lightweight alloys", "flares", "supplements"], { group: "alkaline earth" }],
  ["Calcium", "Ca", "Metal", 1.75, 1.55, ["steel deoxidizer", "alloys"], { group: "alkaline earth" }],
  ["Strontium", "Sr", "Metal", 1.5, 2.64, ["fireworks (red)", "ferrite magnets"], { group: "alkaline earth" }],
  ["Barium", "Ba", "Metal", 1.25, 3.51, ["drilling mud", "vacuum tubes"], { group: "alkaline earth" }],
  ["Titanium", "Ti", "Metal", 6, 4.51, ["aerospace", "implants", "pigment"], { note: "high strength-to-weight ratio" }],
  ["Vanadium", "V", "Metal", 7, 6.11, ["steel alloys", "catalysts"], {} ],
  ["Chromium", "Cr", "Metal", 8.5, 7.19, ["stainless steel", "plating"], { note: "hardest common metal" }],
  ["Manganese", "Mn", "Metal", 6, 7.43, ["steelmaking", "batteries"], {} ],
  ["Cobalt", "Co", "Metal", 5, 8.9, ["batteries", "superalloys", "blue pigment"], {} ],
  ["Nickel", "Ni", "Metal", 4, 8.91, ["stainless steel", "batteries", "coins"], {} ],
  ["Scandium", "Sc", "Metal", 2.5, 2.99, ["aerospace alloys", "stadium lighting"], { note: "rare, light transition metal" }],
  ["Yttrium", "Y", "Metal", 2.5, 4.47, ["LED phosphors", "superconductors"], { group: "rare earth" }],
  ["Zirconium", "Zr", "Metal", 5, 6.52, ["nuclear cladding", "ceramics"], { note: "corrosion resistant" }],
  ["Niobium", "Nb", "Metal", 6, 8.57, ["superconducting magnets", "steel alloys"], {} ],
  ["Molybdenum", "Mo", "Metal", 5.5, 10.28, ["high-strength steel", "electrodes"], {} ],
  ["Ruthenium", "Ru", "Native metal", 6.5, 12.37, ["electronics", "catalysts"], { group: "platinum group" }],
  ["Rhodium", "Rh", "Native metal", 6, 12.41, ["catalytic converters", "jewelry plating"], { group: "platinum group", note: "one of the rarest metals" }],
  ["Palladium", "Pd", "Native metal", 4.75, 12.02, ["catalytic converters", "electronics"], { group: "platinum group" }],
  ["Cadmium", "Cd", "Metal", 2, 8.65, ["NiCd batteries", "pigments"], { caution: "toxic" }],
  ["Hafnium", "Hf", "Metal", 5.5, 13.31, ["nuclear control rods", "superalloys"], {} ],
  ["Tantalum", "Ta", "Metal", 6.5, 16.65, ["capacitors", "surgical implants"], {} ],
  ["Tungsten", "W", "Metal", 7.5, 19.25, ["filaments", "cutting tools", "armor"], { note: "highest melting point of all metals" }],
  ["Rhenium", "Re", "Metal", 7, 21.02, ["jet-engine superalloys", "catalysts"], {} ],
  ["Osmium", "Os", "Native metal", 7, 22.59, ["fountain-pen tips", "electrical contacts"], { note: "densest naturally occurring element" }],
  ["Iridium", "Ir", "Native metal", 6.5, 22.56, ["spark plugs", "crucibles"], { note: "most corrosion-resistant metal" }],
  ["Gallium", "Ga", "Metal", 1.5, 5.91, ["semiconductors (LEDs)", "solar cells"], { note: "melts in the hand" }],
  ["Indium", "In", "Metal", 1.2, 7.31, ["touchscreens (ITO)", "solders"], {} ],
  ["Thallium", "Tl", "Metal", 1.2, 11.85, ["electronics", "infrared optics"], { caution: "highly toxic" }],
  ["Bismuth", "Bi", "Metal", 2.25, 9.78, ["pharmaceuticals", "lead-free alloys"], { note: "iridescent oxide colours" }],
  ["Antimony", "Sb", "Native element", 3, 6.68, ["flame retardants", "lead alloys"], { class: "metalloid" }],
  ["Boron", "B", "Native element", 9.3, 2.34, ["borosilicate glass", "abrasives"], { class: "metalloid" }],
  ["Silicon", "Si", "Native element", 6.5, 2.33, ["semiconductors", "solar cells", "alloys"], { class: "metalloid" }],
  ["Germanium", "Ge", "Native element", 6, 5.32, ["fiber optics", "infrared optics"], { class: "metalloid" }],
  ["Arsenic", "As", "Native element", 3.5, 5.73, ["semiconductors", "alloys"], { class: "metalloid", caution: "toxic" }],
  ["Tellurium", "Te", "Native element", 2.25, 6.24, ["solar panels", "alloying steel"], { class: "metalloid" }],
  ["Lanthanum", "La", "Metal", 2.5, 6.16, ["camera lenses", "battery alloys"], { group: "rare earth" }],
  ["Cerium", "Ce", "Metal", 2.5, 6.77, ["catalytic converters", "glass polishing"], { group: "rare earth" }],
  ["Praseodymium", "Pr", "Metal", 2.5, 6.77, ["magnets", "aircraft alloys"], { group: "rare earth" }],
  ["Neodymium", "Nd", "Metal", 2.5, 7.01, ["powerful magnets", "lasers"], { group: "rare earth" }],
  ["Samarium", "Sm", "Metal", 2.5, 7.52, ["magnets", "nuclear reactors"], { group: "rare earth" }],
  ["Europium", "Eu", "Metal", 2, 5.24, ["red/blue phosphors", "anti-counterfeit inks"], { group: "rare earth" }],
  ["Gadolinium", "Gd", "Metal", 2.5, 7.9, ["MRI contrast", "shielding"], { group: "rare earth" }],
  ["Terbium", "Tb", "Metal", 2.5, 8.23, ["green phosphors", "solid-state devices"], { group: "rare earth" }],
  ["Dysprosium", "Dy", "Metal", 2.5, 8.55, ["high-temp magnets", "lasers"], { group: "rare earth" }],
  ["Holmium", "Ho", "Metal", 2.5, 8.8, ["magnets", "medical lasers"], { group: "rare earth" }],
  ["Erbium", "Er", "Metal", 2.5, 9.07, ["fiber-optic amplifiers", "pink glass"], { group: "rare earth" }],
  ["Ytterbium", "Yb", "Metal", 2.5, 6.9, ["atomic clocks", "stainless steel"], { group: "rare earth" }],
  ["Lutetium", "Lu", "Metal", 2.5, 9.84, ["PET scanners", "catalysts"], { group: "rare earth" }],
  ["Thorium", "Th", "Metal", 3, 11.72, ["nuclear fuel research", "gas mantles"], { caution: "radioactive" }],
  ["Uranium", "U", "Metal", 6, 19.05, ["nuclear fuel", "radiation shielding"], { caution: "radioactive" }],
];

const MINERAL_BLURB = {
  Silicate: "a rock-forming silicate and one of the most common mineral families in Earth's crust",
  Carbonate: "a carbonate mineral typically formed in sedimentary and hydrothermal environments",
  Sulfate: "a sulfate mineral usually deposited from evaporating waters",
  Halide: "a halide mineral formed from evaporite deposits",
  Phosphate: "a phosphate mineral",
  Sulfide: "a sulfide mineral and an important metallic ore",
  Oxide: "an oxide mineral of significant industrial importance",
  Mineraloid: "a naturally occurring mineraloid lacking a true crystal structure",
  "Native element": "a native element found in nature in pure form",
  "Native metal": "a precious native metal",
  Metal: "an industrially refined metal traded as a commodity",
};

// Some metals appear both in the curated list and the periodic-table block
// (Titanium, Nickel, Cobalt, Tungsten). Keep the first occurrence of each slug
// so the emitted INSERT never repeats a row within one statement.
function dedupeBySlug(list) {
  const seen = new Set();
  const out = [];
  for (const row of list) {
    const slug = slugify(row[0]);
    if (seen.has(slug)) continue;
    seen.add(slug);
    out.push(row);
  }
  return out;
}

function mineralRow([name, symbol, category, mohs, density, uses, extra]) {
  const description = `${name} (${symbol}) is ${MINERAL_BLURB[category]}. With a Mohs hardness of ${mohs} and a density of ${density} g/cm³, it is chiefly used for ${uses[0]}.`;
  const properties = JSON.stringify(extra);
  return `(${q(name)}, ${q(slugify(name))}, ${q(symbol)}, ${q(category)}, ${mohs}, ${density}, ${q(properties)}::jsonb, ${arr(uses)}, ${q(description)})`;
}

// --- output -------------------------------------------------------------------

// Emit the strain inserts in chunks so the file stays friendly to the Supabase
// SQL Editor (which caps a single statement's size).
const STRAIN_COLUMNS =
  "  (name, slug, type, thc, cbd, effects, flavors, terpenes, grow_difficulty, flowering_weeks, yield_indoor, yield_outdoor, description)";
const CHUNK = 250;
const strainInserts = [];
for (let i = 0; i < ALL_STRAINS.length; i += CHUNK) {
  const rows = ALL_STRAINS.slice(i, i + CHUNK).map(strainRow).join(",\n");
  strainInserts.push(
    `insert into public.strains\n${STRAIN_COLUMNS}\nvalues\n${rows}\non conflict (slug) do nothing;`,
  );
}

const MINERAL_ROWS = dedupeBySlug(MINERALS);
const mineralsInsert = [
  "insert into public.minerals",
  "  (name, slug, symbol, category, hardness_mohs, density, properties, uses, description)",
  "values",
  MINERAL_ROWS.map(mineralRow).join(",\n"),
  "on conflict (slug) do nothing;",
].join("\n");

const header = [
  `-- Knowledge seed: ${ALL_STRAINS.length} cannabis strains + ${MINERAL_ROWS.length} minerals/metals.`,
  "-- GENERATED by scripts/generate-knowledge-seed.mjs — edit the script, not this file.",
  "-- Idempotent: safe to re-run. Sample strain photos are rendered in the UI",
  "-- (type-coloured placeholder) when image_url is null.",
];

// 1) One combined file — best for `psql -f` / the Supabase CLI.
const combined = [
  ...header,
  "",
  strainInserts.join("\n\n"),
  "",
  mineralsInsert,
  "",
];
writeFileSync(OUT, combined.join("\n"));

// 2) Split part files — each is ONE self-contained, valid statement small
// enough to paste into the Supabase web SQL Editor (which truncates ~1 MB
// pastes, the cause of the "syntax error at or near '(...'" reports). Run them
// in filename order; every part is idempotent so re-running is safe.
const PARTS_DIR = join(dirname(OUT), "knowledge");
mkdirSync(PARTS_DIR, { recursive: true });
const parts = [...strainInserts, mineralsInsert];
const pad = String(parts.length).length;
const manifest = [];
parts.forEach((body, idx) => {
  const n = String(idx + 1).padStart(pad, "0");
  const isMinerals = idx === strainInserts.length;
  const label = isMinerals ? "minerals" : "strains";
  const name = `part_${n}_${label}.sql`;
  writeFileSync(
    join(PARTS_DIR, name),
    [
      ...header,
      `-- Part ${idx + 1}/${parts.length} — ${label}. Paste this whole file into the`,
      "-- Supabase SQL Editor and Run. Order does not matter; re-running is safe.",
      "",
      body,
      "",
    ].join("\n"),
  );
  manifest.push(name);
});
writeFileSync(
  join(PARTS_DIR, "README.md"),
  [
    "# Knowledge seed — split parts",
    "",
    "The combined `../knowledge_seed.sql` is ~1 MB, which the Supabase **web**",
    "SQL Editor truncates on paste (you then get `syntax error at or near`).",
    "These parts avoid that: each file is one complete, idempotent statement.",
    "",
    "## How to load (Supabase web SQL Editor)",
    "Open each file below, copy ALL of it, paste into a new query, and Run.",
    "Do them in order. Re-running any part is safe (`on conflict do nothing`).",
    "",
    ...manifest.map((m, i) => `${i + 1}. \`${m}\``),
    "",
    "## Faster: Supabase CLI / psql (loads everything at once)",
    "```bash",
    "psql \"$DATABASE_URL\" -f supabase/seed/knowledge_seed.sql",
    "```",
    "",
  ].join("\n"),
);

console.log(
  `Wrote ${OUT}: ${ALL_STRAINS.length} strains, ${MINERAL_ROWS.length} minerals`,
);
console.log(
  `Wrote ${parts.length} split parts + README to ${PARTS_DIR}`,
);
