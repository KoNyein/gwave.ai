import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/i18n.dart';
import '../../core/models.dart';

/// Burmese translations for the knowledge screens (Strains + Minerals).
///
/// The reference tables are seeded in English; when the app language is
/// Burmese every label, chip and category shown to the user translates through
/// the term dictionary below, and the freeform English descriptions get a
/// generated Burmese summary composed from the structured fields (type, THC,
/// effects, uses…) so the page reads fully in Burmese. Unknown terms fall back
/// to the original English text.
bool isMy(BuildContext context) {
  try {
    return context.watch<GwLang>().isMyanmar;
  } catch (_) {
    return context.read<GwLang>().isMyanmar;
  }
}

const Map<String, String> _terms = {
  // ── Strain types ──────────────────────────────────────────────────────────
  "indica": "အင်ဒီကာ",
  "sativa": "ဆာတီဗာ",
  "hybrid": "ပေါင်းစပ်မျိုး",
  // ── Effects ───────────────────────────────────────────────────────────────
  "relaxed": "စိတ်ငြိမ်စေ",
  "happy": "ပျော်ရွှင်စေ",
  "euphoric": "ကြည်နူးစေ",
  "uplifted": "စိတ်ဓာတ်တက်ကြွစေ",
  "sleepy": "အိပ်ချင်စေ",
  "hungry": "ဗိုက်ဆာစေ",
  "talkative": "စကားပြောချင်စေ",
  "creative": "ဖန်တီးစိတ်ရှင်စေ",
  "energetic": "အားအင်ပြည့်စေ",
  "focused": "အာရုံစူးစိုက်စေ",
  "giggly": "ရယ်ချင်စေ",
  "tingly": "ယားစိမ့်စိမ့်ခံစားရစေ",
  "aroused": "စိတ်လှုပ်ရှားစေ",
  "calm": "အေးချမ်းစေ",
  "sedated": "ငြိမ်သက်စေ",
  // ── Flavors ───────────────────────────────────────────────────────────────
  "earthy": "မြေနံ့",
  "sweet": "ချိုသောအရသာ",
  "citrus": "ရှောက်ချဉ်နံ့",
  "pungent": "စူးရှသောနံ့",
  "berry": "ဘယ်ရီသီးနံ့",
  "pine": "ထင်းရှူးနံ့",
  "flowery": "ပန်းနံ့",
  "spicy": "စပ်ရှသောနံ့",
  "herbal": "ဆေးဖက်ပင်နံ့",
  "pepper": "ငရုတ်ကောင်းနံ့",
  "mango": "သရက်သီးနံ့",
  "lemon": "ရှောက်သီးနံ့",
  "lime": "သံပုရာနံ့",
  "orange": "လိမ္မော်သီးနံ့",
  "grape": "စပျစ်သီးနံ့",
  "tropical": "အပူပိုင်းသစ်သီးနံ့",
  "vanilla": "ဗနီလာနံ့",
  "mint": "ပူဒီနာနံ့",
  "menthol": "မန်သောနံ့",
  "cheese": "ဒိန်ခဲနံ့",
  "coffee": "ကော်ဖီနံ့",
  "chocolate": "ချောကလက်နံ့",
  "woody": "သစ်သားနံ့",
  "diesel": "ဒီဇယ်နံ့",
  "skunk": "စကန့်နံ့ပြင်း",
  "blueberry": "ဘလူးဘယ်ရီနံ့",
  "strawberry": "စတော်ဘယ်ရီနံ့",
  "pineapple": "နာနတ်သီးနံ့",
  "apple": "ပန်းသီးနံ့",
  "apricot": "တရုတ်မက်မွန်နံ့",
  "peach": "မက်မွန်နံ့",
  "pear": "သစ်တော်သီးနံ့",
  "plum": "ဇီးသီးနံ့",
  "rose": "နှင်းဆီနံ့",
  "lavender": "လာဗင်ဒါနံ့",
  "sage": "ဆေ့ချ်ပင်နံ့",
  "tea": "လက်ဖက်နံ့",
  "honey": "ပျားရည်နံ့",
  "nutty": "အခွံမာသီးနံ့",
  "butter": "ထောပတ်နံ့",
  "chemical": "ဓာတုနံ့",
  "ammonia": "အမိုးနီးယားနံ့",
  "tar": "ကတ္တရာနံ့",
  "tobacco": "ဆေးရွက်ကြီးနံ့",
  "violet": "ပန်းခရမ်းနံ့",
  "grapefruit": "ကျွဲကောသီးနံ့",
  // ── Grow difficulty ───────────────────────────────────────────────────────
  "easy": "လွယ်ကူ",
  "moderate": "အလယ်အလတ်",
  "difficult": "ခက်ခဲ",
  "hard": "ခက်ခဲ",
  // ── Mineral categories ───────────────────────────────────────────────────
  "metal": "သတ္တု",
  "mineraloid": "သတ္တုဆန်ပစ္စည်း",
  "organic": "အော်ဂဲနစ်",
  "silicate": "ဆီလီကိတ်",
  "sulfate": "ဆာလဖိတ်",
  "sulfide": "ဆာလဖိုက်",
  "carbonate": "ကာဗွန်နိတ်",
  "halide": "ဟာလိုက်",
  "oxide": "အောက်ဆိုက်",
  "phosphate": "ဖော့စဖိတ်",
  "native element": "သဘာဝဒြပ်စင်",
  "element": "ဒြပ်စင်",
  "gemstone": "ကျောက်မျက်",
  "mineral": "ဓာတ်သတ္တု",
  // ── Mineral uses ──────────────────────────────────────────────────────────
  "aerospace": "လေကြောင်း/အာကာသ လုပ်ငန်း",
  "packaging": "ထုပ်ပိုးလုပ်ငန်း",
  "construction": "ဆောက်လုပ်ရေး",
  "electronics": "အီလက်ထရွန်နစ်",
  "jewelry": "လက်ဝတ်ရတနာ",
  "jewellery": "လက်ဝတ်ရတနာ",
  "batteries": "ဘက်ထရီ",
  "battery": "ဘက်ထရီ",
  "coins": "ဒင်္ဂါးပြား",
  "coinage": "ဒင်္ဂါးသွန်းလုပ်ခြင်း",
  "tools": "ကိရိယာများ",
  "fertilizer": "ဓာတ်မြေဩဇာ",
  "fertilizers": "ဓာတ်မြေဩဇာ",
  "glass": "ဖန်ထည်",
  "glassmaking": "ဖန်ထည်လုပ်ငန်း",
  "ceramics": "ကြွေထည်",
  "pigment": "ဆေးရောင်ခြယ်ပစ္စည်း",
  "pigments": "ဆေးရောင်ခြယ်ပစ္စည်း",
  "abrasive": "ပွတ်တိုက်ပစ္စည်း",
  "abrasives": "ပွတ်တိုက်ပစ္စည်း",
  "insulation": "လျှပ်/အပူကာပစ္စည်း",
  "medicine": "ဆေးဝါး",
  "catalyst": "ဓာတ်ကူပစ္စည်း",
  "wiring": "လျှပ်စစ်ဝါယာ",
  "electrical wiring": "လျှပ်စစ်ဝါယာ",
  "plumbing": "ရေပိုက်လုပ်ငန်း",
  "steelmaking": "သံမဏိလုပ်ငန်း",
  "steel": "သံမဏိ",
  "alloys": "သတ္တုစပ်",
  "alloy": "သတ္တုစပ်",
  "cement": "ဘိလပ်မြေ",
  "paint": "ဆေးသုတ်လုပ်ငန်း",
  "paints": "ဆေးသုတ်လုပ်ငန်း",
  "cosmetics": "အလှကုန်",
  "optics": "မှန်ဘီလူး/အလင်းပစ္စည်း",
  "investment": "ရင်းနှီးမြှုပ်နှံမှု",
  "cutting tools": "ဖြတ်တောက်ကိရိယာ",
  "drilling": "တူးဖော်ခြင်း",
  "nuclear": "နျူကလီးယား",
  "solder": "ဂဟေဆက်ပစ္စည်း",
  "galvanizing": "သွပ်ရည်စိမ်ခြင်း",
  "aircraft": "လေယာဉ်လုပ်ငန်း",
  "automotive": "မော်တော်ယာဉ်လုပ်ငန်း",
  "chemicals": "ဓာတုပစ္စည်း",
  "flame retardant": "မီးခံပစ္စည်း",
  "ornamental": "အလှဆင်ပစ္စည်း",
  "carving": "ပန်းပုထုခြင်း",
  "collectible": "စုဆောင်းပစ္စည်း",
  "collectibles": "စုဆောင်းပစ္စည်း",
};

