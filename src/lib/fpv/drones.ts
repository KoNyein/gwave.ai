/// FPV drone catalog (drone အမျိုးအစား ရွေးချယ်စရာ)။
///
/// ★ နာမည်အများစုက Gwave ကိုယ်ပိုင် fictional brand တွေ။ Class တွေကတော့
///   တကယ့် hobby ထဲက အတိုင်း — whoop / toothpick / freestyle / race /
///   long-range / cinelifter။
/// ★ **Reference models** (`reference: true`) ကတော့ ခြွင်းချက် — တကယ်ရှိတဲ့
///   ကိရိယာတွေရဲ့ ထုတ်လုပ်သူ ကြေညာချက်အတိုင်း ပျံသန်းမှုပုံစံကို
///   တုပထားတာဖြစ်လို့ အဲဒီနာမည်နဲ့ပဲ ခေါ်ရမယ် — "3 လက်မ ducted quad" လို့
///   ခေါ်လိုက်ရင် ဘယ်စက်လဲ ဆိုတာ ဘယ်သူမှ မသိတော့ဘူး။ Trademark တွေက
///   သက်ဆိုင်ရာ ပိုင်ရှင်တွေ့ဆိုင်ရာ ဖြစ်ပြီး Gwave နဲ့ ဆက်စပ်မှု မရှိကြောင်း
///   UI မှာ ဖော်ပြထားတယ် (nominative use)。
/// ★ Reference model တွေရဲ့ ဂဏန်းတွေက **ထုတ်လုပ်သူ ကြေညာထားတဲ့ spec**
///   (အလေးချိန်၊ အမြင့်ဆုံးအရှိန်၊ ပျံသန်းချိန်) ကနေ လာတယ်။ ခန့်မှန်းရတဲ့
///   ဟာတွေကို comment မှာ အတိအလင်း မှတ်ထားတယ် — မသိတာကို သိသလို
///   မရေးရ။
/// ★ Physics param တွေက drone တစ်စီးချင်းရဲ့ **ခံစားချက်** ကို ဆုံးဖြတ်တယ်
///   — mass များရင် လေးတယ်၊ thrust-to-weight များရင် ဆတ်တယ်၊ drag များရင်
///   အရှိန်သတ်တယ်။ physics.ts က ဒီတန်ဖိုးတွေကိုပဲ ဖတ်တယ်။

export type DroneSpec = {
  id: string;
  /// ပြသမယ့် နာမည် (fictional brand + model)
  name: string;
  /// ✈️ ယာဉ်အမျိုးအစား — physics လမ်းကြောင်း သီးခြားစီ:
  /// quad = multirotor (FPV drone), plane = fixed-wing, heli = helicopter
  craft: "quad" | "plane" | "heli";
  /// Class — UI filter အတွက်
  cls: "whoop" | "toothpick" | "freestyle" | "race" | "longrange" | "cine" | "trainer" | "wing" | "heli3d" | "scale";
  /// Prop size ။ ဥပမာ 65mm / 3" / 5"
  size: string;
  /// မြန်မာလို အကျဉ်းချုပ်
  blurbMy: string;
  /// စုစုပေါင်း အလေးချိန် kg (battery ပါပြီး)
  mass: number;
  /// မော်တာ ၄ လုံးပေါင်း အများဆုံး thrust (Newton)
  maxThrust: number;
  /// Linear drag coefficient (လေခုခံမှု — frame ကြီးလေ များလေ)
  dragLinear: number;
  /// Quadratic drag (အမြန်နှုန်းမြင့်မှ သိသာတယ်)
  dragQuad: number;
  /// Betaflight-style rates — stick အပြည့်ထိုးရင် ရမယ့် deg/s
  rcRate: number;
  superRate: number;
  expo: number;
  /// Rate response time constant (s) — သေးလေ ဆတ်လေ
  rateTau: number;
  /// Angle mode မှာ အများဆုံး tilt (deg)
  maxAngle: number;
  /// FPV ကင်မရာ တပ်ထားတဲ့ ထောင့် (deg) — race လေ များလေ
  camTilt: number;
  /// 3D model scale (5" = 1)
  scale: number;
  /// Battery ခန့် (s) — OSD timer ပြဖို့ပဲ
  batterySec: number;
  /// Frame အရောင်
  color: number;
  /// ── Fixed-wing (plane) သီးသန့် ──
  /// Lift coefficient — airspeed² နဲ့ မြှောက်ပြီး အပေါ်တင်အား ရတယ်
  liftK?: number;
  /// Stall speed (m/s) — ဒီအောက် နှေးရင် နှာခေါင်းစိုက်ကျတယ်
  stallSpeed?: number;

  /// ── Reference (real-world) models ──
  /// တကယ်ရှိတဲ့ ကိရိယာတစ်ခုကို တုပထားတာလား — UI မှာ trademark မှတ်ချက်
  /// ပြဖို့။
  reference?: boolean;
  /// Ducted (cinewhoop / Avata ပုံစံ) — prop ကို duct နဲ့ ဝိုင်းထားတာ။
  /// ★ Duct က မြေပြင်နားမှာ တွန်းအားပိုပေးပြီး အရှိန်မြင့်ရင် drag ပိုတယ်။
  ducted?: boolean;
  /// Spec မှတ်ချက် (source / ခန့်မှန်းချက် ဖော်ပြရန်)
  specNote?: string;
};

