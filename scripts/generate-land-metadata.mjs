#!/usr/bin/env node
/// Phase W6 — မြေကွက် ၁,၀၂၄ ခုအတွက် metadata + ပုံ ထုတ်တယ်။
///
/// Run:
///   node --experimental-strip-types scripts/generate-land-metadata.mjs
///   node --experimental-strip-types scripts/generate-land-metadata.mjs --limit 8
///
/// ★ `--experimental-strip-types` မဖြစ်မနေ လိုတယ် — trait တွေကို
///   `src/lib/metaverse/land-traits.ts` ကနေ ယူတယ်။ Script ထဲမှာ
///   ထပ်ရေးရင် UI နဲ့ metadata က တဖြည်းဖြည်း ကွဲသွားပြီး "ကြည့်တုန်းက
///   Rare ဆိုပေမယ့် OpenSea မှာ Common ပြနေတယ်" ဖြစ်မယ်။
/// ★ ပုံကို **SVG** နဲ့ ထုတ်တယ် — sharp လို native dependency မလိုဘူး၊
///   ဖိုင်က ၂KB အောက်ပဲ ရှိတယ်၊ marketplace တွေက SVG ကို ပြပေးတယ်။
///   PNG လိုချင်ရင် `--png` (sharp ရှိမှ)。
/// ★ ဖိုင်တွေကို local မှာသာ ထုတ်တယ် — S3 တင်တာက သီးခြား အဆင့်
///   (`aws s3 sync`, အောက်မှာ ရေးထားတယ်)。 Script တစ်ခုတည်းက
///   generate + upload လုပ်ရင် စမ်းချင်တိုင်း production bucket ကို
///   ထိမိမယ်။

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const next = args[i + 1];
  return next && !next.startsWith("--") ? next : true;
};

const OUT = String(flag("out", "out/metaverse/land"));
const MAP_ID = String(flag("map", "city"));
const LIMIT = Number(flag("limit", 0)) || 0;
const WANT_PNG = flag("png", false) === true;
const CDN = String(flag("cdn", process.env.CDN_BASE || "https://cdn.gwave.cc"));
const SITE = String(flag("site", process.env.NEXT_PUBLIC_SITE_URL || "https://gwave.cc"));

// ★ `maps/index.ts` ကို မသုံးဘူး — အဲဒီ file က extension မပါတဲ့
//   import တွေ သုံးထားလို့ node က ရှာမတွေ့ဘူး (bundler ကသာ ရတယ်)。
//   Map file တွေက type-only import ပဲ ရှိလို့ တိုက်ရိုက် ခေါ်လို့ရတယ်။
const MAPS = Object.fromEntries(
  await Promise.all(
    ["city", "farm", "snow", "sky"].map(async (id) => {
      const mod = await import(`../src/components/metaverse/maps/${id}.ts`);
      return [id, Object.values(mod)[0]];
    }),
  ),
);
const { allPlotTraits, PLOT_COUNT } = await import("../src/lib/metaverse/land-traits.ts");

const map = MAPS[MAP_ID];
if (!map) {
  console.error(`map '${MAP_ID}' မရှိဘူး — ရှိတာတွေ: ${Object.keys(MAPS).join(", ")}`);
  process.exit(2);
}

// ★ sharp က optional — မရှိရင် SVG ပဲ ထုတ်တယ်၊ ကျရှုံးမပြဘူး။
let sharp = null;
if (WANT_PNG) {
  try {
    ({ default: sharp } = await import("sharp"));
  } catch {
    console.warn("[land] sharp မရှိလို့ SVG ပဲ ထုတ်မယ် (`pnpm add -D sharp` လုပ်ပါ)");
  }
}

const RARITY_COLOR = {
  Legendary: "#d8a94a",
  Rare: "#a06cd5",
  Uncommon: "#44bba4",
  Common: "#6c757d",
};

