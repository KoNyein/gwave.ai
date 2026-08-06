/// Avatar ရဲ့ အသွင်အပြင် — **JSON တစ်ခုတည်း** (spec 15.1)။
///
/// ★ `v` field က version။ အနာဂတ်မှာ ပုံစံပြောင်းရင် သိမ်းထားပြီးသား config
///   တွေကို migrate လုပ်လို့ရအောင် — မပါရင် လူတိုင်းရဲ့ avatar က တစ်နေ့
///   ရုတ်တရက် ပျက်သွားမယ်။
/// ★ **Client ရော server ရော ဒီ file တစ်ခုတည်းကို သုံးတယ်** — schema
///   validate က ၂ နေရာ ကွဲနေရင် client က ခွင့်ပြုပြီး server က ငြင်းတာမျိုး
///   ဖြစ်တယ်။

export type AvatarConfig = {
  v: 1;
  body: { skin: number; height: number; build: "slim" | "normal" | "broad" };
  hair: { style: string; color: number };
  face: { eyes: string; brows: string; mouth: string };
  outfit: {
    top: string;
    topColor: number;
    bottom: string;
    bottomColor: number;
    shoes: string;
    shoesColor: number;
  };
  /// ★ အများဆုံး ၃ ခု — ဒီထက်များရင် ရုပ်ပျက်ပြီး draw call လည်း တက်တယ်
  accessories: string[];
  /// 📸 Ready Player Me avatar GLB (selfie ကနေ ထုတ်ထားတဲ့ ဓာတ်ပုံ-realistic
  /// rigged body) — ရှိရင် room ထဲမှာ kit rig အစား ဒါကို သုံးတယ်။
  rpmUrl?: string | null;
  /// 🧍 ရွေးထားတဲ့ realistic body variant (a-r) — device ကူးရင် လိုက်ဖို့
  variant?: string | null;
};

/// RPM GLB URL အစစ်သာ — မဟုတ်ရင် တခြား host က model/script တင်လို့ရသွားမယ်
export const RPM_URL_RE =
  /^https:\/\/models\.readyplayer\.me\/[A-Za-z0-9]+\.glb(\?[\w=&.-]*)?$/;

export const MAX_ACCESSORIES = 3;

/// ★ ဒီစာရင်းက **တစ်ခုတည်းသော အမှန်တရား** — client က ဒါကနေ UI ဆောက်ပြီး
/// server က ဒါနဲ့ စစ်တယ်။ မသိတဲ့ id ဆိုရင် ငြင်းတယ် (မဟုတ်ရင် ဘယ်လို
/// string မဆို ပို့ပြီး ရုပ်ပျက်စေလို့ရမယ်)။
export const PART_IDS = {
  hair: ["none", "short", "long", "bun", "braid"],
  eyes: ["normal", "happy", "sharp", "sleepy"],
  brows: ["normal", "thick", "thin"],
  mouth: ["normal", "smile", "flat"],
  top: ["tee", "shirt", "hoodie", "tank", "longyi_top"],
  bottom: ["jeans", "shorts", "skirt", "longyi"],
  shoes: ["sneaker", "boot", "sandal", "barefoot"],
} as const;

/// ★ အခမဲ့မဟုတ်တဲ့ ပစ္စည်းများ — `mv_inventory` မှာ ရှိမှ သုံးလို့ရတယ်။
/// Client မှာ 🔒 နဲ့ ပြထားပေမယ့် **စစ်ဆေးမှုက server မှာ** (spec 15.4)။
export const ACCESSORIES: { id: string; label: string; free: boolean }[] = [
  { id: "hat_straw", label: "ခေါင်းဆောင်းထုပ်", free: true },
  { id: "glasses_round", label: "မျက်မှန်ဝိုင်း", free: true },
  { id: "scarf", label: "လည်စည်း", free: true },
  { id: "hat_crown", label: "သရဖူ", free: false },
  { id: "wings", label: "အတောင်ပံ", free: false },
  { id: "halo", label: "ရောင်ခြည်ကွင်း", free: false },
];

export const FREE_ACCESSORIES = new Set(
  ACCESSORIES.filter((a) => a.free).map((a) => a.id),
);

export const SKIN_TONES = [0xf1c7a4, 0xe8b088, 0xc98d63, 0x9c6644, 0x6f4a30];
export const HAIR_COLORS = [0x1b1b1b, 0x3a2415, 0x6b4423, 0xa8763e, 0xd9d9d9, 0x7b4bd6];
export const CLOTH_PALETTE = [
  0xe94f37, 0x3f88c5, 0xf6ae2d, 0x44bba4, 0xa06cd5, 0xff8c42, 0x6cc551,
  0x2b3038, 0xf2f2f2, 0x8b5a2b,
];

