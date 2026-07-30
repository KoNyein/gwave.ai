/**
 * Labels and copy for the community mine-site map.
 *
 * Trilingual (Burmese / English / Thai) like the cannabis board, because the
 * same trader reads the metal board in one language and the map in another.
 * Kept in its own module so the board, the pin layer and the admin queue all
 * name a mineral the same way.
 */

export type MLang = "my" | "en" | "th";

export const MINE_METALS = [
  "tin",
  "antimony",
  "rare_earth",
  "tungsten",
  "copper",
  "gold",
  "zinc_lead",
  "nickel",
  "jade",
  "ruby",
  "sapphire",
  "amber",
  "coal",
  "silver",
  "iron",
  "other",
] as const;

export type MineMetal = (typeof MINE_METALS)[number];

/** Emoji marker + brand colour per mineral, used by the map pins and chips. */
export const METAL_STYLE: Record<MineMetal, { emoji: string; color: string }> =
  {
    tin: { emoji: "⚙️", color: "#64748b" },
    antimony: { emoji: "🜍", color: "#7c3aed" },
    rare_earth: { emoji: "🧲", color: "#0ea5e9" },
    tungsten: { emoji: "🔩", color: "#475569" },
    copper: { emoji: "🟠", color: "#c2410c" },
    gold: { emoji: "🥇", color: "#d97706" },
    zinc_lead: { emoji: "🔗", color: "#6b7280" },
    nickel: { emoji: "🪙", color: "#0891b2" },
    jade: { emoji: "💚", color: "#059669" },
    ruby: { emoji: "❤️", color: "#dc2626" },
    sapphire: { emoji: "💙", color: "#2563eb" },
    amber: { emoji: "🟡", color: "#ca8a04" },
    coal: { emoji: "⬛", color: "#334155" },
    silver: { emoji: "🥈", color: "#94a3b8" },
    iron: { emoji: "🧱", color: "#991b1b" },
    other: { emoji: "⛏", color: "#6b7280" },
  };

const METAL_NAMES: Record<MLang, Record<MineMetal, string>> = {
  my: {
    tin: "ခဲမဖြူ (Tin)",
    antimony: "ခနောက်စိမ်း (Antimony)",
    rare_earth: "ရှားပါးမြေ (Rare earth)",
    tungsten: "ဝူဖရမ် (Tungsten)",
    copper: "ကြေးနီ (Copper)",
    gold: "ရွှေ (Gold)",
    zinc_lead: "သွပ် / ခဲ (Zinc / Lead)",
    nickel: "နီကယ် (Nickel)",
    jade: "ကျောက်စိမ်း (Jade)",
    ruby: "ပတ္တမြား (Ruby)",
    sapphire: "နီလာ (Sapphire)",
    amber: "ပယင်း (Amber)",
    coal: "ကျောက်မီးသွေး (Coal)",
    silver: "ငွေ (Silver)",
    iron: "သံ (Iron)",
    other: "အခြား (Other)",
  },
  en: {
    tin: "Tin",
    antimony: "Antimony",
    rare_earth: "Rare earth",
    tungsten: "Tungsten",
    copper: "Copper",
    gold: "Gold",
    zinc_lead: "Zinc / Lead",
    nickel: "Nickel",
    jade: "Jade",
    ruby: "Ruby",
    sapphire: "Sapphire",
    amber: "Amber",
    coal: "Coal",
    silver: "Silver",
    iron: "Iron",
    other: "Other",
  },
  th: {
    tin: "ดีบุก (Tin)",
    antimony: "พลวง (Antimony)",
    rare_earth: "แร่หายาก (Rare earth)",
    tungsten: "ทังสเตน",
    copper: "ทองแดง",
    gold: "ทองคำ",
    zinc_lead: "สังกะสี / ตะกั่ว",
    nickel: "นิกเกิล",
    jade: "หยก",
    ruby: "ทับทิม",
    sapphire: "ไพลิน",
    amber: "อำพัน",
    coal: "ถ่านหิน",
    silver: "เงิน",
    iron: "เหล็ก",
    other: "อื่น ๆ",
  },
};