/// ကွက်ရဲ့ နေရာကို ဇယားကွက်ပေါ်မှာ အမှတ်အသားပြုတဲ့ ပုံ။
///
/// ★ ရည်ရွယ်ချက်က **လှဖို့ မဟုတ်ဘူး၊ ဘယ်နေရာလဲ သိဖို့**。 Marketplace
///   စာရင်းထဲမှာ ကွက် ၂၀ ဘေးချင်းယှဉ်ပြနေတဲ့အခါ တစ်ချက်ကြည့်ရုံနဲ့
///   ဘယ်ဟာက အလယ်၊ ဘယ်ဟာက အစွန်း သိရမယ်။
function plotSvg(t, grid) {
  const cell = 512 / grid;
  const x = t.gridX * cell;
  const y = (grid - 1 - t.gridZ) * cell; // ★ z က အောက်ကနေ အပေါ် — SVG က ပြောင်းပြန်
  const accent = RARITY_COLOR[t.rarity] ?? RARITY_COLOR.Common;

  const lines = [];
  for (let i = 0; i <= grid; i += 4) {
    const p = i * cell;
    lines.push(`<line x1="${p}" y1="0" x2="${p}" y2="512" />`);
    lines.push(`<line x1="0" y1="${p}" x2="512" y2="${p}" />`);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 600" width="512" height="600" role="img" aria-label="Gwave plot ${t.gridX}, ${t.gridZ}">
  <rect width="512" height="600" fill="#12181f"/>
  <g stroke="#24303c" stroke-width="1">${lines.join("")}</g>
  <circle cx="256" cy="256" r="${Math.round((256 * 0.2))}" fill="none" stroke="#24303c" stroke-width="1" stroke-dasharray="4 4"/>
  <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${cell.toFixed(1)}" height="${cell.toFixed(1)}" fill="${accent}" fill-opacity="0.9"/>
  <rect x="${(x - 3).toFixed(1)}" y="${(y - 3).toFixed(1)}" width="${(cell + 6).toFixed(1)}" height="${(cell + 6).toFixed(1)}" fill="none" stroke="${accent}" stroke-width="2"/>
  <text x="24" y="548" fill="#e8f0e8" font-family="ui-monospace, monospace" font-size="26">(${t.gridX}, ${t.gridZ})</text>
  <text x="24" y="578" fill="${accent}" font-family="ui-monospace, monospace" font-size="19">${t.rarity} · ${t.size}×${t.size}</text>
  <text x="488" y="578" fill="#6a8a72" font-family="ui-monospace, monospace" font-size="19" text-anchor="end">#${t.plotId}</text>
</svg>`;
}

const PROVENANCE =
  "ဤသက်သေခံမှာ အပိုအထောက်အထားသာ ဖြစ်ပြီး၊ ပိုင်ဆိုင်မှုမှတ်တမ်း၏ အရင်းအမြစ်ကို " +
  "Gwave အကောင့်တွင် သိမ်းဆည်းထားပါသည်။";

function metadata(t, imageExt) {
  return {
    name: `Gwave Plot (${t.gridX}, ${t.gridZ})`,
    // ★ လောကအပြင်ဘက် ကျနေတဲ့ ကွက်ကို "ရှိတယ်" လို့ မပြောရ — ဝယ်ပြီးမှ
    //   ဝင်လို့မရဘူးဆိုတာ တွေ့ရင် ဒါက လိမ်ရာ ရောက်တယ်။
    description: t.outOfBounds
      ? `ဤဧရိယာကို မဖွင့်ရသေးပါ — လောကနယ်နိမိတ် (${map.worldRadius}မီတာ) ၏ အပြင်ဘက်တွင် ရှိပါသည်။ ${PROVENANCE}`
      : `Gwave Metaverse ရှိ မြေကွက်တစ်ကွက်။ ${PROVENANCE}`,
    image: `${CDN}/metaverse/land/img/${t.plotId}.${imageExt}`,
    external_url: `${SITE}/metaverse?plot=${t.plotId}`,
    attributes: [
      { trait_type: "Status", value: t.outOfBounds ? "Reserved" : "Open" },
      { trait_type: "Grid X", value: t.gridX },
      { trait_type: "Grid Z", value: t.gridZ },
      { trait_type: "Zone", value: t.zone },
      { trait_type: "Rarity", value: t.rarity },
      { trait_type: "Water Access", value: t.waterAccess ? "Yes" : "No" },
      { trait_type: "Street Lit", value: t.lit ? "Yes" : "No" },
      { trait_type: "Buildings", value: t.buildings },
      { trait_type: "Trees", value: t.trees },
      { trait_type: "Size", value: `${t.size} × ${t.size}` },
      { display_type: "number", trait_type: "Distance from centre", value: t.distance },
    ],
  };
}

// ── ထုတ် ─────────────────────────────────────────────────────────────────
const traits = allPlotTraits(map);
const todo = LIMIT > 0 ? traits.slice(0, LIMIT) : traits;
const grid = Math.round(Math.sqrt(PLOT_COUNT));
const imageExt = sharp ? "png" : "svg";

await mkdir(join(OUT, "img"), { recursive: true });

const tally = { Legendary: 0, Rare: 0, Uncommon: 0, Common: 0 };
for (const t of todo) {
  tally[t.rarity] += 1;
  const svg = plotSvg(t, grid);

  // ★ JSON ကို extension မပါဘဲ ရေးတယ် — `tokenURI` က
  //   `.../land/167` ကို ညွှန်တာမို့ S3 key က အဲဒီအတိုင်း ဖြစ်ရမယ်။
  await writeFile(join(OUT, String(t.plotId)), JSON.stringify(metadata(t, imageExt), null, 2));

  if (sharp) {
    await writeFile(
      join(OUT, "img", `${t.plotId}.png`),
      await sharp(Buffer.from(svg)).png().toBuffer(),
    );
  } else {
    await writeFile(join(OUT, "img", `${t.plotId}.svg`), svg);
  }
}

console.log(`[land] ${todo.length}/${PLOT_COUNT} ကွက် — ${OUT}`);
console.log(`[land] ရှားပါးမှု:`, tally);

// ★ ဒါက တိတ်တိတ် မကျော်ရမယ့် ကွဲလွဲချက် — contract က ကွက် ၁,၀၂၄
//   ခုအတွက် ဆောက်ထားပေမယ့် (GRID = 32, ၅၁၂မီတာ ကျယ်တယ်) map ရဲ့
//   worldRadius က အဲဒီထက် အများကြီး သေးတယ်။ ကျန်တာတွေက ဝင်လို့မရတဲ့
//   နေရာတွေ ဖြစ်နေတယ် — ရောင်းချမယ်ဆိုရင် ရှိမနေတဲ့ မြေကို ရောင်းရာ
//   ရောက်မယ်။
const reserved = todo.filter((t) => t.outOfBounds).length;
if (reserved > 0) {
  console.warn(
    `\n⚠ ${reserved}/${todo.length} ကွက်က လောကရဲ့ အပြင်ဘက်မှာ ရှိတယ် ` +
      `(worldRadius = ${map.worldRadius}မီတာ၊ ဇယားကွက်က ${(PLOT_COUNT ** 0.5) * 16}မီတာ ကျယ်တယ်)。\n` +
      `  အဲဒီကွက်တွေကို "Status: Reserved" လို့ မှတ်ထားတယ် — ဝင်လို့မရသေးဘူး။\n` +
      `  ရွေးစရာ ၂ ခု: (၁) map ရဲ့ worldRadius ကို ${Math.ceil((PLOT_COUNT ** 0.5) * 16 * 0.71)}မီတာ အထိ ချဲ့ပါ၊\n` +
      `               (၂) ပထမအကြိမ်မှာ ဝင်လို့ရတဲ့ ${todo.length - reserved} ကွက်ကိုသာ ရောင်းပါ။`,
  );
}
console.log(`
တင်ရန် (★ metadata က ခဏခဏ မပြောင်းလို့ cache ရှည်ရှည်):
  aws s3 sync ${OUT}/ s3://gwave-cdn/metaverse/land/ \\
    --exclude "img/*" --cache-control "public, max-age=86400" \\
    --content-type application/json
  aws s3 sync ${OUT}/img/ s3://gwave-cdn/metaverse/land/img/ \\
    --cache-control "public, max-age=604800" \\
    --content-type "image/${imageExt === "png" ? "png" : "svg+xml"}"

★ CORS မဖြစ်မနေ — wallet/marketplace တွေက browser ကနေ ဖတ်တယ်:
  aws s3api put-bucket-cors --bucket gwave-cdn --cors-configuration '{
    "CORSRules": [{ "AllowedOrigins": ["*"], "AllowedMethods": ["GET","HEAD"],
                    "AllowedHeaders": ["*"], "MaxAgeSeconds": 86400 }]}'
`);
