/// Plant-light science for the Light Meter — pure Dart, no Flutter, no
/// plugins, so every number here can be reasoned about (and unit-tested)
/// without a device.
///
/// The one thing this file exists to protect: a phone's ambient-light sensor
/// measures **lux**, which is weighted for the human eye. Plants do not use
/// the human eye's response curve, so lux on its own tells a grower almost
/// nothing. Everything below converts to PPFD/DLI and states plainly where
/// the estimate stops being trustworthy.
library;

/// How a lux reading converts to PPFD. The factor depends entirely on the
/// lamp's spectrum, which is why the UI refuses to show PPFD until the user
/// picks one — a wrong lamp is a 2× error, not a rounding error.
enum LightSource {
  sunlight("Sunlight (outdoor)", "နေရောင် (အပြင်)", 0.0185, "Clear sky",
      "မိုးသားကင်းစင်သောနေ့"),
  sunlightCloudy("Sunlight (overcast)", "နေရောင် (တိမ်ထူ)", 0.0180,
      "Heavy cloud", "တိမ်အုံ့ဆိုင်းသောနေ့"),
  hps("HPS (orange lamp)", "HPS (ရွှေဝါရောင်မီး)", 0.0122, "Common for flower",
      "အပွင့်အတွက် သုံးလေ့ရှိ"),
  metalHalide("Metal halide", "Metal Halide", 0.0141, "", ""),
  fluorescent("Fluorescent / T5", "Fluorescent / T5", 0.0135, "For seedlings",
      "ပျိုးပင်အတွက်"),
  ledCool("LED (cool white)", "LED (ဖြူ - အေး)", 0.0135, "Ordinary house lamp",
      "ပုံမှန်အိမ်သုံးမီး"),
  ledWarm("LED (warm white)", "LED (ဖြူ - နွေး)", 0.0140, "", ""),
  ledGrow("LED (grow light)", "LED (စိုက်ပျိုးရေးအထူး)", 0.0160, "Full spectrum",
      "full-spectrum"),
  ledBlurple("LED (purple / pink)", "LED (ခရမ်း/ပန်း)", 0.0290,
      "Lux is unreliable here", "lux မတိကျ — ခန့်မှန်းသာ");

  const LightSource(
      this.labelEn, this.labelMy, this.luxToPpfd, this.noteEn, this.noteMy);

  final String labelEn;
  final String labelMy;

  /// Multiply lux by this to get µmol/m²/s.
  final double luxToPpfd;
  final String noteEn;
  final String noteMy;

  /// Purple ("blurple") LEDs emit almost no green, which is exactly the band
  /// a lux sensor weights most heavily. The sensor under-reads badly, so the
  /// factor is large — and so is the error. Say so rather than pretending.
  bool get lowConfidence => this == LightSource.ledBlurple;

  /// Roughly how much of this lamp's output the user should expect in each
  /// band. Deliberately coarse — it is a teaching aid, not a measurement.
  /// (blue, green, red) as percentages; far-red and UV are called out
  /// separately because the phone cannot see them at all.
  (int, int, int) get spectrumMix => switch (this) {
        LightSource.sunlight || LightSource.sunlightCloudy => (25, 35, 40),
        LightSource.hps => (5, 35, 60),
        LightSource.metalHalide => (25, 45, 30),
        LightSource.fluorescent => (20, 45, 35),
        LightSource.ledCool => (25, 45, 30),
        LightSource.ledWarm => (15, 45, 40),
        LightSource.ledGrow => (20, 30, 50),
        LightSource.ledBlurple => (25, 5, 70),
      };
}

double luxToPpfd(double lux, LightSource src) => lux * src.luxToPpfd;

/// DLI (mol/m²/day) from a steady PPFD held for [hoursPerDay].
///
/// Fine for lamps, which hold a constant output. Sunlight varies through the
/// day, so [dliFromSamples] is the honest version there.
double dli(double ppfd, double hoursPerDay) =>
    ppfd * 3600 * hoursPerDay / 1000000;

/// A single logged reading.
class LightSample {
  const LightSample({
    required this.timeMs,
    required this.lux,
    required this.ppfd,
    this.note = "",
    this.source,
    this.crop,
    this.stageIndex,
  });

  final int timeMs;
  final double lux;
  final double ppfd;
  final String note;
  final LightSource? source;
  final String? crop;
  final int? stageIndex;

  Map<String, dynamic> toJson() => {
        "t": timeMs,
        "lux": lux,
        "ppfd": ppfd,
        if (note.isNotEmpty) "n": note,
        if (source != null) "s": source!.name,
        if (crop != null) "c": crop,
        if (stageIndex != null) "st": stageIndex,
      };

