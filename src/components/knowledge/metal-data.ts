/**
 * Static text and reference data for the metal board. Lives apart from the
 * component so the board file stays about behaviour — this file is all words.
 *
 * Everything here is bilingual. The board has its own my/en toggle and every
 * visible string must flip with it, so each entry carries both languages
 * rather than going through next-intl: the board is a self-contained client
 * island that also renders inside the mobile app's webview, where the
 * page-level locale is fixed.
 */

export type Lang = "my" | "en";

const STRINGS = {
  my: {
    groupPrecious: "အဖိုးတန်သတ္တု (Precious)",
    groupBase: "စက်မှုသတ္တု (Base / LME)",
    loadError: "ဈေးနှုန်း ယူ၍မရသေးပါ — ခဏနေ ပြန်စမ်းပါ။",
    updated: "နောက်ဆုံး update",
    convTitle: "ယူနစ်ပြောင်း ဈေးနှုန်း",
    tapHint: "အတန်းကို နှိပ်၍ အသေးစိတ်ကြည့်ပါ",
    lmeHintPre: "LME (ရော်တာဒမ်) — နီကယ်၊ သွပ်၊ ခဲမဖြူ၊ ခဲ နှင့် ရိုဒီယမ် ဈေးများ ပြရန် metals.dev မှ အခမဲ့ API key တစ်ခု လိုပါသည်။",
    lmeHintPost: "ကို /etc/gwave-web.env တွင် ထည့်ပြီး redeploy လုပ်ပါ။",
    footer:
      "ရွှေ/ငွေ/ကြေးနီ — COMEX (နယူးယောက်) ကမ္ဘာ့စံဈေး၊ ၁၀ မိနစ်တစ်ကြိမ်။ LME ဈေးများသည် မြန်မာ့သတ္တုဈေးကွက်က ခေါ်နေကျ「ရော်တာဒမ်ဈေး」ဖြစ်ပြီး ရက်စဉ် official settlement ဖြစ်သည်။ ရှန်ဟိုင်း (SHFE) နှင့် ဝူဖရမ်/APT ဈေးများမှာ licence ဝယ်ယူရသော feed များဖြစ်၍ မမှန်သော ကိန်းဂဏန်း မပြလိုသဖြင့် ချန်ထားပါသည်။ ဤဈေးနှုန်းများသည် ရည်ညွှန်းချက်သာဖြစ်ပြီး အရောင်းအဝယ် စာချုပ်ဈေး မဟုတ်ပါ။",
    logTitle: "ဈေးမှတ်တမ်း (ခနောက်စိမ်း / ခဲမဖြူ / ရှားပါးမြေ / နယ်စပ်ဈေး)",
    logAdd: "+ ဈေးထည့်",
    logClose: "ပိတ်မည်",
    logSave: "မှတ်တမ်းတင်မည်",
    logSaving: "သိမ်းနေသည်…",
    logEmpty:
      "မှတ်တမ်း မရှိသေးပါ — ခနောက်စိမ်း၊ ခဲမဖြူ နယ်စပ်ဈေး၊ ကချင်ထွက် ရှားပါးမြေ (rare earth) ကဲ့သို့ feed မရှိသော သတ္တုဈေးများကို admin က ဤနေရာတွင် မှတ်တမ်းတင်ပါသည်။",
    logDisclaimer:
      "ဤအပိုင်းသည် လူကိုယ်တိုင် မှတ်တမ်းတင်ထားသော ဈေးများဖြစ်သည် — အပေါ်က exchange ဈေးများနှင့် ရင်းမြစ်မတူပါ။ ရက်စွဲကို ကြည့်ပါ။",
    worldPrice: "ကမ္ဘာ့ဈေး",
    phName: "သတ္တုအမည် (ဥပမာ — ခနောက်စိမ်း)",
    phGrade: "Grade (ဥပမာ — သတ္တုရိုင်း 45%)",
    phPrice: "ဈေးနှုန်း",
    phMarket: "ဈေးကွက် (ဥပမာ — မူဆယ်နယ်စပ်)",
    phNote: "မှတ်ချက် (ရွေးချယ်)",
    formErr: "အမည်၊ ဈေးနှုန်းနှင့် ဈေးကွက် ဖြည့်ပါ။",
    guideTitle: "မြန်မာ့သတ္တု သယံဇာတ လမ်းညွှန်",
    guideIntro:
      "မြန်မာပြည်ထွက် သတ္တုတစ်ခုချင်းစီ၏ ထွက်ရှိရာဒေသ၊ တရားဝင်မှု အခြေအနေနှင့် ကမ္ဘာ့ဈေး ချိတ်ဆက်မှု — နယ်စပ်ကုန်သည်နှင့် ဈေးလေ့လာသူများအတွက်။",
    regions: "ထွက်ရှိရာဒေသ",
    legality: "တရားဝင်မှု",
    latestLog: "နောက်ဆုံး မှတ်တမ်းဈေး",
    noFeed: "အများပြည်သူ ကမ္ဘာ့ဈေး feed မရှိ — ဈေးမှတ်တမ်းကိုသာ ကိုးကားပါ။",
    helpTitle: "အသုံးပြုနည်း / အကူအညီ",
  },
  en: {
    groupPrecious: "Precious metals",
    groupBase: "Base metals (LME)",
    loadError: "Could not load prices — try again shortly.",
    updated: "Last updated",
    convTitle: "Unit conversions",
    tapHint: "Tap a row for details",
    lmeHintPre: "LME (Rotterdam) — a free metals.dev API key is needed to show nickel, zinc, tin, lead and rhodium.",
    lmeHintPost: "Add it to /etc/gwave-web.env and redeploy.",
    footer:
      "Gold/silver/copper — COMEX (New York) world benchmark, refreshed every 10 minutes. LME prices are what Myanmar's mining trade calls the “Rotterdam price” — the daily official settlement. Shanghai (SHFE) and tungsten/APT are licensed feeds; rather than invent numbers, they are left out. All prices are reference only, not contract prices.",
    logTitle: "Market log (antimony / tin / rare earth / border prices)",
    logAdd: "+ Add quote",
    logClose: "Close",
    logSave: "Save quote",
    logSaving: "Saving…",
    logEmpty:
      "No quotes yet — metals with no public feed (antimony, tin border prices, Kachin rare earths) are recorded here by an admin.",
    logDisclaimer:
      "These are hand-recorded quotes — a different source from the exchange prices above. Always check the date.",
    worldPrice: "World price",
    phName: "Metal name (e.g. antimony)",
    phGrade: "Grade (e.g. ore 45%)",
    phPrice: "Price",
    phMarket: "Market (e.g. Muse border)",
    phNote: "Note (optional)",
    formErr: "Fill in name, price and market.",
    guideTitle: "Myanmar minerals guide",
    guideIntro:
      "For each mineral Myanmar produces: where it is mined, its legal status, and how it links to the world price — for border traders and price watchers.",
    regions: "Mining regions",
    legality: "Legal status",
    latestLog: "Latest recorded quote",
    noFeed: "No public world price feed — refer to the market log only.",
    helpTitle: "User guide / Help",
  },
};

