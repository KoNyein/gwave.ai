/// Phase W6 — မြေကွက် trait တွေက map data နဲ့ ကိုက်ရမယ်။
///
/// Run: `node --experimental-strip-types --test src/lib/metaverse/land-traits.test.ts`
///
/// ★ ဒါက acceptance criteria ကို တိုက်ရိုက် ချည်ထားတာ — "Trait တွေက
///   map data နဲ့ ကိုက်ညီတယ် (ကျပန်းမဟုတ်)"。 Metadata က on-chain
///   asset တစ်ခုရဲ့ ဖော်ပြချက်ဖြစ်လို့ တစ်ခါ mint လုပ်ပြီးရင် ပြင်လို့
///   မလွယ်တော့ဘူး — မှားရင် လိမ်ရာ ရောက်တယ်။

import test from "node:test";
import assert from "node:assert";

// ★ `@/` alias က bundler ရဲ့ အရာ — node က မသိဘူး။ Runtime import
//   တွေမှာ relative path နဲ့ `.ts` extension နှစ်ခုလုံး လိုတယ်။
import { CITY } from "../../components/metaverse/maps/city.ts";

import { GRID_COLS, LIMITS } from "./build.ts";
import { allPlotTraits, plotBounds, traitsFor, PLOT_COUNT } from "./land-traits.ts";

test("ကွက်အရေအတွက်က contract ရဲ့ GRID နဲ့ တူရမယ်", () => {
  // ★ GwaveLand.sol မှာ `GRID = 32`၊ `tokenIdFor = gx * 32 + gz`。
  //   ဒီနှစ်ခု ကွဲသွားရင် metadata က မရှိတဲ့ token ကို ညွှန်နေမယ်။
  assert.equal(GRID_COLS, 32);
  assert.equal(PLOT_COUNT, 1024);
});

test("plotId က gx * 32 + gz ဖြစ်ရမယ် (contract နဲ့ တူညီ)", () => {
  assert.equal(traitsFor(0, 0, CITY).plotId, 0);
  assert.equal(traitsFor(5, 7, CITY).plotId, 167);
  assert.equal(traitsFor(31, 31, CITY).plotId, 1023);
});

test("ကွက်နယ်နိမိတ်တွေက ထပ်လည်း မထပ်၊ ကွက်လပ်လည်း မရှိရ", () => {
  const a = plotBounds(5, 7);
  const b = plotBounds(6, 7);
  assert.equal(a.maxX, b.minX, "ဘေးချင်းကပ်ကွက် ၂ ခုကြားမှာ ကွက်လပ် ရှိနေတယ်");
  assert.equal(a.maxX - a.minX, LIMITS.plotSize);
});

test("★ ရေအနီးက ကွက်မှာသာ ရေလမ်းရှိရမယ်", () => {
  // CITY ရဲ့ pool က (0, 0) မှာ radius 6။ အလယ်ကွက်တွေမှာ ရေရှိရမယ်၊
  // အစွန်းမှာ မရှိရဘူး။
  const centre = traitsFor(16, 16, CITY);
  const corner = traitsFor(0, 0, CITY);
  assert.equal(centre.waterAccess, true, "ရေကန်ဘေးမှာ ရေမရှိဘူးလို့ ပြောနေတယ်");
  assert.equal(corner.waterAccess, false, "အစွန်းဆုံးကွက်မှာ ရေရှိတယ်လို့ ပြောနေတယ်");
});

test("★ trait တွေက map data ကို တကယ် ဖတ်ရမယ် — ပြောင်းရင် လိုက်ပြောင်းရမယ်", () => {
  // ရေကို ဖယ်လိုက်ရင် ဘယ်ကွက်မှာမှ ရေမရှိတော့ရဘူး။ ဒါက "hardcode
  // လုပ်ထားတာလား" ဆိုတာကို ခွဲခြားပေးတယ်။
  const dry = { ...CITY, water: [] };
  assert.equal(traitsFor(16, 16, dry).waterAccess, false);

  const noLamps = { ...CITY, lamps: [] };
  assert.ok(
    allPlotTraits(CITY).some((t) => t.lit),
    "မူရင်း map မှာ မီးလင်းတဲ့ ကွက် တစ်ခုမှ မရှိဘူး — စစ်ဆေးမှုက အဓိပ္ပာယ်မရှိတော့ဘူး",
  );
  assert.equal(
    allPlotTraits(noLamps).filter((t) => t.lit).length,
    0,
    "မီးတိုင် ဖယ်လိုက်တောင် မီးလင်းနေတယ်လို့ ပြောနေတယ်",
  );
});

test("★ လောကအပြင်ဘက် ကွက်တွေကို အမှတ်အသား လုပ်ရမယ်", () => {
  // ★ ဇယားကွက်က ၅၁၂မီတာ ကျယ်ပေမယ့် CITY ရဲ့ worldRadius က ၉၀ ပဲ။
  //   အပြင်ဘက်ကွက်တွေကို "ရှိတယ်" လို့ ပြရင် ဝယ်သူက ဝင်လို့မရဘဲ
  //   ဖြစ်မယ် — ဒါကြောင့် သီးခြား အမှတ်အသား လိုတယ်။
  const all = allPlotTraits(CITY);
  const outside = all.filter((t) => t.outOfBounds);
  assert.ok(outside.length > 0, "worldRadius ကို လုံးဝ ဂရုမစိုက်ဘူး");
  assert.ok(
    outside.every((t) => t.rarity === "Common" && t.zone === "အပြင်ဘက်"),
    "အပြင်ဘက်ကွက်တစ်ခုကို ရှားပါးတယ်လို့ ပြောနေတယ်",
  );
  assert.equal(traitsFor(16, 16, CITY).outOfBounds, false, "အလယ်ကွက်ကို အပြင်ဘက်လို့ ပြောနေတယ်");
});

test("ရှားပါးမှုက ဇုန်နဲ့ ဆန့်ကျင်လို့ မရ", () => {
  // ★ မြို့လယ်ကွက်တစ်ခုက ဘယ်တော့မှ မြို့စွန်ကွက်ထက် မနိမ့်ရဘူး —
  //   ဒါက user တစ်ယောက်က တန်ဖိုးဖြတ်တဲ့အခါ အခြေခံပြုမယ့် အချက်။
  const rank = { Common: 0, Uncommon: 1, Rare: 2, Legendary: 3 };
  const all = allPlotTraits(CITY).filter((t) => !t.outOfBounds);
  const centre = all.filter((t) => t.zone === "မြို့လယ်");
  const edge = all.filter((t) => t.zone === "မြို့စွန်");
  assert.ok(centre.length > 0 && edge.length > 0);
  const worstCentre = Math.min(...centre.map((t) => rank[t.rarity]));
  const bestEdge = Math.max(...edge.map((t) => rank[t.rarity]));
  assert.ok(
    worstCentre >= bestEdge,
    `မြို့လယ်ရဲ့ အနိမ့်ဆုံး (${worstCentre}) က မြို့စွန်ရဲ့ အမြင့်ဆုံး (${bestEdge}) ထက် နိမ့်နေတယ်`,
  );
});