  static LightSample fromJson(Map<String, dynamic> j) {
    LightSource? src;
    for (final e in LightSource.values) {
      if (e.name == j["s"]) src = e;
    }
    return LightSample(
      timeMs: (j["t"] as num?)?.toInt() ?? 0,
      lux: (j["lux"] as num?)?.toDouble() ?? 0,
      ppfd: (j["ppfd"] as num?)?.toDouble() ?? 0,
      note: (j["n"] as String?) ?? "",
      source: src,
      crop: j["c"] as String?,
      stageIndex: (j["st"] as num?)?.toInt(),
    );
  }
}

/// Integrate real samples into a DLI (mol/m²/day) with the trapezoid rule.
///
/// Only meaningful across a whole photoperiod: two samples a minute apart
/// describe that minute, not the day.
double dliFromSamples(List<LightSample> samples) {
  if (samples.length < 2) return 0;
  final sorted = [...samples]..sort((a, b) => a.timeMs.compareTo(b.timeMs));
  var total = 0.0;
  for (var i = 0; i + 1 < sorted.length; i++) {
    final a = sorted[i];
    final b = sorted[i + 1];
    final dtSec = (b.timeMs - a.timeMs) / 1000.0;
    if (dtSec <= 0) continue;
    total += (a.ppfd + b.ppfd) / 2 * dtSec;
  }
  return total / 1000000;
}

/// Target light for one crop at one growth stage.
class GrowthStageTarget {
  const GrowthStageTarget(this.stageEn, this.stageMy, this.ppfdMin,
      this.ppfdMax, this.dliMin, this.dliMax, this.photoperiod);

  final String stageEn;
  final String stageMy;
  final int ppfdMin;
  final int ppfdMax;
  final double dliMin;
  final double dliMax;

  /// Hours of light per day this stage expects.
  final int photoperiod;
}

class CropProfile {
  const CropProfile(this.id, this.nameEn, this.nameMy, this.stages);
  final String id;
  final String nameEn;
  final String nameMy;
  final List<GrowthStageTarget> stages;
}

const hempStages = [
  GrowthStageTarget("Seedling", "ပျိုးပင်", 100, 300, 6.0, 15.0, 18),
  GrowthStageTarget("Vegetative", "ရွက်ထွက်ကာလ", 300, 600, 20.0, 35.0, 18),
  GrowthStageTarget("Flowering", "အပွင့်ကာလ", 600, 1000, 30.0, 45.0, 12),
  GrowthStageTarget("Late flower", "အပွင့်နှောင်း", 500, 800, 25.0, 40.0, 12),
];

const leafyStages = [
  GrowthStageTarget("Seedling", "ပျိုးပင်", 100, 200, 6.0, 12.0, 16),
  GrowthStageTarget("Growth", "ကြီးထွားကာလ", 200, 400, 12.0, 17.0, 16),
];

const fruitingStages = [
  GrowthStageTarget("Seedling", "ပျိုးပင်", 100, 250, 6.0, 12.0, 16),
  GrowthStageTarget("Vegetative", "ပင်ကြီးကာလ", 300, 600, 15.0, 25.0, 16),
  GrowthStageTarget("Fruiting", "အသီးကာလ", 500, 800, 22.0, 30.0, 12),
];

const herbStages = [
  GrowthStageTarget("Growth", "ကြီးထွားကာလ", 200, 500, 12.0, 20.0, 16),
];

const cropProfiles = <CropProfile>[
  CropProfile("hemp", "Hemp / cannabis", "ဆေးဘက်ဝင်အပင်", hempStages),
  CropProfile("leafy", "Leafy greens", "ဟင်းသီးဟင်းရွက်", leafyStages),
  CropProfile("fruiting", "Tomato / chilli", "ခရမ်းချဉ်၊ ငရုတ်", fruitingStages),
  CropProfile("herbs", "Herbs", "ပင်စိမ်း", herbStages),
];

enum Verdict { tooLow, low, optimal, high, tooHigh }

Verdict evaluate(double ppfd, GrowthStageTarget t) {
  if (ppfd < t.ppfdMin * 0.5) return Verdict.tooLow;
  if (ppfd < t.ppfdMin) return Verdict.low;
  if (ppfd <= t.ppfdMax) return Verdict.optimal;
  if (ppfd <= t.ppfdMax * 1.3) return Verdict.high;
  return Verdict.tooHigh;
}

/// Same five-band judgement for a whole day's light.
Verdict evaluateDli(double value, GrowthStageTarget t) {
  if (value < t.dliMin * 0.5) return Verdict.tooLow;
  if (value < t.dliMin) return Verdict.low;
  if (value <= t.dliMax) return Verdict.optimal;
  if (value <= t.dliMax * 1.3) return Verdict.high;
  return Verdict.tooHigh;
}