/** Both languages must define exactly the same keys — the board indexes by
 *  a shared key set, so a missing translation is a compile error here. */
export const STR: Record<Lang, Record<keyof typeof STRINGS.my, string>> =
  STRINGS;

/** Short per-metal background shown in the expanded detail row. */
export const METAL_INFO: Record<string, { my: string; en: string }> = {
  gold: {
    my: "ကမ္ဘာ့စံ COMEX ရွှေဈေး။ မြန်မာ့ရွှေဆိုင်ဈေးက ကျပ်သားယူနစ်ဖြင့် ဆက်စပ်တွက်ချက်နိုင်သည် — ယူနစ်ခလုတ်မှ「ကျပ်သား」ကို ရွေးပါ။",
    en: "COMEX world benchmark. Myanmar gold shops quote in kyattha — pick the kyattha unit above to compare.",
  },
  silver: {
    my: "စက်မှုနှင့် လက်ဝတ်ရတနာ နှစ်မျိုးလုံးတွင် သုံးသော အဖိုးတန်သတ္တု။ COMEX စံဈေး။",
    en: "Precious metal with both industrial and jewellery demand. COMEX benchmark.",
  },
  platinum: {
    my: "ကား catalytic converter နှင့် ဓာတုစက်မှုလုပ်ငန်းသုံး။ NYMEX စံဈေး။",
    en: "Used in catalytic converters and chemical industry. NYMEX benchmark.",
  },
  palladium: {
    my: "ဓာတ်ဆီကား catalytic converter အဓိကသုံး။ NYMEX စံဈေး။",
    en: "Primary use in petrol-car catalytic converters. NYMEX benchmark.",
  },
  copper: {
    my: "လျှပ်စစ်ဝါယာနှင့် ဆောက်လုပ်ရေး အဓိက။ မြန်မာတွင် မုံရွာ (လက်ပံတောင်း/S&K) မှ ထွက်သည်။",
    en: "Core metal for wiring and construction. Myanmar produces at Monywa (Letpadaung/S&K).",
  },
  aluminum: {
    my: "ပေါ့ပါးသော စက်မှုသတ္တု — ဆောက်လုပ်ရေး၊ ထုပ်ပိုးမှုသုံး။ CME စံဈေး။",
    en: "Light industrial metal for construction and packaging. CME benchmark.",
  },
  lme_nickel: {
    my: "Stainless steel နှင့် ဘက်ထရီသုံး။ LME ရက်စဉ် settlement — ရော်တာဒမ်ဈေး။",
    en: "Stainless steel and batteries. LME daily settlement — the Rotterdam price.",
  },
  lme_zinc: {
    my: "သံမဏိ galvanizing အဓိကသုံး။ မြန်မာတွင် ဘော်တွင်း-နမ္မတူ ဒေသက သမိုင်းဝင် ထွက်ရှိရာ။",
    en: "Mainly for galvanizing steel. Historically mined at Bawdwin–Namtu in Myanmar.",
  },
  lme_tin: {
    my: "ခဲမဖြူ — ဆားကစ်ပြားဂဟေ (solder) အဓိက။ မြန်မာသည် ကမ္ဘာ့ထိပ်တန်း ထုတ်လုပ်သူ — ရှမ်း (မန်မော်/ဝ) နှင့် တနင်္သာရီ။ LME ရော်တာဒမ်ဈေးက ကမ္ဘာ့ကိုးကားဈေး။",
    en: "Tin — mainly for electronics solder. Myanmar is a top world producer (Shan Man Maw/Wa, Tanintharyi). LME Rotterdam is the world reference.",
  },
  lme_lead: {
    my: "ကားဘက်ထရီအဓိကသုံး။ LME ရက်စဉ် settlement။",
    en: "Mainly for vehicle batteries. LME daily settlement.",
  },
  rhodium: {
    my: "ရှားပါးဆုံး platinum-group သတ္တု — ကား emission control သုံး။ Spot ဈေး။",
    en: "Rarest platinum-group metal, used in emission control. Spot price.",
  },
  antimony: {
    my: "ခနောက်စိမ်း — မီးခံပစ္စည်းနှင့် သတ္တုစပ်သုံး။ Exchange ရောင်းဝယ်မှုမရှိ၍ ကမ္ဘာ့စံဈေးမှာ licence feed သာ ရှိသည် — မှတ်တမ်းဈေးကို ကြည့်ပါ။",
    en: "Antimony — flame retardants and alloys. No exchange trades it; world benchmarks are licensed feeds, so see the market log.",
  },
  cobalt: {
    my: "ဘက်ထရီသုံး သတ္တု။ Spot ဈေး။",
    en: "Battery metal. Spot price.",
  },
};

