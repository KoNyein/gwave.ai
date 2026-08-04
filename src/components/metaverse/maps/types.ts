/// Map စနစ် — **map တစ်ခုချင်းက data file ဖြစ်ရမယ်၊ hardcode မလုပ်ရ**
/// (spec 8.0 ရဲ့ မဖြစ်မနေ စည်းမျဉ်း)။
///
/// ★ ဒါက ရွေးစရာ မဟုတ်ဘူး။ Map ကို code ထဲ ရေးထည့်လိုက်ရင် map အသစ်
///   တစ်ခုတိုင်း engine ကို ပြန်ထိရတယ် — ပြီးတော့ map တစ်ခုက ကျရင်
///   ကျန်တာတွေပါ လိုက်ကျတယ်။ ဒီမှာ engine က `MapDef` တစ်ခုကို ဖတ်ပြီး
///   ဆောက်တာပဲ လုပ်တယ်၊ map အသစ်ထည့်ဖို့ data file တစ်ခု ရေးပြီး
///   `maps/index.ts` မှာ မှတ်ပုံတင်ရုံပဲ။

export type MapId = "city" | "farm" | "snow" | "sky" | "gwave-city" | "arena" | "hide-1";

export type WeatherKind =
  | "clear"
  | "rain"
  | "storm"
  | "snow"
  | "blizzard"
  | "fog"
  | "aurora";

export type VehicleKind = "car" | "drone" | "boat" | "horse" | "snowmobile" | "balloon";

export type PropKind =
  | "table"
  | "chair"
  | "shelf"
  | "counter"
  | "bed"
  | "plant"
  | "crate"
  | "screen"
  | "lamp"
  | "rug";

export type PropDef = {
  kind: PropKind;
  x: number;
  y: number;
  z: number;
  ry?: number;
  color?: number;
  scale?: number;
};

export type InteriorDef = {
  /// အခန်းအတွင်း အရွယ် — အဆောက်အအုံရဲ့ အပြင်အရွယ်ထက် သေးရမယ်
  w: number;
  h: number;
  d: number;
  floorColor: number;
  wallColor: number;
  /// တံခါးက ဘယ်ဘက်မှာလဲ — အဲဒီနံရံကို ၂ ပိုင်းခွဲပြီး အလယ်ချန်ထားတယ်
  door: { side: "N" | "S" | "E" | "W"; width: number };
  props: PropDef[];
  lights: { x: number; y: number; z: number; color: number; intensity: number }[];
};

export type RoofKind = "flat" | "gable" | "dome" | "pyramid";

export type BuildingDef = {
  x: number;
  z: number;
  w: number;
  h: number;
  d: number;
  color: number;
  roof?: RoofKind;
  roofColor?: number;
  /// ★ ရှိရင် ထဲဝင်လို့ရတယ် — အခွံအဖြစ် ဆောက်ပြီး တံခါးနေရာမှာ
  /// collider ချန်ထားတယ် (spec 8.5 က နည်း (က), loading မရှိ)
  interior?: InteriorDef;
  /// ညမှာ ပြတင်းပေါက် လင်းမယ့် အရောင်
  emissive?: number;
  label?: string;
};

export type WaterDef = {
  kind: "river" | "lake" | "sea" | "pool";
  points?: [number, number][];
  x?: number;
  z?: number;
  radius?: number;
  /// ရေမျက်နှာ အမြင့်
  level: number;
  color: number;
  opacity: number;
  flow?: number;
};

export type TerrainDef =
  | { kind: "flat" }
  /// sine လှိုင်း — လယ်ကွင်း/တောင်ကုန်း
  | { kind: "hills"; amplitude: number; frequency: number }
  /// cone တောင် — နှင်းတောင်
  | { kind: "peaks"; peaks: { x: number; z: number; r: number; h: number }[] }
  /// ပျံနေတဲ့ ကျွန်းများ
  | { kind: "islands"; islands: { x: number; y: number; z: number; r: number }[] };

/// GLB model placement — Kenney kit စတဲ့ CC0 asset တွေကို map data အဖြစ်
/// ချထားနည်း။ ★ `url` က public/ ထဲက GLB ဖြစ်ပြီး ဘေးမှာ `Textures/`
/// folder ရှိရမယ် (Kenney GLB တွေက texture ကို သီးခြားဖိုင်နဲ့ ကိုးကားတယ်)။
export type ModelDef = {
  url: string;
  x: number;
  z: number;
  /// Radian။ ★ collider ပါတဲ့ model မှာ 90° အဆတိုင်းသာ သုံးပါ — AABB
  /// collider က ထောင့်စောင်းကို မဖော်ပြနိုင်ဘူး။
  ry?: number;
  scale?: number;
  /// မြေအောက်စူးနေ/မြေပေါ်မြောနေရင် ညှိချက် (scale မပြောင်းခင် unit)
  y?: number;
  /// ရှိမှ collider ထည့်တယ် — မပါရင် အလှသက်သက် (ဖြတ်လျှောက်လို့ရ)။
  /// w/d က model unit (scale မထည့်ခင်) — engine က scale နဲ့ မြှောက်ပေးတယ်။
  collide?: { w: number; d: number };
};

export type MapDef = {
  id: MapId;
  /// မြန်မာလို နာမည် — map picker မှာ ပြတယ်
  name: string;
  emoji: string;
  blurb: string;
  spawn: { x: number; y: number; z: number; ry: number };
  worldRadius: number;
  /// ★ လျှောက်လို့ရတဲ့ အကွာအဝေး — မထည့်ရင် `worldRadius` အတိုင်း။
  /// ပျံနေတဲ့ကျွန်း map မှာ ဗဟိုကျွန်းထက် ကျော်ထွက်ရင် လေထဲ လျှောက်နေသလို
  /// ဖြစ်လို့ ဒါက မဖြစ်မနေ လိုတယ် (ကျွန်းချင်းကူးဖို့က drone — Phase 11)။
  walkRadius?: number;
  palette: {
    ground: number;
    grid: number;
    skyDay: number;
    skyDusk: number;
    skyNight: number;
    fogDay: number;
    fogNight: number;
    fogNear: number;
    fogFar: number;
  };
  terrain: TerrainDef;
  buildings: BuildingDef[];
  water: WaterDef[];
  fires: { x: number; z: number; scale: number }[];
  trees: { x: number; z: number; kind: "pine" | "palm" | "broadleaf" | "bare"; scale: number }[];
  lamps: { x: number; z: number; color: number }[];
  vehicles: { kind: VehicleKind; x: number; z: number; ry: number }[];
  /// GLB model placements (optional) — Kenney kit worlds
  models?: ModelDef[];
  weather: { default: WeatherKind; allowed: WeatherKind[] };
  ambientSound?: "city" | "forest" | "wind" | "waves";
  /// မြို့လယ် screen စတဲ့ Gwave ချိတ်ဆက်မှုတွေ
  gwaveLink?: { kind: "live" | "market" | "farm" | "class"; x: number; z: number };
};
