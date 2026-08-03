/// Arena — ပွဲစဉ်သုံး မြေပုံ (Arena spec A2)。
///
/// ★ Social map နဲ့ ဘာလို့ ခွဲရလဲ — social map က လှဖို့၊ ကျယ်ဖို့၊ လမ်းလျှောက်
///   ရလွယ်ဖို့ ဒီဇိုင်းလုပ်ထားတယ်။ ပွဲစဉ်မြေပုံက **မျှတဖို့** ဒီဇိုင်းလုပ်ရတယ် —
///   ကွယ်စရာ များများ၊ လမ်းကြောင်း ၃ ခုအနည်းဆုံး၊ ထောင့်ထဲ ပုန်းလို့မရ။
///   အဲဒီ ၂ ခုက ဆန့်ကျင်ဘက်တွေ ဖြစ်တတ်တယ်။
///
/// ★ ဒီ file က **data သက်သက်** — three.js ကို import မလုပ်ဘူး။ ဒါမှ
///   server (node) ရော client (browser) ရော တစ်ခုတည်းက ဖတ်လို့ရပြီး၊
///   `map.test.ts` က browser မလိုဘဲ စစ်လို့ရတယ်။

/// ကွယ်ကာမှု အမျိုးအစား ၃ မျိုး (spec A2.2) —
/// - `full` — လုံးဝကွယ် (နံရံ)。 collider ရော raycast ရော တားတယ်
/// - `half` — ကုန်းလျှိုးရင်ကွယ် (အုတ်တံတိုင်း၊ လှည်း)。 ၂ ခုလုံး တားတယ်
/// - `soft` — မြင်ရခက် ဒါပေမယ့် ကျည်ဖောက် (ချုံ၊ ပိတ်ကား)。
///   ★ collider မရှိ၊ raycast မတား — မြင်ရမှုကိုသာ လျော့စေတယ်
export type CoverKind = "full" | "half" | "soft";

export type Cover = {
  kind: CoverKind;
  x: number;
  z: number;
  /// x/z ဝန်းကျင် အကျယ် (ထောင့်မှန်စတုဂံ)
  w: number;
  d: number;
  h: number;
  /// လှည့်ထားတဲ့ထောင့် (radian) — ထောင့်မှန်ချည်းဆိုရင် ပုံစံတူနေတယ်
  ry?: number;
};

export type Zone = {
  id: string;
  /// မြန်မာနာမည် — HUD မှာ "ဈေးထဲမှာ" လို့ ပြဖို့
  name: string;
  x: number;
  z: number;
  r: number;
  cover: "low" | "medium" | "high";
  /// မြေပြင်အမြင့် — မျှော်စင်လို နေရာမျိုးအတွက်
  height?: number;
};

export type Spawn = { x: number; z: number; zone: string };

/// ★ လမ်းကြောင်း — zone ၂ ခုကို ချိတ်တဲ့ လမ်း။ ဒါမပါရင် zone တွေက
///   ကျွန်းတွေ ဖြစ်နေပြီး ကစားသမားတွေ ဘယ်တော့မှ မတွေ့ဘူး။
export type Route = { from: string; to: string };

export type ArenaMap = {
  id: string;
  name: string;
  worldRadius: number;
  zones: Zone[];
  routes: Route[];
  spawns: Spawn[];
  covers: Cover[];
  /// ★ ပွဲအလယ်မှာ မပြောင်းရ — ည ဖြစ်သွားရင် ပုန်းရလွယ်သူတွေ အားသာသွားတယ်။
  weather: { fixed: "clear" };
  timeOfDay: { fixed: number };
};

const R = 40;

/// Zone ၅ ခု — အလယ်ဗဟို တစ်ခု၊ ပတ်လည် ၄ ခု (spec A2.1)。
const zones: Zone[] = [
  { id: "plaza", name: "မြို့လယ်", x: 0, z: 0, r: 12, cover: "medium" },
  { id: "market", name: "ဈေး", x: -22, z: -16, r: 10, cover: "high" },
  { id: "tower", name: "မျှော်စင်", x: 24, z: -18, r: 8, cover: "low", height: 8 },
  { id: "garden", name: "ဥယျာဉ်", x: 18, z: 20, r: 11, cover: "high" },
  { id: "ruins", name: "အပျက်အစီး", x: -20, z: 22, r: 9, cover: "medium" },
];

/// ★ လမ်းကြောင်း ၆ ခု — zone တိုင်းက အနည်းဆုံး ၂ ဘက်ကို သွားလို့ရတယ်။
///   ဒါက အရေးကြီးတယ်: လမ်းတစ်ကြောင်းတည်းရှိတဲ့ zone က ထောင်ချောက် ဖြစ်ပြီး၊
///   အဲဒီအဝကို တစ်ယောက်က စောင့်နေရုံနဲ့ ပိတ်လို့ရတယ်။
const routes: Route[] = [
  { from: "plaza", to: "market" },
  { from: "plaza", to: "tower" },
  { from: "plaza", to: "garden" },
  { from: "plaza", to: "ruins" },
  // ★ ပတ်လမ်း — plaza ကို မဖြတ်ဘဲ ပတ်လို့ရအောင်။ မရှိရင် အလယ်ကို
  //   ထိန်းထားသူက လမ်းအားလုံးကို ထိန်းထားသလို ဖြစ်တယ်။
  { from: "market", to: "ruins" },
  { from: "tower", to: "garden" },
];