/**
 * The Myanmar minerals guide. `liveKey` links a mineral to a live board row
 * when a public world feed exists; `logMatch` is the Burmese trade name to
 * find hand-recorded quotes by. Where neither exists the guide says so
 * honestly instead of inventing a number.
 *
 * Uranium is listed for education only: private mining, possession or trade
 * of radioactive minerals is illegal in Myanmar and internationally
 * controlled, so the entry carries a warning and deliberately no price.
 */
export interface MyanmarMineral {
  key: string;
  nameMy: string;
  nameEn: string;
  regions: { my: string; en: string };
  legal: { my: string; en: string };
  liveKey?: string;
  logMatch?: string;
  danger?: boolean;
}

export const MYANMAR_MINERALS: MyanmarMineral[] = [
  {
    key: "tin",
    nameMy: "ခဲမဖြူ (Tin)",
    nameEn: "Tin",
    regions: {
      my: "ရှမ်းအရှေ့ (မန်မော်/ဝ ဒေသ)၊ တနင်္သာရီ၊ မော်ချီး (ခဲမဖြူ-ဝူဖရမ်ရော)",
      en: "Eastern Shan (Man Maw/Wa), Tanintharyi, Mawchi (mixed tin–tungsten)",
    },
    legal: {
      my: "သတ္တုတွင်းဥပဒေအရ ထုတ်လုပ်ခွင့်/တင်ပို့ခွင့် လိုင်စင် လိုအပ်သည်။ တရားဝင်လမ်းကြောင်းဖြင့်သာ ရောင်းဝယ်ပါ။",
      en: "Production and export require licences under the Mines Law. Trade through legal channels only.",
    },
    liveKey: "lme_tin",
    logMatch: "ခဲမဖြူ",
  },
  {
    key: "antimony",
    nameMy: "ခနောက်စိမ်း (Antimony)",
    nameEn: "Antimony",
    regions: {
      my: "ရှမ်း၊ ကရင်၊ မန္တလေးတိုင်း တောင်ပိုင်းဒေသများ",
      en: "Shan, Kayin, southern Mandalay Region",
    },
    legal: {
      my: "ထုတ်လုပ်ခွင့်/တင်ပို့ခွင့် လိုင်စင် လိုအပ်သည်။ ကမ္ဘာ့စံဈေး (Fastmarkets/SMM) မှာ licence feed ဖြစ်၍ ဤစာမျက်နှာတွင် မှတ်တမ်းဈေးကိုသာ ပြသည်။",
      en: "Licences required for production and export. World benchmarks (Fastmarkets/SMM) are licensed feeds, so only the market log is shown here.",
    },
    logMatch: "ခနောက်စိမ်း",
  },
  {
    key: "rare_earth",
    nameMy: "ရှားပါးမြေ (Rare earth — Dy/Tb)",
    nameEn: "Rare earths (Dy/Tb)",
    regions: {
      my: "ကချင်မြောက်ပိုင်း — ပန်ဝါ/ချီဖွေ (ionic clay မှ Dysprosium/Terbium)၊ တရုတ်နယ်စပ်သို့ တင်ပို့",
      en: "Northern Kachin — Pangwa/Chipwi (dysprosium/terbium from ionic clay), exported across the China border",
    },
    legal: {
      my: "တူးဖော်မှုအများစုမှာ တရားဝင်ခွင့်ပြုချက်စနစ် ပြင်ပတွင် ဖြစ်နေပြီး ဒေသအခြေအနေ မတည်ငြိမ်ပါ — မလုပ်ဆောင်မီ လိုင်စင်နှင့် ဒေသဆိုင်ရာ အခြေအနေကို သေချာစစ်ဆေးပါ။ ကမ္ဘာ့ဈေး (China SMM) မှာ licence feed ဖြစ်သည်။",
      en: "Most extraction operates outside a formal licensing system and local conditions are unstable — verify licences and local conditions before any dealing. World prices (China SMM) are a licensed feed.",
    },
    logMatch: "ရှားပါးမြေ",
  },
  {
    key: "tungsten",
    nameMy: "ဝူဖရမ် (Tungsten)",
    nameEn: "Tungsten",
    regions: {
      my: "မော်ချီး (ကယား) — သမိုင်းဝင် ကမ္ဘာ့အဆင့် သတ္တုတွင်း",
      en: "Mawchi (Kayah) — a historically world-class mine",
    },
    legal: {
      my: "လိုင်စင် လိုအပ်သည်။ ကမ္ဘာ့ APT ဈေးမှာ licence feed ဖြစ်၍ မှတ်တမ်းဈေးကိုသာ ကိုးကားပါ။",
      en: "Licences required. The world APT price is a licensed feed, so refer to the market log.",
    },
    logMatch: "ဝူဖရမ်",
  },
  {
    key: "copper_mm",
    nameMy: "ကြေးနီ (Copper)",
    nameEn: "Copper",
    regions: {
      my: "မုံရွာ — လက်ပံတောင်း၊ စံပယ်တောင်/ကြေးစင်တောင်",
      en: "Monywa — Letpadaung, Sabetaung/Kyisintaung",
    },
    legal: {
      my: "နိုင်ငံတော်နှင့် ဖက်စပ်လုပ်ကွက်များ — ပုဂ္ဂလိက ရောင်းဝယ်မှုမှာ ကန့်သတ်ချက်များ ရှိသည်။",
      en: "State joint-venture concessions — private trade is restricted.",
    },
    liveKey: "copper",
    logMatch: "ကြေးနီ",
  },
  {
    key: "gold_mm",
    nameMy: "ရွှေ (Gold)",
    nameEn: "Gold",
    regions: {
      my: "စစ်ကိုင်း၊ ကချင်၊ မန္တလေးတိုင်း စသည့် ဒေသအနှံ့",
      en: "Sagaing, Kachin, Mandalay Region and elsewhere",
    },
    legal: {
      my: "ရွှေထုတ်လုပ်မှု/ရောင်းဝယ်မှုကို လိုင်စင်စနစ်ဖြင့် ထိန်းချုပ်သည်။ ပြည်တွင်းဈေးကို ကျပ်သားယူနစ်ဖြင့် ကိုးကားသည်။",
      en: "Production and trade are licence-controlled. The domestic market quotes in kyattha.",
    },
    liveKey: "gold",
    logMatch: "ရွှေ",
  },
  {
    key: "zinc_lead",
    nameMy: "သွပ် / ခဲ (Zinc / Lead)",
    nameEn: "Zinc / Lead",
    regions: {
      my: "ဘော်တွင်း-နမ္မတူ (ရှမ်းမြောက်) — သမိုင်းဝင် polymetallic တွင်း",
      en: "Bawdwin–Namtu (northern Shan) — historic polymetallic mine",
    },
    legal: {
      my: "လိုင်စင် လိုအပ်သည်။ ကမ္ဘာ့ဈေးမှာ LME ရော်တာဒမ်ဈေး ဖြစ်သည်။",
      en: "Licences required. The world price is the LME Rotterdam settlement.",
    },
    liveKey: "lme_zinc",
    logMatch: "သွပ်",
  },
  {
    key: "uranium",
    nameMy: "ယူရေနီယမ် (Uranium)",
    nameEn: "Uranium",
    regions: {
      my: "ဓာတ်သတ္တုရှာဖွေမှု မှတ်တမ်းများ ရှိသော်လည်း တရားဝင် ထုတ်လုပ်မှု မရှိပါ",
      en: "Exploration has been recorded, but there is no legal production",
    },
    legal: {
      my: "⚠️ ယူရေနီယမ်နှင့် ရေဒီယိုသတ္တိကြွ သတ္တုများကို ပုဂ္ဂလိက တူးဖော်ခြင်း၊ လက်ဝယ်ထားခြင်း၊ ရောင်းဝယ်ခြင်း လုံးဝ တရားမဝင်ပါ — အဏုမြူစွမ်းအင်ဥပဒေနှင့် နိုင်ငံတကာ (IAEA) ထိန်းချုပ်မှုအောက်တွင် ရှိသည်။ ကျန်းမာရေးအန္တရာယ်လည်း ကြီးမားသည်။ ဤစာမျက်နှာတွင် ဈေးနှုန်း တမင်မဖော်ပြပါ။",
      en: "⚠️ Private mining, possession or trade of uranium and radioactive minerals is strictly illegal — controlled under the Atomic Energy Law and internationally (IAEA), and a serious health hazard. No price is shown here, deliberately.",
    },
    danger: true,
  },
];