/// Terpene explainers — terpene names stay in English (they're proper nouns)
/// but each gets a one-line Burmese description on the detail page.
const Map<String, String> terpeneInfoMy = {
  "myrcene": "သစ်သီးနံ့ — ကိုယ်စိတ်ပြေလျော့ အနားယူစေတတ်သည်",
  "limonene": "ရှောက်ချဉ်နံ့ — စိတ်ဓာတ်တက်ကြွ လန်းဆန်းစေတတ်သည်",
  "caryophyllene": "ငရုတ်ကောင်းနံ့ — စိတ်ဖိစီးမှု လျော့ချပေးတတ်သည်",
  "pinene": "ထင်းရှူးနံ့ — အာရုံကြည်လင် သတိရှင်စေတတ်သည်",
  "linalool": "လာဗင်ဒါနံ့ — စိတ်ငြိမ် အိပ်ပျော်စေတတ်သည်",
  "terpinolene": "ပန်း/သစ်သီးနံ့ရော — လန်းဆန်းတက်ကြွစေတတ်သည်",
  "humulene": "ဆေးဖက်ပင်နံ့ — ဗိုက်ဆာစိတ် လျော့စေတတ်သည်",
  "ocimene": "ချိုမြသောပန်းနံ့ — လန်းဆန်းစေတတ်သည်",
};