/// ★ ကွယ်စရာ — zone အလိုက် သိပ်သည်းဆ ကွာအောင် ချထားတယ်။ `high` zone မှာ
///   များများ၊ `low` (မျှော်စင်) မှာ နည်းနည်း — အမြင့်က ကိုယ်တိုင်
///   အားသာချက်ဖြစ်လို့ ကွယ်စရာပါ များရင် လွန်သွားမယ်။
function ringCovers(
  cx: number,
  cz: number,
  count: number,
  radius: number,
  kind: CoverKind,
  size: [number, number, number],
  phase = 0,
): Cover[] {
  const out: Cover[] = [];
  for (let i = 0; i < count; i++) {
    const a = phase + (i / count) * Math.PI * 2;
    out.push({
      kind,
      x: round2(cx + Math.cos(a) * radius),
      z: round2(cz + Math.sin(a) * radius),
      w: size[0],
      d: size[1],
      h: size[2],
      ry: round2(a),
    });
  }
  return out;
}

const covers: Cover[] = [
  // မြို့လယ် — အလယ်မှာ ကျောက်တိုင်၊ ပတ်လည်မှာ အုတ်တံတိုင်း
  { kind: "full", x: 0, z: 0, w: 3, d: 3, h: 4 },
  ...ringCovers(0, 0, 6, 7, "half", [3.2, 0.8, 1.2]),
  ...ringCovers(0, 0, 6, 11, "soft", [2.4, 2.4, 2.6], Math.PI / 6),

  // ဈေး — ဆိုင်ခန်းတွေ၊ ကွယ်စရာ အများဆုံး
  ...ringCovers(-22, -16, 7, 5, "full", [2.6, 2.2, 3]),
  ...ringCovers(-22, -16, 6, 8.5, "half", [2.8, 1, 1.1], Math.PI / 7),

  // မျှော်စင် — အောက်ခြေမှာ တိုင် ၄ ခုပဲ။ ★ အပေါ်ကနေ မြင်ရတဲ့နေရာမို့
  //   ကွယ်စရာ များရင် စနိုက်ပါက မထိနိုင်တဲ့ ခံတပ် ဖြစ်သွားမယ်။
  ...ringCovers(24, -18, 4, 5.5, "full", [1.6, 1.6, 5]),

  // ဥယျာဉ် — ချုံပုတ်များ (soft)၊ နံရံ အနည်းငယ်
  ...ringCovers(18, 20, 8, 6.5, "soft", [2.8, 2.8, 2.4]),
  ...ringCovers(18, 20, 4, 9.5, "full", [3, 1.2, 3.2], Math.PI / 8),

  // အပျက်အစီး — ပြိုကျနေတဲ့ နံရံတွေ
  ...ringCovers(-20, 22, 5, 5, "full", [4, 1, 3.4]),
  ...ringCovers(-20, 22, 5, 8, "half", [3, 1, 1.3], Math.PI / 5),

  // ★ လမ်းကြောင်းပေါ်က ကွယ်စရာ — zone ကြားက လွင်ပြင်ကို ဖြတ်တဲ့အခါ
  //   ကွယ်စရာ မရှိရင် ပထမပစ်သူပဲ နိုင်တယ်။
  ...routeCovers(),

  // ★ ကွင်းပတ်လည် ကွယ်စရာ ၃ ထပ် — zone တွေက ကွင်းရဲ့ အလယ်ပိုင်းမှာပဲ
  //   ရှိလို့ အပြင်ဘက် ကွင်းပြင်က လုံးဝ လွတ်နေတယ်။ Zone ကနေ zone
  //   ကူးတဲ့အခါ အဲဒီထဲ ဖြတ်ရရင် ပစ်မှတ်သက်သက် ဖြစ်တယ်။
  //   ★ အရေအတွက်နဲ့ အချင်းဝက်ကို ခေါင်းထဲက မထုတ်ဘဲ တွက်ထားတာ —
  //     "ဘယ်ကွက်မှ ကွယ်စရာနဲ့ ၈ unit ထက် မဝေးရ" ဆိုတဲ့ စည်းကို
  //     ဖြည့်ဆည်းတဲ့ အနည်းဆုံး တန်ဖိုးတွေ (map.test.ts က စစ်တယ်)。
  ...ringCovers(0, 0, 24, 36, "full", [3.4, 1.2, 3.6]),
  ...ringCovers(0, 0, 18, 28, "half", [3, 1, 1.3], Math.PI / 18),
  ...ringCovers(0, 0, 14, 20, "soft", [2.6, 2.6, 2.5], Math.PI / 14),
];

