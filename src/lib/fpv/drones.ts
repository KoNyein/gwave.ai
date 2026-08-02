/// FPV drone catalog (drone အမျိုးအစား ရွေးချယ်စရာ)။
///
/// ★ နာမည်တွေက Gwave ကိုယ်ပိုင် fictional brand တွေ — တကယ့် brand နာမည်
///   (DJI, iFlight, …) ကို app ထဲ မသုံးဘူး (trademark)။ Class တွေကတော့
///   တကယ့် hobby ထဲက အတိုင်း — whoop / toothpick / freestyle / race /
///   long-range / cinelifter။
/// ★ Physics param တွေက drone တစ်စီးချင်းရဲ့ **ခံစားချက်** ကို ဆုံးဖြတ်တယ်
///   — mass များရင် လေးတယ်၊ thrust-to-weight များရင် ဆတ်တယ်၊ drag များရင်
///   အရှိန်သတ်တယ်။ physics.ts က ဒီတန်ဖိုးတွေကိုပဲ ဖတ်တယ်။

export type DroneSpec = {
  id: string;
  /// ပြသမယ့် နာမည် (fictional brand + model)
  name: string;
  /// Class — UI filter အတွက်
  cls: "whoop" | "toothpick" | "freestyle" | "race" | "longrange" | "cine";
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
};

export const DRONES: DroneSpec[] = [
  {
    id: "nano65",
    name: "GW Nano 65",
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