/// Translate a knowledge term (effect / flavor / category / use / difficulty)
/// when Burmese is selected; otherwise return it unchanged.
String kTerm(BuildContext context, String term) {
  if (!isMy(context)) return term;
  return _terms[term.trim().toLowerCase()] ?? term;
}

/// Strain type meaning line (both languages).
String strainTypeInfo(BuildContext context, String type) {
  final my = isMy(context);
  switch (type.toLowerCase()) {
    case "indica":
      return my
          ? "အင်ဒီကာ — ကိုယ်စိတ်ပြေလျော့ အနားယူချင်စေတတ်ပြီး ညပိုင်းသုံး သင့်တော်သည်"
          : "Indica — typically relaxing and body-heavy; suits evenings";
    case "sativa":
      return my
          ? "ဆာတီဗာ — စိတ်တက်ကြွ ဖန်တီးစိတ်ရှင်စေတတ်ပြီး နေ့ပိုင်းသုံး သင့်တော်သည်"
          : "Sativa — typically energizing and cerebral; suits daytime";
    default:
      return my
          ? "ပေါင်းစပ်မျိုး — အင်ဒီကာနှင့် ဆာတီဗာ အာနိသင် နှစ်မျိုးရော ရရှိသည်"
          : "Hybrid — a balance of indica and sativa effects";
  }
}

/// THC strength class: mild / moderate / strong.
String potencyClass(BuildContext context, double thc) {
  final my = isMy(context);
  if (thc >= 20) return my ? "ပြင်းအား မြင့်" : "High potency";
  if (thc >= 12) return my ? "ပြင်းအား အလယ်အလတ်" : "Moderate potency";
  return my ? "ပြင်းအား နိမ့်" : "Mild potency";
}

