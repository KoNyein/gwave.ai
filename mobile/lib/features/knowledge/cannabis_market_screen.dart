import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_state.dart';
import '../../core/i18n.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';

/// Cannabis / hemp / CBD markets — **educational only**, 18+.
///
/// This used to be the web board inside a webview, which meant the site's own
/// header and nav showed through inside the app. Native now: same data, same
/// disclaimers, but it looks like the rest of the app and scrolls like it too.
///
/// What it shows and why: there is no exchange that trades cannabis as a
/// commodity, and the wholesale benchmarks that exist (Hemp Benchmarks™,
/// PanXchange) are licensed feeds we cannot republish. What IS public is the
/// listed-equity market — the ETFs and the producers/retailers/CBD companies —
/// plus a hand-recorded Thai price log for the flower prices no exchange
/// quotes. The screen says which is which rather than blurring them together.
class CannabisMarketScreen extends StatefulWidget {
  const CannabisMarketScreen({super.key});

  @override
  State<CannabisMarketScreen> createState() => _CannabisMarketScreenState();
}

/// One listed instrument.
class _Ticker {
  _Ticker(Map<String, dynamic> j)
      : symbol = (j["symbol"] ?? "").toString(),
        name = (j["name"] ?? "").toString(),
        category = (j["category"] ?? "etf").toString(),
        exchange = (j["exchange"] ?? "").toString(),
        note = (j["note"] ?? "").toString(),
        currency = (j["currency"] ?? "USD").toString(),
        price = (j["usd"] as num?)?.toDouble() ?? 0,
        changePct = (j["changePct"] as num?)?.toDouble(),
        spark = ((j["spark"] as List?) ?? const [])
            .map((v) => (v as num).toDouble())
            .toList();

  final String symbol;
  final String name;
  final String category;
  final String exchange;
  final String note;
  final String currency;
  final double price;
  final double? changePct;
  final List<double> spark;
}

/// One hand-recorded trade quote.
class _Quote {
  _Quote(Map<String, dynamic> j)
      : name = (j["name"] ?? "").toString(),
        grade = j["grade"]?.toString(),
        price = (j["price"] as num?)?.toDouble() ?? 0,
        currency = (j["currency"] ?? "THB").toString(),
        unit = (j["unit"] ?? "g").toString(),
        market = (j["market"] ?? "").toString(),
        note = j["note"]?.toString(),
        quotedAt = (j["quoted_at"] ?? "").toString();

  final String name;
  final String? grade;
  final double price;
  final String currency;
  final String unit;
  final String market;
  final String? note;
  final String quotedAt;
}

const _categories = ["all", "thai", "etf", "producer", "us_retail", "cbd_hemp"];