export const DRONES: DroneSpec[] = [
  {
    id: "nano65",
    name: "GW Nano 65",
    craft: "quad",
    cls: "whoop",
    size: "65mm",
    blurbMy: "အိမ်တွင်း လေ့ကျင့်ရေး whoop — နှေးပြီး ခွင့်လွှတ်တတ်တယ်၊ အစပျိုးသူအတွက် အကောင်းဆုံး။",
    mass: 0.032,
    maxThrust: 0.8,
    dragLinear: 0.35,
    dragQuad: 0.02,
    rcRate: 0.9,
    superRate: 0.62,
    expo: 0.35,
    rateTau: 0.055,
    maxAngle: 40,
    camTilt: 12,
    scale: 0.45,
    batterySec: 210,
    color: 0xf5c542,
  },
  {
    id: "pico75",
    name: "GW Pico 75 HD",
    craft: "quad",
    cls: "whoop",
    size: "75mm",
    blurbMy: "HD whoop — အိမ်တွင်း/ရုံးတွင်း cinematic ရိုက်ချက်အတွက်၊ တည်ငြိမ်တယ်။",
    mass: 0.058,
    maxThrust: 1.25,
    dragLinear: 0.32,
    dragQuad: 0.022,
    rcRate: 0.85,
    superRate: 0.58,
    expo: 0.38,
    rateTau: 0.06,
    maxAngle: 38,
    camTilt: 15,
    scale: 0.5,
    batterySec: 240,
    color: 0x9ad1f5,
  },
  {
    id: "stik25",
    name: "Falcon Stick 2.5",
    craft: "quad",
    cls: "toothpick",
    size: "2.5\"",
    blurbMy: "Toothpick — ပေါ့ပြီး သွက်တယ်၊ ပန်းခြံသေးသေးမှာ freestyle စမ်းလို့ကောင်းတယ်။",
    mass: 0.075,
    maxThrust: 2.4,
    dragLinear: 0.24,
    dragQuad: 0.02,
    rcRate: 1.0,
    superRate: 0.68,
    expo: 0.3,
    rateTau: 0.045,
    maxAngle: 45,
    camTilt: 20,
    scale: 0.62,
    batterySec: 270,
    color: 0x7ee08a,
  },
  {
    id: "vortex35",
    name: "Vortex 3.5 Lite",
    craft: "quad",
    cls: "freestyle",
    size: "3.5\"",
    blurbMy: "Sub-250g freestyle — စည်းကမ်းချက်အောက်မှာ freestyle အပြည့်အစုံ။",
    mass: 0.24,
    maxThrust: 7.5,
    dragLinear: 0.2,
    dragQuad: 0.024,
    rcRate: 1.0,
    superRate: 0.7,
    expo: 0.3,
    rateTau: 0.04,
    maxAngle: 50,
    camTilt: 25,
    scale: 0.78,
    batterySec: 300,
    color: 0xc78bf0,
  },
  {
    id: "raptor5",
    name: "Raptor F5",
    craft: "quad",
    cls: "freestyle",
    size: "5\"",
    blurbMy: "5 လက်မ freestyle အဓိက — power နဲ့ ထိန်းချုပ်မှု မျှတဆုံး၊ acro သင်ဖို့ စံ။",
    mass: 0.68,
    maxThrust: 26,
    dragLinear: 0.16,
    dragQuad: 0.028,
    rcRate: 1.05,
    superRate: 0.72,
    expo: 0.28,
    rateTau: 0.035,
    maxAngle: 55,
    camTilt: 30,
    scale: 1,
    batterySec: 240,
    color: 0x44bba4,
  },
  {
    id: "viper5r",
    name: "Viper R5 Race",
    craft: "quad",
    cls: "race",
    size: "5\"",
    blurbMy: "ပြိုင်ပွဲ spec — thrust အပြင်းဆုံး၊ ခလုတ်ဆတ်ဆတ်၊ ကင်မရာထောင့် မြင့်တယ်။",
    mass: 0.58,
    maxThrust: 32,
    dragLinear: 0.13,
    dragQuad: 0.024,
    rcRate: 1.2,
    superRate: 0.78,
    expo: 0.22,
    rateTau: 0.028,
    maxAngle: 60,
    camTilt: 42,
    scale: 0.95,
    batterySec: 180,
    color: 0xf06a6a,
  },
  {
    id: "condor7",
    name: "Condor LR7",
    craft: "quad",
    cls: "longrange",
    size: "7\"",
    blurbMy: "Long-range — လေထဲ လွင့်တာ ချောတယ်၊ တောင်ကြားခရီး/ရှုခင်းရိုက်ဖို့။",
    mass: 0.95,
    maxThrust: 30,
    dragLinear: 0.22,
    dragQuad: 0.034,
    rcRate: 0.85,
    superRate: 0.6,
    expo: 0.35,
    rateTau: 0.055,
    maxAngle: 45,
    camTilt: 20,
    scale: 1.25,
    batterySec: 420,
    color: 0x8fa8c9,
  },
  {
    id: "mammoth8",
    name: "Mammoth X8 Cine",
    craft: "quad",
    cls: "cine",
    size: "8\"",
    blurbMy: "Cinelifter — လေးပြီး တည်ငြိမ်တယ်၊ cinematic mode နဲ့ တွဲရင် ရုပ်ရှင်ရိုက်သလို။",
    mass: 1.6,
    maxThrust: 46,
    dragLinear: 0.3,
    dragQuad: 0.045,
    rcRate: 0.7,
    superRate: 0.5,
    expo: 0.4,
    rateTau: 0.07,
    maxAngle: 35,
    camTilt: 12,
    scale: 1.45,
    batterySec: 300,
    color: 0x555f6e,
  },

  // ── 📷 Reference models (တကယ်ရှိတဲ့ ကိရိယာများ) ───────────────────────
  // Published manufacturer figures where they exist; anything inferred is
  // called out in `specNote` rather than presented as fact.
  {
    id: "avata2",
    name: "DJI Avata 2",
    craft: "quad",
    cls: "cine",
    size: "3\" ducted",
    blurbMy: "Duct ပါတဲ့ cinewhoop — ၃၇၇g၊ အမြန်ဆုံး ~၂၇ m/s (Manual)။ ပွတ်တိုက်မိလည်း prop မထိလို့ အိမ်တွင်း/လူနားမှာ ပျံရတာ အန္တရာယ်နည်းတယ်။",
    // Published: 377 g takeoff weight, 27 m/s max (Manual mode), 23 min.
    mass: 0.377,
    // Thrust is not published. Derived from the ~3.5:1 thrust-to-weight a
    // 377 g ducted 3-inch needs to reach its quoted climb and top speed —
    // marked as derived, not quoted.
    maxThrust: 13.0,
    // Ducts add frontal area: noticeably draggier than an open 3-inch.
    dragLinear: 0.30,
    dragQuad: 0.055,
    rcRate: 1.0,
    superRate: 0.62,
    expo: 0.30,
    rateTau: 0.055,
    maxAngle: 35,
    camTilt: 20,
    scale: 0.62,
    batterySec: 1380, // 23 min published
    color: 0xdedede,
    reference: true,
    ducted: true,
    specNote: "မော်တာ thrust ကို ကြေညာမထားလို့ အလေးချိန်/အရှိန်ကနေ ခန့်မှန်းထားသည်။",
  },
  {
    id: "o3build",
    name: "5\" freestyle · O3 Air Unit",
    craft: "quad",
    cls: "freestyle",
    size: "5\"",
    blurbMy: "O3 Air Unit တင်ထားတဲ့ 5 လက်မ freestyle build — HD ရိုက်ချက်နဲ့ freestyle စွမ်းအား နှစ်ခုလုံး ရတယ်။ VTX က ~၃၆g မို့ analog build ထက် နည်းနည်း လေးတယ်။",
    // ★ O3 / O4 Air Unit are DJI's *video systems*, not aircraft — they are
    //   bolted onto a build the pilot makes. So the airframe here is a normal
    //   5-inch freestyle quad, and what the "O3" changes is 36 g of mass and
    //   the camera it carries.
    mass: 0.700,
    maxThrust: 26.0,
    dragLinear: 0.22,
    dragQuad: 0.042,
    rcRate: 1.15,
    superRate: 0.72,
    expo: 0.22,
    rateTau: 0.040,
    maxAngle: 55,
    camTilt: 30,
    scale: 1,
    batterySec: 300,
    color: 0x4fc3f7,
    reference: true,
    specNote: "O3 Air Unit ~36g (camera+antenna ပါ)။ Airframe က ပုံမှန် 5\" freestyle build။",
  },
  {
    id: "o4build",
    name: "5\" freestyle · O4 Air Unit Pro",
    craft: "quad",
    cls: "freestyle",
    size: "5\"",
    blurbMy: "O4 Air Unit Pro တင်ထားတဲ့ 5 လက်မ build — O3 ထက် ပေါ့ပြီး latency နည်းတယ်၊ ပျံရတာ နည်းနည်း ဆတ်တယ်။",
    mass: 0.690,
    maxThrust: 26.0,
    dragLinear: 0.22,
    dragQuad: 0.042,
    rcRate: 1.18,
    superRate: 0.73,
    expo: 0.20,
    rateTau: 0.038,
    maxAngle: 55,
    camTilt: 30,
    scale: 1,
    batterySec: 300,
    color: 0x7e57c2,
    reference: true,
    specNote: "O4 Air Unit Pro က O3 ထက် ပေါ့တယ် — ခန့်မှန်း ၁၀g ခန့် ကွာသည်။",
  },
  {
    id: "trainer12",
    name: "GW Trainer 1200",
    craft: "plane",
    cls: "trainer",
    size: "1.2m",
    blurbMy:
      "High-wing trainer လေယာဉ် — တည်ငြိမ်ပြီး ခွင့်လွှတ်တတ်တယ်။ Throttle တင်ပြီး မြေပြင်ပေါ် ပြေးတက်၊ stall မဖြစ်အောင် အရှိန်ထိန်း။",
    mass: 1.1,
    maxThrust: 9,
    dragLinear: 0.08,
    dragQuad: 0.01,
    rcRate: 0.55,
    superRate: 0.4,
    expo: 0.35,
    rateTau: 0.09,
    maxAngle: 45,
    camTilt: 2,
    scale: 1.6,
    batterySec: 600,
    color: 0xf0efe8,
    liftK: 0.075,
    stallSpeed: 7,
  },
  {
    id: "wing900",
    name: "Falcon Wing 900",
    craft: "plane",
    cls: "wing",
    size: "0.9m",
    blurbMy:
      "Flying wing — မြန်နှုန်းမြင့် FPV cruiser။ တုံ့ပြန်မှု ဆတ်ပြီး stall speed မြင့်လို့ အတွေ့အကြုံရှိမှ ကောင်းတယ်။",
    mass: 0.75,
    maxThrust: 11,
    dragLinear: 0.05,
    dragQuad: 0.008,
    rcRate: 0.85,
    superRate: 0.55,
    expo: 0.28,
    rateTau: 0.06,
    maxAngle: 60,
    camTilt: 0,
    scale: 1.3,
    batterySec: 480,
    color: 0x2d2f38,
    liftK: 0.06,
    stallSpeed: 10,
  },

  // ── 🚁 Helicopter (ဟယ်လီကော်ပတာ) ─────────────────────────────────────
  {
    id: "heli450",
    name: "GW Heli 450",
    craft: "heli",
    size: "450",
    cls: "heli3d",
    blurbMy:
      "Collective-pitch heli — throttle အလယ် (50%) မှာ ရပ်နေတယ် (hover)။ Cyclic နဲ့ တိမ်းရွှေ့၊ tail နဲ့ လှည့် — heli သီးသန့် လက်တွေ့ခံစားချက်။",
    mass: 0.9,
    maxThrust: 24,
    dragLinear: 0.32,
    dragQuad: 0.03,
    rcRate: 0.7,
    superRate: 0.45,
    expo: 0.35,
    rateTau: 0.09,
    maxAngle: 40,
    camTilt: 8,
    scale: 1.35,
    batterySec: 300,
    color: 0xe8b33d,
  },
  {
    id: "heli700",
    name: "Ayeyar Scale 700",
    craft: "heli",
    size: "700",
    cls: "scale",
    blurbMy:
      "Scale heli ကြီး — လေးလံတည်ငြိမ်၊ ရုပ်ရှင်ရိုက်/ခရီးပျံသလို ချောချောမောင်းဖို့။",
    mass: 3.2,
    maxThrust: 70,
    dragLinear: 0.4,
    dragQuad: 0.05,
    rcRate: 0.5,
    superRate: 0.35,
    expo: 0.4,
    rateTau: 0.13,
    maxAngle: 30,
    camTilt: 5,
    scale: 1.9,
    batterySec: 420,
    color: 0xb03a3a,
  },
];

