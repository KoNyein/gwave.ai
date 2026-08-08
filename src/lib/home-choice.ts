/**
 * 🚪 ဝင်ရာ တံခါး — login ဝင်ပြီးရင် **ဘယ်ကို သွားမလဲ** ကိုယ်တိုင် ရွေးတယ်။
 *
 * user: "Login ဝင်ပြီဆိုရင် Metaverse ကိုသွားမလား social network
 * ကိုသွားမလား shop, pos, market place သွားမလား — ဝင်ဝင်ချင်း category တွေ
 * ရွေးဝင်လို့ရအောင် လုပ်ထားပေးပါ"
 *
 * အရင်က `/` က signed-in သူတိုင်းကို `/metaverse` ကို အတင်း ပို့တယ် —
 * ဈေးရောင်းဖို့ ဝင်တဲ့သူက လောကထဲ ဖြတ်ရတယ်။ အခု တံခါးဝမှာ ရွေးခွင့် ရတယ်၊
 * "မှတ်ထား" ဆိုရင် နောက်တစ်ခါက တိုက်ရိုက် ရောက်တယ်။
 *
 * ★ ရွေးချယ်မှုကို **cookie** မှာ သိမ်းတယ် (localStorage မဟုတ်) — `/` က
 *   server redirect ဖြစ်လို့ server ဘက်က ဖတ်နိုင်ရမယ်။ ဒါက UI နှစ်သက်မှု
 *   သက်သက်ပါ၊ လုံခြုံရေးနဲ့ မဆိုင်လို့ httpOnly မလိုဘူး။
 */

/// 🍪 ဝင်ရာနေရာ cookie。
///
/// ★ **website က ဒါကို မဖတ်တော့ဘူး** — ဖွင့်တိုင်း ကြိုဆိုစာမျက်နှာကို
///   ရောက်တယ် (user: "/start ကို main welcome page အဖြစ် ထားပေးပါ")。
///   အလိုအလျောက် ပို့လိုက်ရင် ကြိုဆိုစာမျက်နှာ ဆိုတာ မရှိတော့ဘူး။
/// ★ နာမည်ကို ဆက်ထားတယ် — Flutter app ရဲ့ "ဝင်ရာနေရာ" ရွေးချယ်မှုက
///   ဒီ key နဲ့ တစ်သားတည်း ဖြစ်နေတယ် (`gw.home.choice` prefs)。
export const HOME_COOKIE = "gw_home";

export interface HomeChoice {
  key: string;
  href: string;
  emoji: string;
  /** ခေါင်းစဉ် — မြန်မာ */
  title: string;
  /** တစ်ကြောင်း ရှင်းလင်းချက် */
  blurb: string;
}

export const HOME_CHOICES: HomeChoice[] = [
  {
    key: "metaverse",
    href: "/metaverse",
    emoji: "🌍",
    title: "Metaverse",
    blurb: "3D လောကထဲ ဝင် — အခန်း ၁၅ ခု, သူငယ်ချင်းများ, ပွဲကွင်း",
  },
  {
    key: "feed",
    href: "/feed",
    emoji: "📰",
    title: "Social",
    blurb: "သတင်းစာမျက်နှာ, သူငယ်ချင်း, အုပ်စု, Reels",
  },
  {
    key: "shop",
    href: "/shop",
    emoji: "🛍️",
    title: "Shop",
    blurb: "ပစ္စည်းများ ဝယ်ယူ — Gwave ဆိုင်",
  },
  {
    key: "market",
    href: "/market",
    emoji: "🏪",
    title: "Marketplace",
    blurb: "ရောင်းဝယ်ရေး — ကိုယ့်ပစ္စည်း တင်ရောင်း",
  },
  {
    key: "pos",
    href: "/pos",
    emoji: "🧾",
    title: "POS",
    blurb: "ဆိုင်ရှင်များအတွက် ရောင်းအား စနစ်",
  },
  {
    key: "live",
    href: "/live",
    emoji: "📺",
    title: "Live",
    blurb: "တိုက်ရိုက်လွှင့် / ကြည့်",
  },
  {
    key: "games",
    href: "/games",
    emoji: "🎮",
    title: "Games",
    blurb: "ဂိမ်းများ — arcade, ပြိုင်ပွဲ",
  },
  {
    key: "dashboard",
    href: "/dashboard",
    emoji: "📊",
    title: "Dashboard",
    blurb: "ကိုယ့်စာရင်း — ငွေ, စိုက်ခင်း, ကျန်းမာရေး",
  },
];

/** key က တရားဝင်လား — မဟုတ်ရင် null (open redirect ကာကွယ်)。
 *  ★ စာရင်းထဲက href ကိုပဲ ပြန်ပေးလို့ ပြင်ပ URL ဘယ်တော့မှ မထွက်နိုင်ဘူး။ */
export function homeHrefFor(key: string | undefined | null): string | null {
  if (!key) return null;
  return HOME_CHOICES.find((c) => c.key === key)?.href ?? null;
}