function routeCovers(): Cover[] {
  const out: Cover[] = [];
  const byId = new Map(zones.map((z) => [z.id, z]));
  for (const route of routes) {
    const a = byId.get(route.from)!;
    const b = byId.get(route.to)!;
    // လမ်းတစ်ကြောင်းစီမှာ ၃ နေရာ — ၂၅%, ၅၀%, ၇၅%
    for (const t of [0.25, 0.5, 0.75]) {
      const x = a.x + (b.x - a.x) * t;
      const z = a.z + (b.z - a.z) * t;
      // လမ်းရဲ့ ဘေး ၂ ဖက်စလုံးမှာ — တစ်ဖက်တည်းဆို တစ်ဖက်က မကွယ်ဘူး
      const nx = -(b.z - a.z);
      const nz = b.x - a.x;
      const len = Math.hypot(nx, nz) || 1;
      for (const side of [-1, 1]) {
        out.push({
          kind: t === 0.5 ? "full" : "half",
          x: round2(x + (nx / len) * 2.6 * side),
          z: round2(z + (nz / len) * 2.6 * side),
          w: 2.4,
          d: 1,
          h: t === 0.5 ? 2.6 : 1.2,
          ry: round2(Math.atan2(b.x - a.x, b.z - a.z)),
        });
      }
    }
  }
  return out;
}

/// ★ Spawn ၁၆ ခု — zone ၅ ခုမှာ ဖြန့်ထားတယ်၊ တစ်ခုချင်း ၈ unit အနည်းဆုံး
///   ကွာရမယ် (spec A2.3)。 နီးကပ်နေရင် ပွဲစချင်း တွေ့ကုန်ပြီး ပထမပစ်သူပဲ
///   နိုင်တယ်။
function buildSpawns(): Spawn[] {
  const out: Spawn[] = [];
  // zone အလိုက် အရေအတွက် — plaza က အလယ်မို့ နည်းနည်း (spawn camping
  // ဖြစ်လွယ်တယ်)၊ အစွန်း zone တွေမှာ များများ။
  const plan: Array<[string, number, number]> = [
    ["market", 4, 6.5],
    ["garden", 4, 7],
    ["ruins", 3, 5.5],
    // ★ ၄.၅ ဆိုရင် spawn ၃ ခုကြား ၇.၈ unit ပဲ ကွာတယ် — ၈ စည်းကို
    //   ကျော်တယ်။ ၃ ခုအတွက် အနည်းဆုံး အချင်းဝက်က 8/(2·sin60°) ≈ 4.62。
    ["tower", 3, 5.2],
    ["plaza", 2, 8],
  ];
  const byId = new Map(zones.map((z) => [z.id, z]));
  for (const [zoneId, count, radius] of plan) {
    const zone = byId.get(zoneId)!;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + zoneId.length;
      out.push({
        x: round2(zone.x + Math.cos(a) * radius),
        z: round2(zone.z + Math.sin(a) * radius),
        zone: zoneId,
      });
    }
  }
  return out;
}

export const ARENA: ArenaMap = {
  id: "arena",
  name: "ရင်ပြင်",
  worldRadius: R,
  zones,
  routes,
  spawns: buildSpawns(),
  covers,
  weather: { fixed: "clear" },
  // ★ နေ့လယ်ခင်း — အရိပ်တွေ တိုပြီး နေရာတိုင်း အလင်းရောင် တူညီတယ်။
  timeOfDay: { fixed: 0.32 },
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/// ★ ကစားသမားတွေကို တစ်နေရာတည်းမှာ မထားဘဲ ဝေတယ် — spawn တွေက
///   အစဉ်လိုက် ဖြစ်နေရင် ပထမ ၂ ယောက်က အမြဲ ဘေးချင်းကပ် ဖြစ်နေမယ်။
///   `seed` က match id — ပွဲတိုင်း ကွဲပြားစေဖို့။
export function pickSpawns(map: ArenaMap, count: number, seed = 1): Spawn[] {
  const pool = [...map.spawns];
  const out: Spawn[] = [];
  let s = seed >>> 0 || 1;
  const rand = () => {
    // xorshift — Math.random() က seed မရှိလို့ ပွဲပြန်စမ်းလို့ မရဘူး
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
  for (let i = 0; i < count && pool.length; i++) {
    out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]!);
  }
  return out;
}

/// နေရာတစ်ခုက ဘယ် zone ထဲလဲ — HUD မှာ "ဈေးထဲမှာ" ပြဖို့။
export function zoneAt(map: ArenaMap, x: number, z: number): Zone | null {
  let best: Zone | null = null;
  let bestD = Infinity;
  for (const zone of map.zones) {
    const d = Math.hypot(x - zone.x, z - zone.z);
    if (d <= zone.r && d < bestD) {
      best = zone;
      bestD = d;
    }
  }
  return best;
}