/** Help / user-guide accordion content. */
export const HELP: { q: { my: string; en: string }; a: { my: string; en: string } }[] = [
  {
    q: { my: "ဒီဈေးနှုန်းတွေ ဘယ်ကလာသလဲ?", en: "Where do these prices come from?" },
    a: {
      my: "ရွှေ/ငွေ/ပလက်တီနမ်/ပလေဒီယမ်/ကြေးနီ/အလူမီနီယမ် — COMEX/NYMEX/CME (နယူးယောက်/ချီကာဂို) စျေးကွက်မှ ၁၀ မိနစ်တစ်ကြိမ်။ နီကယ်/သွပ်/ခဲမဖြူ/ခဲ — LME (ရော်တာဒမ်ဈေး) ရက်စဉ် settlement။ ဈေးမှတ်တမ်းအပိုင်းကတော့ admin က လူကိုယ်တိုင် မှတ်တမ်းတင်ထားတာ ဖြစ်သည်။",
      en: "Gold/silver/platinum/palladium/copper/aluminium — COMEX/NYMEX/CME every 10 minutes. Nickel/zinc/tin/lead — LME (the Rotterdam price) daily settlement. The market log section is hand-recorded by an admin.",
    },
  },
  {
    q: { my: "ယူနစ်နဲ့ ငွေကြေး ဘယ်လိုပြောင်းမလဲ?", en: "How do units and currency work?" },
    a: {
      my: "အပေါ်ဆုံး ခလုတ်တန်းမှ ကျပ်သား/ဂရမ်/ကီလို ရွေးနိုင်ပြီး ငွေကြေး dropdown ဖြင့် USD/MMK/THB စသည် ပြောင်းနိုင်သည်။ ဥပမာ — ရွှေကို「ကျပ်သား」+ MMK ရွေးလျှင် ပြည်တွင်းရွှေဆိုင်ဈေးနှင့် တိုက်ရိုက် နှိုင်းယှဉ်နိုင်သည် (၁ ကျပ်သား = ၁၆.၆ ဂရမ်)။",
      en: "Pick kyattha/gram/kg from the top chips and switch currency (USD/MMK/THB…) with the dropdown. E.g. gold in kyattha + MMK compares directly with domestic gold-shop quotes (1 kyattha = 16.6 g).",
    },
  },
  {
    q: { my: "ဈေးမှတ်တမ်း ဘယ်လိုသုံးမလဲ?", en: "How do I use the market log?" },
    a: {
      my: "Feed မရှိတဲ့ သတ္တုတွေ (ခနောက်စိမ်း၊ ရှားပါးမြေ၊ နယ်စပ်ဈေး) ကို admin က ရက်စွဲ၊ ဈေးကွက်၊ grade နှင့်တကွ မှတ်တမ်းတင်သည်။ မှတ်တမ်းတစ်ခုချင်းအောက်မှာ ကိုက်ညီတဲ့ ကမ္ဘာ့ဈေး (LME/COMEX) ကို ယှဉ်ပြထားလို့ နယ်စပ်ဈေးက ကမ္ဘာ့ဈေးနဲ့ ဘယ်လောက်ကွာလဲ ချက်ချင်းမြင်နိုင်သည်။ ရက်စွဲဟောင်းနေရင် ဈေးဟောင်းဖြစ်နိုင်တာ သတိပြုပါ။",
      en: "Metals with no feed (antimony, rare earths, border prices) are recorded by an admin with date, market and grade. The matching world price (LME/COMEX) is shown under each quote so the gap to the world market is visible at a glance. Mind the date — an old entry is an old price.",
    },
  },
  {
    q: { my: "ဥပဒေရေးရာ သတိပေးချက်", en: "Legal notice" },
    a: {
      my: "မြန်မာနိုင်ငံတွင် သတ္တုထုတ်လုပ်/တင်ပို့မှုအတွက် လိုင်စင် လိုအပ်သည်။ ယူရေနီယမ်ကဲ့သို့ ရေဒီယိုသတ္တိကြွသတ္တုများ ရောင်းဝယ်ခြင်းမှာ လုံးဝတရားမဝင်ပါ။ ဤစာမျက်နှာပါ ဈေးနှုန်းအားလုံးသည် သတင်းအချက်အလက်/ရည်ညွှန်းချက်သာဖြစ်ပြီး ရောင်းဝယ်ရန် ကမ်းလှမ်းချက် မဟုတ်ပါ။",
      en: "Mineral production and export in Myanmar require licences. Trading radioactive minerals such as uranium is strictly illegal. All prices on this page are informational references only, not offers to trade.",
    },
  },
];