/// Detects a pinned ambient-light sensor.
///
/// Most phone sensors clamp around 10,000 lux, and `light_sensor` does not
/// expose `Sensor.maximumRange`, so the ceiling has to be inferred: a clamped
/// sensor returns *exactly* the same value every event. Real light never
/// holds a bit-identical value for a dozen consecutive samples, so a long run
/// of identical high readings is the tell.
///
/// Being wrong in the quiet direction matters here — silently reporting
/// "600 PPFD" in full sun, when the truth is triple that, is how someone
/// cooks a canopy.
class SaturationDetector {
  SaturationDetector({this.runLength = 12, this.minLux = 5000});

  /// Identical readings needed before calling it saturated.
  final int runLength;

  /// Below this, an identical run is just a dim, stable room.
  final double minLux;

  double? _value;
  int _run = 0;

  bool get saturated => _run >= runLength;
  double get pinnedAt => _value ?? 0;

  void add(double lux) {
    if (_value != null && lux == _value) {
      if (_run < runLength * 4) _run++;
    } else {
      _value = lux;
      _run = 1;
    }
    if (lux < minLux) _run = 0;
  }

  void reset() {
    _value = null;
    _run = 0;
  }
}

/// Rolling mean — raw sensor events jump around far too much to read.
class LuxSmoother {
  LuxSmoother({this.window = 20});
  final int window;
  final List<double> _buf = [];

  double add(double lux) {
    _buf.add(lux);
    if (_buf.length > window) _buf.removeAt(0);
    return value;
  }

  double get value =>
      _buf.isEmpty ? 0 : _buf.reduce((a, b) => a + b) / _buf.length;

  bool get warm => _buf.length >= window ~/ 2;

  void reset() => _buf.clear();
}

/// One cell of the canopy light map.
class GridCell {
  const GridCell(this.row, this.col, this.ppfd);
  final int row;
  final int col;
  final double ppfd;
}

class GridStats {
  const GridStats(this.average, this.min, this.max, this.spreadPct);
  final double average;
  final double min;
  final double max;

  /// How far the dimmest corner falls below the average, as a percentage.
  /// This is the number growers act on: a 40% spread means the edge plants
  /// are getting half the light of the middle ones.
  final double spreadPct;
}

GridStats gridStats(Iterable<GridCell> cells) {
  final values = cells.map((c) => c.ppfd).where((v) => v > 0).toList();
  if (values.isEmpty) return const GridStats(0, 0, 0, 0);
  final avg = values.reduce((a, b) => a + b) / values.length;
  final min = values.reduce((a, b) => a < b ? a : b);
  final max = values.reduce((a, b) => a > b ? a : b);
  final spread = avg <= 0 ? 0.0 : (avg - min) / avg * 100;
  return GridStats(avg, min, max, spread);
}

/// Calibration against a known-good meter. Clamped hard: a factor outside
/// 0.2–5 means someone mistyped, and silently trusting it would poison every
/// later reading.
double calibrationFactor(double referenceLux, double phoneLux) {
  if (phoneLux <= 0 || referenceLux <= 0) return 1;
  final f = referenceLux / phoneLux;
  if (f < 0.2 || f > 5) return 1;
  return f;
}

/// Spectrum reference shown in the explain page.
class BandInfo {
  const BandInfo(this.range, this.nameEn, this.nameMy, this.effectEn,
      this.effectMy, this.measurable);
  final String range;
  final String nameEn;
  final String nameMy;
  final String effectEn;
  final String effectMy;

  /// Whether a phone's sensor can see this band at all. UV and far-red are
  /// outside 400–700 nm, so the honest answer is no.
  final bool measurable;
}