/// A generated Burmese summary for a strain, composed from structured fields
/// (shown when Burmese is selected — the seeded description is English-only).
String strainSummaryMy(Strain s) {
  final b = StringBuffer();
  final type = _terms[s.type.toLowerCase()] ?? s.type;
  b.write("${s.name} သည် $type မျိုးကွဲ ဖြစ်သည်။");
  if (s.thc != null) {
    b.write(" THC ${s.thc}%");
    if (s.cbd != null) b.write("၊ CBD ${s.cbd}%");
    b.write(" ပါဝင်သည်။");
  }
  if (s.effects.isNotEmpty) {
    final fx = s.effects
        .take(4)
        .map((e) => _terms[e.toLowerCase()] ?? e)
        .join("၊ ");
    b.write(" အာနိသင်အနေဖြင့် $fx တတ်သည်။");
  }
  if (s.flavors.isNotEmpty) {
    final fl = s.flavors
        .take(3)
        .map((e) => _terms[e.toLowerCase()] ?? e)
        .join("၊ ");
    b.write(" အနံ့အရသာမှာ $fl တို့ ဖြစ်သည်။");
  }
  if (s.growDifficulty != null) {
    final g = _terms[s.growDifficulty!.toLowerCase()] ?? s.growDifficulty;
    b.write(" စိုက်ပျိုးရ $g သည်။");
  }
  if (s.floweringWeeks != null) {
    b.write(" ပန်းပွင့်ချိန် ${s.floweringWeeks} ပတ်ခန့် ကြာသည်။");
  }
  return b.toString();
}

/// A generated Burmese summary for a mineral.
String mineralSummaryMy(Mineral m) {
  final b = StringBuffer();
  final cat = _terms[m.category.toLowerCase()] ?? m.category;
  b.write("${m.name} ");
  if (m.symbol != null && m.symbol!.isNotEmpty) b.write("(${m.symbol}) ");
  b.write("သည် $cat အမျိုးအစား ဖြစ်သည်။");
  if (m.hardnessMohs != null) {
    b.write(" Mohs မာကျောမှု ${m.hardnessMohs} ရှိပြီး");
    if (m.density != null) {
      b.write(" သိပ်သည်းဆ ${m.density} g/cm³ ဖြစ်သည်။");
    } else {
      b.write("။");
    }
  } else if (m.density != null) {
    b.write(" သိပ်သည်းဆ ${m.density} g/cm³ ဖြစ်သည်။");
  }
  if (m.uses.isNotEmpty) {
    final u =
        m.uses.take(4).map((e) => _terms[e.toLowerCase()] ?? e).join("၊ ");
    b.write(" အဓိကအားဖြင့် $u တို့တွင် အသုံးပြုသည်။");
  }
  return b.toString();
}

/// Everyday reference points on the Mohs scale, so the hardness number means
/// something to a non-geologist.
String mohsContext(BuildContext context, double mohs) {
  final my = isMy(context);
  String ref;
  if (mohs < 2.5) {
    ref = my ? "လက်သည်း (2.5) ထက် ပျော့သည်" : "softer than a fingernail (2.5)";
  } else if (mohs < 3.5) {
    ref = my
        ? "လက်သည်း (2.5) နှင့် ကြေးဒင်္ဂါး (3.5) ကြား"
        : "between a fingernail (2.5) and a copper coin (3.5)";
  } else if (mohs < 5.5) {
    ref = my
        ? "ကြေးဒင်္ဂါး (3.5) နှင့် ဓားသွား (5.5) ကြား"
        : "between a copper coin (3.5) and a knife blade (5.5)";
  } else if (mohs < 7) {
    ref = my
        ? "ဓားသွား (5.5) ထက်မာပြီး ဖန် (6) ကို ခြစ်နိုင်သည်"
        : "harder than a knife blade (5.5); scratches glass (6)";
  } else if (mohs < 9) {
    ref = my
        ? "ကွာ့ဇ် (7) အဆင့် — သံမဏိကိရိယာထက် မာသည်"
        : "quartz-class (7) — harder than steel tools";
  } else {
    ref = my ? "စိန် (10) အနီး — အလွန်မာကျော" : "near diamond (10) — extremely hard";
  }
  return ref;
}