export const CRAFTS: { id: DroneSpec["craft"]; emoji: string; nameMy: string }[] = [
  { id: "quad", emoji: "🛸", nameMy: "FPV Drone" },
  { id: "plane", emoji: "✈️", nameMy: "လေယာဉ်" },
  { id: "heli", emoji: "🚁", nameMy: "ဟယ်လီကော်ပတာ" },
];

export function getDrone(id: string): DroneSpec {
  return DRONES.find((d) => d.id === id) ?? DRONES[4]!;
}

/// Flight mode — physics.ts နဲ့ UI နှစ်ခုလုံးက သုံးတယ်။
/// - acro       : rate mode အပြည့် — self-level မရှိ၊ flip/roll လွတ်လပ်
/// - freestyle  : acro ပဲ၊ ဒါပေမယ့် rates အနည်းငယ် ပျော့ + air smoothing
/// - sport      : angle mode မြန်နှုန်းမြင့် — stick လွှတ်ရင် ပြန်ညီတယ်
/// - cinematic  : angle mode နှေးချော — ကင်မရာ low-pass နဲ့ ရိုက်ချက်ချော
export type FlightMode = "acro" | "freestyle" | "sport" | "cinematic";

export const MODES: {
  id: FlightMode;
  nameMy: string;
  blurbMy: string;
  /// rates ကို ဘယ်လောက် ချုပ်မလဲ (1 = drone spec အတိုင်း)
  rateScale: number;
  /// angle mode လား
  angle: boolean;
  /// angle mode ရဲ့ tilt ကန့်သတ် scale
  angleScale: number;
  /// ကင်မရာ smoothing (0 = မရှိ, 1 = အချောဆုံး)
  camSmooth: number;
}[] = [
  {
    id: "acro",
    nameMy: "Acro — rate mode အပြည့်၊ flip/roll လွတ်လပ်",
    blurbMy: "Self-level မရှိ။ တကယ့် FPV လေ့ကျင့်ရေး စံ mode။",
    rateScale: 1,
    angle: false,
    angleScale: 1,
    camSmooth: 0,
  },
  {
    id: "freestyle",
    nameMy: "Freestyle — acro ပျော့ပျော့",
    blurbMy: "Acro ပဲ၊ rates အနည်းငယ် ပျော့လို့ trick သင်ရ လွယ်တယ်။",
    rateScale: 0.85,
    angle: false,
    angleScale: 1,
    camSmooth: 0.15,
  },
  {
    id: "sport",
    nameMy: "Sport — self-level မြန်မြန်",
    blurbMy: "Stick လွှတ်ရင် ပြန်ညီတယ်၊ ဒါပေမယ့် တိမ်းနှုန်း မြင့်လို့ မြန်မြန်မောင်းလို့ရတယ်။",
    rateScale: 1,
    angle: true,
    angleScale: 1,
    camSmooth: 0.25,
  },
  {
    id: "cinematic",
    nameMy: "Cinematic — နှေးချော ရိုက်ချက်",
    blurbMy: "တိမ်းထောင့်ကန့်သတ် + ကင်မရာ smoothing — ရှုခင်းရိုက်ဖို့။",
    rateScale: 0.5,
    angle: true,
    angleScale: 0.55,
    camSmooth: 0.85,
  },
];

export function getMode(id: FlightMode) {
  return MODES.find((m) => m.id === id) ?? MODES[0]!;
}