export function metalName(metal: string, lang: MLang): string {
  const table = METAL_NAMES[lang];
  return table[metal as MineMetal] ?? metal;
}

export function metalStyle(metal: string) {
  return METAL_STYLE[metal as MineMetal] ?? METAL_STYLE.other;
}

export const SCALES = ["artisanal", "small", "industrial", "unknown"] as const;
export const STATUSES = [
  "active",
  "seasonal",
  "suspended",
  "abandoned",
  "unknown",
] as const;

const STRINGS = {
  my: {
    title: "မိုင်းနေရာ မြေပုံ (Mine sites)",
    subtitle:
      "မြန်မာပြည်တွင်း သတ္တုတွင်း နေရာများ — user များ စုစည်းပေးထားသည်။ ရှာ၊ ထည့်၊ ပြင်၊ တိုင်ကြားနိုင်သည်။",
    all: "အားလုံး",
    add: "+ မိုင်းနေရာ ထည့်",
    close: "ပိတ်မည်",
    save: "သိမ်းမည်",
    saving: "သိမ်းနေသည်…",
    edit: "ပြင်မည်",
    report: "တိုင်ကြားမည်",
    del: "ဖျက်မည်",
    search: "မိုင်းအမည် / မြို့နယ် / ပြည်နယ် ရှာရန်",
    metal: "သတ္တုအမျိုးအစား *",
    name: "မိုင်းအမည် *",
    region: "ပြည်နယ် / တိုင်း *",
    township: "မြို့နယ် *",
    photos: "ဓာတ်ပုံ (၁ ပုံအနည်းဆုံး) *",
    pickOnMap: "မြေပုံပေါ် နှိပ်၍ တည်နေရာ ရွေးပါ *",
    useGps: "ကျွန်ုပ်တည်နေရာ သုံးမည်",
    scale: "လုပ်ငန်းအရွယ်အစား",
    status: "လက်ရှိအခြေအနေ",
    operator: "လုပ်ကိုင်သူ / ကုမ္ပဏီ",
    desc: "အကြောင်းအရာ",
    access: "သွားရောက်ရန် လမ်းကြောင်း",
    hazard: "အန္တရာယ် သတိပေးချက်",
    tags: "အမှတ်အသား (ဥပမာ — open pit, alluvial)",
    required:
      "ဖြည့်ရန် လိုအပ်သည် — သတ္တုအမျိုးအစား၊ အမည်၊ ပြည်နယ်၊ မြို့နယ်၊ တည်နေရာနှင့် ဓာတ်ပုံ ၁ ပုံ။",
    empty:
      "မိုင်းနေရာ မရှိသေးပါ — ပထမဆုံး ထည့်သူ ဖြစ်လိုက်ပါ။ ဓာတ်ပုံ၊ မြို့နယ်နှင့် တည်နေရာ အတိအကျ ဖြည့်ပါ။",
    reportPrompt: "အကြောင်းရင်း (ဥပမာ — နေရာမှား / ပိတ်သွားပြီ / အတုအယောင်)",
    reported: "တိုင်ကြားပြီးပါပြီ — admin စစ်ဆေးပါလိမ့်မယ်။",
    reports: "တိုင်ကြားချက်",
    hint: "အချက်အလက် မှားနေရင် user တိုင်း ပြင်ခွင့်ရှိသည်။ မှားတဲ့/အတုအယောင် နေရာများကို တိုင်ကြားပါ — admin ဖျက်ပါလိမ့်မယ်။",
    directions: "လမ်းညွှန်",
    coords: "ကိုသြဒိနိတ်",
    sites: "နေရာ",
    disclaimer:
      "⚠ ဤမြေပုံသည် user များ တင်ပြထားသော အချက်အလက်များသာ ဖြစ်သည် — တရားဝင် အတည်ပြုချက် မဟုတ်ပါ။ လမ်းကြောင်းနှင့် အန္တရာယ် အချက်အလက်များကို ကိုယ်တိုင် ထပ်မံ စစ်ဆေးပါ။ ခွင့်ပြုချက်မရှိဘဲ သတ္တုတူးဖော်ခြင်းသည် တရားမဝင်ပါ။",
    guide: "အသုံးပြုနည်း",
    guideBody:
      "၁။ အပေါ်က သတ္တုအမျိုးအစား ခလုတ်များဖြင့် စစ်ထုတ်ပါ။\n၂။ မြေပုံပေါ်က အမှတ်အသားကို နှိပ်ပြီး အသေးစိတ် ကြည့်ပါ။\n၃။ နေရာအသစ်ထည့်ရန် “+ မိုင်းနေရာ ထည့်” ကို နှိပ်ပါ — ဓာတ်ပုံ၊ မြို့နယ်နှင့် မြေပုံပေါ်တွင် တည်နေရာ အတိအကျ ရွေးရပါမည်။\n၄။ မှားနေသည်ဟု ထင်ပါက “ပြင်မည်” သို့မဟုတ် “တိုင်ကြားမည်” ကို သုံးပါ။",
    scales: {
      artisanal: "ရိုးရာ / လက်လုပ်",
      small: "သေးစား",
      industrial: "စက်မှုလုပ်ငန်း",
      unknown: "မသိရသေး",
    },
    statuses: {
      active: "လုပ်ကိုင်ဆဲ",
      seasonal: "ရာသီအလိုက်",
      suspended: "ခေတ္တရပ်",
      abandoned: "စွန့်ပစ်ပြီး",
      unknown: "မသိရသေး",
    },
  },
  en: {
    title: "Mine sites map",
    subtitle:
      "Myanmar mineral sites, mapped by the community. Search, add, correct, report.",
    all: "All",
    add: "+ Add a mine site",
    close: "Close",
    save: "Save",
    saving: "Saving…",
    edit: "Edit",
    report: "Report",
    del: "Delete",
    search: "Search mine, township or state",
    metal: "Mineral *",
    name: "Mine name *",
    region: "State / Region *",
    township: "Township *",
    photos: "Photos (at least 1) *",
    pickOnMap: "Tap the map to set the exact location *",
    useGps: "Use my location",
    scale: "Scale",
    status: "Current status",
    operator: "Operator / company",
    desc: "Description",
    access: "How to get there",
    hazard: "Hazard warnings",
    tags: "Tags (e.g. open pit, alluvial)",
    required:
      "Required — mineral, name, state/region, township, location and at least one photo.",
    empty:
      "No mine sites yet — be the first. Add photos, the township and the exact location.",
    reportPrompt: "Reason (e.g. wrong location / closed / fake)",
    reported: "Reported — an admin will review it.",
    reports: "reports",
    hint: "Anything wrong? Any user can fix a listing. Report fake or wrong entries and an admin will remove them.",
    directions: "Directions",
    coords: "Coordinates",
    sites: "sites",
    disclaimer:
      "⚠ This map is user-submitted information, not an official record. Verify access routes and hazards yourself before travelling. Mining without a licence is illegal.",
    guide: "How to use",
    guideBody:
      "1. Filter by mineral with the chips above.\n2. Tap a pin on the map to open the full listing.\n3. Use “+ Add a mine site” to contribute — photos, township and an exact point on the map are required.\n4. If something looks wrong, use Edit or Report.",
    scales: {
      artisanal: "Artisanal / hand dug",
      small: "Small scale",
      industrial: "Industrial",
      unknown: "Unknown",
    },
    statuses: {
      active: "Active",
      seasonal: "Seasonal",
      suspended: "Suspended",
      abandoned: "Abandoned",
      unknown: "Unknown",
    },
  },
  th: {
    title: "แผนที่แหล่งเหมืองแร่",
    subtitle:
      "แหล่งแร่ในเมียนมา รวบรวมโดยผู้ใช้ — ค้นหา เพิ่ม แก้ไข และรายงานได้",
    all: "ทั้งหมด",
    add: "+ เพิ่มแหล่งเหมือง",
    close: "ปิด",
    save: "บันทึก",
    saving: "กำลังบันทึก…",
    edit: "แก้ไข",
    report: "รายงาน",
    del: "ลบ",
    search: "ค้นหาชื่อเหมือง อำเภอ หรือรัฐ",
    metal: "ชนิดแร่ *",
    name: "ชื่อเหมือง *",
    region: "รัฐ / ภูมิภาค *",
    township: "อำเภอ *",
    photos: "รูปภาพ (อย่างน้อย 1 รูป) *",
    pickOnMap: "แตะบนแผนที่เพื่อระบุพิกัดที่แน่นอน *",
    useGps: "ใช้ตำแหน่งของฉัน",
    scale: "ขนาดกิจการ",
    status: "สถานะปัจจุบัน",
    operator: "ผู้ดำเนินการ / บริษัท",
    desc: "รายละเอียด",
    access: "เส้นทางเข้าถึง",
    hazard: "คำเตือนอันตราย",
    tags: "แท็ก (เช่น open pit, alluvial)",
    required:
      "ต้องกรอก — ชนิดแร่ ชื่อ รัฐ อำเภอ พิกัด และรูปอย่างน้อย 1 รูป",
    empty:
      "ยังไม่มีแหล่งเหมือง — เป็นคนแรกเลย เพิ่มรูป อำเภอ และพิกัดที่แน่นอน",
    reportPrompt: "เหตุผล (เช่น พิกัดผิด / ปิดแล้ว / ปลอม)",
    reported: "รายงานแล้ว — ผู้ดูแลจะตรวจสอบ",
    reports: "รายงาน",
    hint: "ข้อมูลผิด? ผู้ใช้ทุกคนแก้ไขได้ รายงานรายการปลอมหรือผิด ผู้ดูแลจะลบให้",
    directions: "เส้นทาง",
    coords: "พิกัด",
    sites: "แห่ง",
    disclaimer:
      "⚠ แผนที่นี้เป็นข้อมูลที่ผู้ใช้ส่งเข้ามา ไม่ใช่ข้อมูลทางการ โปรดตรวจสอบเส้นทางและอันตรายด้วยตนเองก่อนเดินทาง การทำเหมืองโดยไม่มีใบอนุญาตผิดกฎหมาย",
    guide: "วิธีใช้",
    guideBody:
      "1. กรองตามชนิดแร่จากปุ่มด้านบน\n2. แตะหมุดบนแผนที่เพื่อดูรายละเอียด\n3. กด “+ เพิ่มแหล่งเหมือง” เพื่อร่วมเพิ่มข้อมูล — ต้องมีรูป อำเภอ และพิกัดที่แน่นอน\n4. หากข้อมูลผิด ใช้ปุ่มแก้ไขหรือรายงาน",
    scales: {
      artisanal: "ทำมือ / ดั้งเดิม",
      small: "ขนาดเล็ก",
      industrial: "อุตสาหกรรม",
      unknown: "ไม่ทราบ",
    },
    statuses: {
      active: "เปิดดำเนินการ",
      seasonal: "ตามฤดูกาล",
      suspended: "หยุดชั่วคราว",
      abandoned: "ถูกทิ้งร้าง",
      unknown: "ไม่ทราบ",
    },
  },
};

/**
 * Typed against the Burmese table so a missing key in `en`/`th` is a compile
 * error rather than an `undefined` rendered into the page.
 */
export const MSTR: Record<MLang, typeof STRINGS.my> = STRINGS;

export const MLANG_LABEL: Record<MLang, string> = {
  my: "မြန်မာ",
  en: "EN",
  th: "ไทย",
};

export function nextMLang(lang: MLang): MLang {
  return lang === "my" ? "en" : lang === "en" ? "th" : "my";
}