export const DEFAULT_AVATAR: AvatarConfig = {
  v: 1,
  body: { skin: 0xe8b088, height: 1, build: "normal" },
  hair: { style: "short", color: 0x1b1b1b },
  face: { eyes: "normal", brows: "normal", mouth: "normal" },
  outfit: {
    top: "tee",
    topColor: 0x44bba4,
    bottom: "jeans",
    bottomColor: 0x2b3038,
    shoes: "sneaker",
    shoesColor: 0x2b3038,
  },
  accessories: [],
};

const clampColor = (n: unknown): number => {
  const v = Math.floor(Number(n));
  return Number.isFinite(v) && v >= 0 && v <= 0xffffff ? v : 0x888888;
};

const pick = <T extends readonly string[]>(list: T, v: unknown, fallback: T[number]) =>
  (list as readonly string[]).includes(String(v)) ? String(v) : fallback;

/// မသိတဲ့/မမှန်တဲ့ တန်ဖိုးတွေကို default နဲ့ အစားထိုးပြီး **အမြဲ တရားဝင်တဲ့
/// config** ပြန်ပေးတယ်။
///
/// ★ Server မှာလည်း ဒီ function ကိုပဲ သုံးတယ် — ငြင်းမယ့်အစား သန့်စင်တာက
///   ပိုကောင်းတယ်၊ ဘာလို့ဆို client အဟောင်းက field အသစ်တွေ မပါဘဲ ပို့မယ်။
///   ဒါပေမယ့် **accessory entitlement ကတော့ သန့်စင်လို့မရဘူး** — ပိုင်မပိုင်
///   စစ်ရမယ် (`sanitizeAvatar` က owned စာရင်း လိုတာ အဲဒါကြောင့်)။
export function sanitizeAvatar(raw: unknown, owned: Set<string>): AvatarConfig {
  const r = (raw ?? {}) as Record<string, unknown>;
  const body = (r.body ?? {}) as Record<string, unknown>;
  const hair = (r.hair ?? {}) as Record<string, unknown>;
  const face = (r.face ?? {}) as Record<string, unknown>;
  const outfit = (r.outfit ?? {}) as Record<string, unknown>;

  const height = Number(body.height);
  const accessories = Array.isArray(r.accessories) ? r.accessories.map(String) : [];

  return {
    v: 1,
    body: {
      skin: clampColor(body.skin ?? DEFAULT_AVATAR.body.skin),
      // ★ အရပ်ကို ကန့်သတ်တယ် — မကန့်သတ်ရင် height: 50 ပို့ပြီး
      // မြေပြင်တစ်ခုလုံး ဖုံးတဲ့ avatar လုပ်လို့ရမယ်
      height: Number.isFinite(height) ? Math.min(1.1, Math.max(0.9, height)) : 1,
      build: pick(["slim", "normal", "broad"] as const, body.build, "normal") as
        | "slim"
        | "normal"
        | "broad",
    },
    hair: {
      style: pick(PART_IDS.hair, hair.style, "short"),
      color: clampColor(hair.color ?? DEFAULT_AVATAR.hair.color),
    },
    face: {
      eyes: pick(PART_IDS.eyes, face.eyes, "normal"),
      brows: pick(PART_IDS.brows, face.brows, "normal"),
      mouth: pick(PART_IDS.mouth, face.mouth, "normal"),
    },
    outfit: {
      top: pick(PART_IDS.top, outfit.top, "tee"),
      topColor: clampColor(outfit.topColor ?? DEFAULT_AVATAR.outfit.topColor),
      bottom: pick(PART_IDS.bottom, outfit.bottom, "jeans"),
      bottomColor: clampColor(outfit.bottomColor ?? DEFAULT_AVATAR.outfit.bottomColor),
      shoes: pick(PART_IDS.shoes, outfit.shoes, "sneaker"),
      shoesColor: clampColor(outfit.shoesColor ?? DEFAULT_AVATAR.outfit.shoesColor),
    },
    // ★ ပိုင်တာကိုသာ ချန်တယ်၊ ငြင်းမယ့်အစား ဖယ်တယ် — မပိုင်တဲ့ ဦးထုပ်
    // တစ်ခုကြောင့် avatar တစ်ခုလုံး မသိမ်းရတာက အသုံးမဝင်ဘူး။
    accessories: accessories
      .filter((a) => FREE_ACCESSORIES.has(a) || owned.has(a))
      .slice(0, MAX_ACCESSORIES),
    rpmUrl:
      typeof r.rpmUrl === "string" &&
      r.rpmUrl.length <= 300 &&
      RPM_URL_RE.test(r.rpmUrl)
        ? r.rpmUrl
        : null,
    variant:
      typeof r.variant === "string" && /^[a-r]$/.test(r.variant)
        ? r.variant
        : null,
  };
}