class _CannabisMarketScreenState extends State<CannabisMarketScreen> {
  List<_Ticker> _tickers = [];
  List<_Quote> _quotes = [];
  bool _loading = true;
  String? _error;
  String _category = "all";

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final api = context.read<AppState>().api;
    try {
      final rows = await api.cannabisMarket();
      // The price log is optional — a missing table shouldn't hide the board.
      List<Map<String, dynamic>> quotes = const [];
      try {
        quotes = await api.cannabisQuotes();
      } catch (_) {
        // Leave the log empty; the listed quotes are the important half.
      }
      if (!mounted) return;
      setState(() {
        _tickers = rows.map(_Ticker.new).toList();
        _quotes = quotes.map(_Quote.new).toList();
      });
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _categoryLabel(BuildContext context, String key) {
    switch (key) {
      case "thai":
        return tr3(context, "Thailand (SET)", "ထိုင်း (SET)", "ไทย (SET)");
      case "etf":
        return tr3(context, "ETFs", "ETF များ", "กองทุน ETF");
      case "producer":
        return tr3(context, "Producers", "ထုတ်လုပ်သူများ", "ผู้ผลิต");
      case "us_retail":
        return tr3(context, "US retail", "US လက်လီ", "ค้าปลีกสหรัฐ");
      case "cbd_hemp":
        return tr3(context, "CBD / hemp", "CBD / Hemp", "CBD / กัญชง");
      default:
        return tr3(context, "All", "အားလုံး", "ทั้งหมด");
    }
  }

  @override
  Widget build(BuildContext context) {
    final shown = _category == "all"
        ? _tickers
        : _tickers.where((t) => t.category == _category).toList();
    return Scaffold(
      backgroundColor: GwColors.bgOf(context),
      appBar: AppBar(
        title: Text(tr3(context, "Cannabis markets", "ဆေးခြောက် ဈေးကွက်",
            "ตลาดกัญชา")),
        actions: [
          IconButton(
            tooltip: tr3(context, "Language", "ဘာသာစကား", "ภาษา"),
            onPressed: () {
              final lang = context.read<GwLang>();
              lang.setCode(lang.code == "my"
                  ? "en"
                  : lang.code == "en"
                      ? "th"
                      : "my");
            },
            icon: const Icon(Icons.translate),
          ),
          IconButton(
            tooltip: tr3(context, "Refresh", "ပြန်ဆွဲ", "รีเฟรช"),
            onPressed: _loading ? null : _load,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const GwSkeletonList(count: 7, hasAvatar: false)
            : ListView(
                padding: const EdgeInsets.fromLTRB(
                    GwSpace.lg, GwSpace.md, GwSpace.lg, GwSpace.xxl),
                children: [
                  _badges(),
                  const SizedBox(height: GwSpace.md),
                  _disclaimer(),
                  const SizedBox(height: GwSpace.md),
                  _thaiLaw(),
                  const SizedBox(height: GwSpace.lg),
                  if (_quotes.isNotEmpty) ...[
                    _sectionTitle(
                      "🇹🇭 ${tr3(context, "Thai price log (hand-recorded)", "ထိုင်းဈေး မှတ်တမ်း (လက်ရေး)", "บันทึกราคาไทย (บันทึกมือ)")}",
                      tr3(
                        context,
                        "No exchange prices flower — these are trade quotes people recorded, not a benchmark.",
                        "ပန်းပွင့်ကို exchange မှာ ဈေးမပေးပါ — ဤသည်များမှာ လူကိုယ်တိုင် မှတ်တမ်းတင်ထားသော အရောင်းအဝယ်ဈေးများသာ ဖြစ်သည်။",
                        "ไม่มีตลาดกลางกำหนดราคาช่อดอก — เป็นราคาซื้อขายที่ผู้ใช้บันทึกไว้",
                      ),
                    ),
                    for (final q in _quotes) _quoteTile(q),
                    const SizedBox(height: GwSpace.lg),
                  ],
                  _sectionTitle(
                    "📈 ${tr3(context, "Listed companies & ETFs", "စာရင်းဝင် ကုမ္ပဏီနှင့် ETF", "บริษัทจดทะเบียนและ ETF")}",
                    tr3(
                      context,
                      "Public stock quotes — the closest thing to a cannabis market index.",
                      "အများပြည်သူ ကြည့်နိုင်သော ရှယ်ယာဈေးများ — ဆေးခြောက် ဈေးကွက် ညွှန်းကိန်းနှင့် အနီးစပ်ဆုံး။",
                      "ราคาหุ้นสาธารณะ — ใกล้เคียงดัชนีตลาดกัญชาที่สุด",
                    ),
                  ),
                  SizedBox(
                    height: 40,
                    child: ListView(
                      scrollDirection: Axis.horizontal,
                      children: [
                        for (final c in _categories)
                          Padding(
                            padding: const EdgeInsets.only(right: GwSpace.sm),
                            child: ChoiceChip(
                              label: Text(_categoryLabel(context, c)),
                              selected: _category == c,
                              onSelected: (_) => setState(() => _category = c),
                            ),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(height: GwSpace.sm),
                  if (_error != null && _tickers.isEmpty)
                    GwEmpty(
                      icon: Icons.cloud_off,
                      title: tr3(context, "Couldn't load quotes",
                          "ဈေးနှုန်း ဆွဲမရပါ", "โหลดราคาไม่ได้"),
                      subtitle: _error,
                      actionLabel:
                          tr3(context, "Try again", "ထပ်ကြိုးစား", "ลองอีกครั้ง"),
                      onAction: _load,
                    )
                  else
                    for (final t in shown) _tickerTile(t),
                  const SizedBox(height: GwSpace.lg),
                  _whyNoSpot(),
                ],
              ),
      ),
    );
  }

  Widget _badges() {
    return Wrap(
      spacing: GwSpace.sm,
      runSpacing: GwSpace.xs,
      children: [
        GwPill(
          label: tr3(context, "18+ only", "၁၈+ သီးသန့်", "18+ เท่านั้น"),
          color: const Color(0xFFDC2626),
          icon: Icons.shield_outlined,
        ),
        GwPill(
          label: tr3(context, "Educational only", "ပညာပေးရည်ရွယ်ချက်သာ",
              "เพื่อการศึกษาเท่านั้น"),
          icon: Icons.school_outlined,
        ),
      ],
    );
  }

  Widget _disclaimer() {
    return Container(
      padding: const EdgeInsets.all(GwSpace.md),
      decoration: BoxDecoration(
        color: const Color(0xFFF59E0B).withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(GwRadius.lg),
        border:
            Border.all(color: const Color(0xFFF59E0B).withValues(alpha: 0.45)),
      ),
      child: Text(
        tr3(
          context,
          "⚠ This page is for education only. It is not investment advice, not "
              "an offer to sell, and not an advertisement. Retail sale and "
              "trading of cannabis is illegal in Myanmar.",
          "⚠ ဤစာမျက်နှာသည် ပညာပေးရည်ရွယ်ချက်သာ ဖြစ်သည်။ ရင်းနှီးမြှုပ်နှံမှု "
              "အကြံဉာဏ် မဟုတ်ပါ။ ရောင်းဝယ်ရန် ကမ်းလှမ်းချက် သို့မဟုတ် ကြော်ငြာ "
              "လုံးဝ မဟုတ်ပါ။ မြန်မာနိုင်ငံတွင် ဆေးခြောက် လက်လီထား/ရောင်းဝယ်ခြင်းသည် "
              "တရားမဝင်ပါ။",
          "⚠ หน้านี้เพื่อการศึกษาเท่านั้น ไม่ใช่คำแนะนำการลงทุน ไม่ใช่การเสนอขาย "
              "และไม่ใช่การโฆษณา",
        ),
        style: const TextStyle(fontSize: 12, height: 1.55),
      ),
    );
  }

  Widget _thaiLaw() {
    final points = [
      tr3(
        context,
        "Cultivation — even at home — must be registered with the Thai FDA.",
        "စိုက်ပျိုးမှု — အိမ်တွင်းစိုက်ပျိုးမှုပါ ထိုင်း FDA တွင် မှတ်ပုံတင်ရသည်။",
        "การปลูก — แม้ปลูกในบ้าน — ต้องจดแจ้งกับ อย.",
      ),
      tr3(
        context,
        "Selling requires a licence from the Department of Thai Traditional Medicine (DTAM).",
        "ရောင်းချရန် ထိုင်းရိုးရာဆေးဌာန (DTAM) မှ လိုင်စင် လိုအပ်သည်။",
        "การขายต้องมีใบอนุญาตจากกรมการแพทย์แผนไทย (DTAM)",
      ),
      tr3(
        context,
        "Extracts above 0.2% THC remain classified as narcotics.",
        "THC ၀.၂% အထက် ပါဝင်သော extract များသည် မူးယစ်ဆေးဝါးအဖြစ် ဆက်လက် သတ်မှတ်ခံရသည်။",
        "สารสกัดที่มี THC เกิน 0.2% ยังคงเป็นยาเสพติด",
      ),
      tr3(
        context,
        "Sale to under-20s, pregnant and breastfeeding people is prohibited.",
        "အသက် ၂၀ အောက်၊ ကိုယ်ဝန်ရှိသူနှင့် နို့တိုက်မိခင်များအား ရောင်းချခြင်း တားမြစ်သည်။",
        "ห้ามขายให้ผู้อายุต่ำกว่า 20 ปี หญิงตั้งครรภ์ และให้นมบุตร",
      ),
      tr3(
        context,
        "Advertising is prohibited, and smoking in public can be penalised as a public nuisance.",
        "ကြော်ငြာခြင်း တားမြစ်ထားပြီး လူစည်ကားရာတွင် သောက်ခြင်းမှာ ပြည်သူ့ကျန်းမာရေးဥပဒေအရ အပြစ်ပေးခံနိုင်သည်။",
        "ห้ามโฆษณา และการสูบในที่สาธารณะอาจมีความผิดฐานก่อความเดือดร้อนรำคาญ",
      ),
      tr3(
        context,
        "Prescription-only rules appeared in 2025 — the rules change often, so check the current notices.",
        "၂၀၂၅ တွင် ဆရာဝန်စာ (prescription) လိုအပ်သည့် စည်းမျဉ်းများ ထွက်ပေါ်လာသည် — စည်းမျဉ်းများ မကြာခဏ ပြောင်းလဲသဖြင့် လက်ရှိ အာဏာတည်ချက်ကို စစ်ဆေးပါ။",
        "ปี 2025 มีกฎให้ต้องมีใบสั่งแพทย์ — กฎเปลี่ยนบ่อย โปรดตรวจสอบประกาศล่าสุด",
      ),
    ];
    return Container(
      padding: const EdgeInsets.all(GwSpace.md),
      decoration: BoxDecoration(
        color: GwColors.surfaceOf(context),
        borderRadius: BorderRadius.circular(GwRadius.lg),
        border: Border.all(color: GwColors.accentOf(context).withValues(alpha: 0.4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Text("⚖️ 🇹🇭", style: TextStyle(fontSize: 15)),
              const SizedBox(width: GwSpace.sm),
              Expanded(
                child: Text(
                  tr3(context, "Thai law — what you must follow",
                      "ထိုင်းဥပဒေ — လိုက်နာရမည့်အချက်များ",
                      "กฎหมายไทย — สิ่งที่ต้องปฏิบัติ"),
                  style: const TextStyle(
                      fontWeight: FontWeight.w800, fontSize: 14),
                ),
              ),
            ],
          ),
          const SizedBox(height: GwSpace.sm),
          for (final p in points)
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text("• "),
                  Expanded(
                    child: Text(p,
                        style: const TextStyle(fontSize: 12, height: 1.5)),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _sectionTitle(String title, String subtitle) {
    return Padding(
      padding: const EdgeInsets.only(bottom: GwSpace.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title,
              style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 15)),
          Text(
            subtitle,
            style: TextStyle(
                fontSize: 11.5,
                height: 1.45,
                color: GwColors.inkSoftOf(context)),
          ),
        ],
      ),
    );
  }

  Widget _quoteTile(_Quote q) {
    return Padding(
      padding: const EdgeInsets.only(bottom: GwSpace.sm),
      child: GwCard(
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(q.name,
                      style: const TextStyle(
                          fontWeight: FontWeight.w700, fontSize: 14)),
                  Text(
                    [
                      if (q.grade != null && q.grade!.isNotEmpty) q.grade!,
                      q.market,
                      q.quotedAt.length >= 10 ? q.quotedAt.substring(0, 10) : "",
                    ].where((s) => s.isNotEmpty).join(" · "),
                    style: TextStyle(
                        fontSize: 11.5, color: GwColors.inkSoftOf(context)),
                  ),
                  if (q.note != null && q.note!.isNotEmpty)
                    Text(q.note!,
                        style: TextStyle(
                            fontSize: 11,
                            color: GwColors.inkSoftOf(context))),
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  q.price.toStringAsFixed(q.price >= 100 ? 0 : 2),
                  style: const TextStyle(
                      fontWeight: FontWeight.w900, fontSize: 16),
                ),
                Text("${q.currency} /${q.unit}",
                    style: TextStyle(
                        fontSize: 11, color: GwColors.inkSoftOf(context))),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _tickerTile(_Ticker t) {
    final up = (t.changePct ?? 0) >= 0;
    final color = t.changePct == null
        ? GwColors.inkSoftOf(context)
        : up
            ? const Color(0xFF16A34A)
            : const Color(0xFFDC2626);
    return Padding(
      padding: const EdgeInsets.only(bottom: GwSpace.sm),
      child: GwCard(
        child: Row(
          children: [
            Expanded(
              flex: 4,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(t.symbol,
                      style: const TextStyle(
                          fontWeight: FontWeight.w900, fontSize: 14)),
                  Text(t.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                          fontSize: 11.5,
                          color: GwColors.inkSoftOf(context))),
                  Text("${t.exchange} · ${t.note}",
                      maxLines: 2,
                      style: TextStyle(
                          fontSize: 10.5,
                          height: 1.35,
                          color: GwColors.inkSoftOf(context))),
                ],
              ),
            ),
            // A month of closes says more about a stock than one number does.
            if (t.spark.length > 2)
              Expanded(
                flex: 3,
                child: SizedBox(
                  height: 32,
                  child: CustomPaint(
                    painter: _SparkPainter(t.spark, color),
                    size: Size.infinite,
                  ),
                ),
              ),
            const SizedBox(width: GwSpace.sm),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  t.price.toStringAsFixed(t.price >= 100 ? 0 : 2),
                  style: const TextStyle(
                      fontWeight: FontWeight.w900, fontSize: 15),
                ),
                Text(t.currency,
                    style: TextStyle(
                        fontSize: 10, color: GwColors.inkSoftOf(context))),
                if (t.changePct != null)
                  Text(
                    "${up ? "▲" : "▼"} ${t.changePct!.abs().toStringAsFixed(2)}%",
                    style: TextStyle(
                        fontSize: 11, fontWeight: FontWeight.w700, color: color),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _whyNoSpot() {
    return Container(
      padding: const EdgeInsets.all(GwSpace.md),
      decoration: BoxDecoration(
        color: GwColors.surfaceMutedOf(context),
        borderRadius: BorderRadius.circular(GwRadius.lg),
      ),
      child: Text(
        tr3(
          context,
          "Why is there no spot price? Cannabis is not traded as a commodity on "
              "any exchange. The wholesale hemp/CBD benchmarks that do exist "
              "(Hemp Benchmarks™ and similar) are paid licensed feeds we cannot "
              "republish, so this board shows only public quotes.",
          "ဘာလို့ ကမ္ဘာ့ရှယ်ယာဈေးတွေလဲ? — ဆေးခြောက်ကို commodity အနေနဲ့ "
              "ရောင်းဝယ်တဲ့ exchange မရှိပါ။ လက်ကား hemp/CBD စံဈေး (Hemp "
              "Benchmarks™) တွေက လိုင်စင်ဝယ်ရတဲ့ feed များဖြစ်လို့ ပြန်လည် "
              "ဖော်ပြခွင့် မရှိပါ။ ထို့ကြောင့် အများပြည်သူ ကြည့်နိုင်သည့် "
              "ဈေးများကိုသာ ပြထားပါသည်။",
          "ทำไมไม่มีราคาสปอต? กัญชาไม่ได้ซื้อขายเป็นสินค้าโภคภัณฑ์ในตลาดใด "
              "ดัชนีขายส่ง hemp/CBD ที่มีอยู่เป็นฟีดที่ต้องซื้อลิขสิทธิ์ "
              "จึงแสดงเฉพาะราคาสาธารณะ",
        ),
        style: TextStyle(
            fontSize: 11.5, height: 1.55, color: GwColors.inkSoftOf(context)),
      ),
    );
  }
}

/// A month of closing prices as one line. Deliberately axis-free: the shape is
/// the message, and a row this small has no room for numbers on it.
class _SparkPainter extends CustomPainter {
  _SparkPainter(this.values, this.color);
  final List<double> values;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    if (values.length < 2) return;
    var lo = values.first;
    var hi = values.first;
    for (final v in values) {
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    final span = (hi - lo).abs() < 1e-9 ? 1.0 : hi - lo;
    final path = Path();
    for (var i = 0; i < values.length; i++) {
      final x = size.width * (i / (values.length - 1));
      final y = size.height * (1 - (values[i] - lo) / span);
      if (i == 0) {
        path.moveTo(x, y);
      } else {
        path.lineTo(x, y);
      }
    }
    canvas.drawPath(
      path,
      Paint()
        ..color = color
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.6
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round,
    );
  }

  @override
  bool shouldRepaint(covariant _SparkPainter old) =>
      old.values != values || old.color != color;
}