const spectrumBands = <BandInfo>[
  BandInfo(
      "280–315nm",
      "UV-B",
      "UV-B",
      "Small amounts raise resin and terpenes; too much burns leaves — and skin and eyes.",
      "နည်းနည်းဆို resin/terpene တိုးတယ်။ များရင် ရွက်လောင်တယ် — လူ့အသားရေနဲ့ မျက်လုံးကိုပါ ထိခိုက်တယ်။",
      false),
  BandInfo(
      "315–400nm",
      "UV-A",
      "UV-A",
      "Deepens colour (anthocyanin) and pest resistance.",
      "အရောင်အသွေး (anthocyanin) နဲ့ ပိုးမွှားခံနိုင်ရည် တိုးတယ်။",
      false),
  BandInfo(
      "400–500nm",
      "Blue",
      "အပြာ",
      "Keeps stems short and leaves thick. Matters most in veg.",
      "ပင်စည်တိုစေ၊ ရွက်ထူစေတယ်။ ရွက်ထွက်ကာလမှာ အရေးအကြီးဆုံး။",
      true),
  BandInfo(
      "500–600nm",
      "Green",
      "အစိမ်း",
      "Penetrates the canopy and reaches lower leaves. The eye sees this best — which is exactly why lux misleads.",
      "ရွက်ကို ဖောက်ဝင်ပြီး အောက်ခြေရွက်အထိ ရောက်တယ်။ လူ့မျက်လုံးက ဒါကို အများဆုံးမြင်လို့ lux က မှားတတ်တာ။",
      true),
  BandInfo(
      "600–700nm",
      "Red",
      "အနီ",
      "The most efficient band for photosynthesis (peak ~660nm). Drives flower, fruit and yield.",
      "Photosynthesis အထိရောက်ဆုံး (660nm ထိပ်)။ အပွင့်၊ အသီး၊ အထွက်နှုန်းအတွက်။",
      true),
  BandInfo(
      "700–780nm",
      "Far-red",
      "Far-red",
      "Stretches stems (shade-avoidance) and shifts flowering time. Paired with red it raises photosynthesis (Emerson effect).",
      "ပင်စည်ရှည်စေပြီး အပွင့်ချိန် ထိန်းညှိတယ်။ အနီနဲ့တွဲရင် photosynthesis ပိုတိုးတယ် (Emerson effect)။",
      false),
];

/// Symptom → likely cause → what to do. The most-used page in practice:
/// growers arrive with a sick plant, not with a number.
class SymptomRow {
  const SymptomRow(
      this.symptomEn, this.symptomMy, this.causeEn, this.causeMy, this.fixEn, this.fixMy);
  final String symptomEn;
  final String symptomMy;
  final String causeEn;
  final String causeMy;
  final String fixEn;
  final String fixMy;
}

const symptomRows = <SymptomRow>[
  SymptomRow("Long stems, wide gaps between leaves", "ပင်စည်ရှည်၊ ရွက်ကြားဝေး",
      "Too little light (etiolation)", "အလင်းနည်း (etiolation)",
      "Lower the lamp or raise PPFD", "မီးကို ချဉ်းကပ်၊ PPFD တိုးပါ"),
  SymptomRow("Top leaves yellow or white", "ရွက်အထက်ပိုင်း ဝါ/ဖြူ",
      "Too much light (bleaching)", "အလင်းများလွန်း (bleaching)",
      "Raise the lamp, cut 20–30%", "မီးကို ခွာ၊ ၂၀–၃၀% လျှော့ပါ"),
  SymptomRow("Leaf edges curl up like a taco", "ရွက်ဘေးကောက် (တောင်းလို)",
      "Heat plus high light", "အပူ + အလင်းများ",
      "Raise the lamp, add airflow", "မီးခွာ၊ လေသွားလာမှု တိုးပါ"),
  SymptomRow("Lower leaves drop", "အောက်ခြေရွက် ကြွေ",
      "Light never reaches them", "အလင်း မရောက်ဘူး",
      "Defoliate or add side lighting", "ရွက်ခြယ်၊ ဘေးမီး ထည့်ပါ"),
  SymptomRow("Small, very dark leaves", "ရွက်သေး၊ အရောင်ရင့်",
      "Light overdose", "အလင်းလွန်ကဲ", "Reduce intensity", "လျှော့ပါ"),
  SymptomRow("Slow growth, oversized leaves", "ကြီးထွားနှေး၊ ရွက်ကြီး",
      "Not enough light", "အလင်းနည်း", "Increase intensity", "တိုးပါ"),
  SymptomRow("Flowering is late", "အပွင့်နောက်ကျ",
      "Photoperiod is wrong", "photoperiod မမှန်",
      "Check the dark period for light leaks", "အမှောင်ချိန် စစ်ဆေးပါ"),
];

/// Target spectrum ratios by stage, for the explain page.
const vegMixEn = "Blue 20–30% · Green 20% · Red 50–60%";
const vegMixMy = "အပြာ ၂၀–၃၀% · အစိမ်း ၂၀% · အနီ ၅၀–၆၀%";
const flowerMixEn = "Blue 10–15% · Green 20% · Red 60–70%";
const flowerMixMy = "အပြာ ၁၀–၁၅% · အစိမ်း ၂၀% · အနီ ၆၀–၇၀%";

/// Lux where a completely dark room stops being dark. A phone screen at arm's
/// length reads a few lux, and that is enough to delay flowering.
const darknessLuxLimit = 1.0;
