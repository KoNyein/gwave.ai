import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_state.dart';
import '../../core/i18n.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';
import 'mine_sites_screen.dart';

/// World metal prices — native.
///
/// This was the web board in a webview, so the site's own header and nav sat
/// on top of the app's. Same data, same market log, but native: it scrolls
/// like the app, the unit switch is a real segmented control, and tapping a
/// metal expands it in place instead of navigating.
///
/// Two kinds of number live here and the screen keeps them apart on purpose:
///
///  * **Exchange quotes** — COMEX/NYMEX (and LME when the metals.dev key is
///    configured). Live, machine-read, trustworthy.
///  * **The market log** — hand-recorded quotes for the metals no free feed
///    prices: tin, antimony, rare earth, and the Myanmar border gates where
///    the price differs gate by gate. Somebody typed those in, and the screen
///    says so rather than dressing them up as a feed.
class MetalPricesScreen extends StatefulWidget {
  const MetalPricesScreen({super.key});

  @override
  State<MetalPricesScreen> createState() => _MetalPricesScreenState();
}

class _Metal {
  _Metal(Map<String, dynamic> j)
      : key = (j["key"] ?? "").toString(),
        name = (j["name"] ?? "").toString(),
        nameMy = (j["nameMy"] ?? "").toString(),
        group = (j["group"] ?? "base").toString(),
        exchange = (j["exchange"] ?? "").toString(),
        usd = (j["usd"] as num?)?.toDouble() ?? 0,
        unit = (j["unit"] ?? "toz").toString(),
        changePct = (j["changePct"] as num?)?.toDouble(),
        spark = ((j["spark"] as List?) ?? const [])
            .map((v) => (v as num).toDouble())
            .toList();

  final String key;
  final String name;
  final String nameMy;
  final String group;
  final String exchange;
  final double usd;
  final String unit;
  final double? changePct;
  final List<double> spark;
}

class _Quote {
  _Quote(Map<String, dynamic> j)
      : nameMy = (j["name_my"] ?? "").toString(),
        grade = j["grade"]?.toString(),
        price = (j["price"] as num?)?.toDouble() ?? 0,
        currency = (j["currency"] ?? "USD").toString(),
        unit = (j["unit"] ?? "kg").toString(),
        market = (j["market"] ?? "").toString(),
        note = j["note"]?.toString(),
        quotedAt = (j["quoted_at"] ?? "").toString();

  final String nameMy;
  final String? grade;
  final double price;
  final String currency;
  final String unit;
  final String market;
  final String? note;
  final String quotedAt;
}

/// Grams per quoted unit — the bridge between an exchange and a kitchen scale.
const _grams = {"toz": 31.1034768, "lb": 453.59237, "t": 1000000.0};

/// ကျပ်သား = 16.606 g, the unit every Myanmar gold shop actually quotes in.
const _displayUnits = [
  ["quoted", "Market unit", "ဈေးကွက်ယူနစ်", "0"],
  ["kyattha", "Kyattha (16.6 g)", "ကျပ်သား", "16.606"],
  ["gram", "Gram", "ဂရမ်", "1"],
  ["kg", "Kilogram", "ကီလို", "1000"],
];

const _unitLabel = {"toz": "oz t", "lb": "lb", "t": "tonne"};

/// A logged quote whose market names LME/Rotterdam/"world" is a world
/// reference; everything else is a Myanmar local or border-gate price. Keeping
/// them in separate sections is the whole point of the log — a Kayah gate
/// price and the LME are not the same kind of number.
bool _isWorldMarket(String market) {
  final m = market.toLowerCase();
  return m.contains("lme") ||
      m.contains("rotterdam") ||
      m.contains("world") ||
      market.contains("ကမ္ဘာ") ||
      market.contains("ရော်တာဒမ်");
}

class _MetalPricesScreenState extends State<MetalPricesScreen> {
  List<_Metal> _metals = [];
  List<_Quote> _quotes = [];
  Map<String, dynamic> _sources = const {};
  bool _loading = true;
  String? _error;
  String _unit = "quoted";
  String? _expanded;

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
      final body = await api.metals();
      // The log is optional — a missing table shouldn't hide live prices.
      List<Map<String, dynamic>> quotes = const [];
      try {
        quotes = await api.metalQuotes();
      } catch (_) {
        // Leave the log empty; the exchange board is the important half.
      }
      if (!mounted) return;
      setState(() {
        _metals = ((body["metals"] as List?) ?? const [])
            .whereType<Map<String, dynamic>>()
            .map(_Metal.new)
            .toList();
        _sources = (body["sources"] as Map<String, dynamic>?) ?? const {};
        _quotes = quotes.map(_Quote.new).toList();
      });
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// Convert a quote into the unit the user asked for. "Market unit" leaves it
  /// alone, which matters — an ounce price is what a trader will quote back.
  ({String value, String suffix}) _priceFor(_Metal m) {
    if (_unit == "quoted") {
      return (
        value: _fmt(m.usd),
        suffix: "/${_unitLabel[m.unit] ?? m.unit}",
      );
    }
    final row = _displayUnits.firstWhere((u) => u[0] == _unit);
    final target = double.parse(row[3]);
    final perGram = m.usd / (_grams[m.unit] ?? 1);
    final label = _unit == "kyattha" ? "ကျပ်သား" : _unit;
    return (value: _fmt(perGram * target), suffix: "/$label");
  }

  static String _fmt(double v) {
    if (v >= 1000) {
      return v.toStringAsFixed(0).replaceAllMapped(
            RegExp(r"(\d)(?=(\d{3})+$)"),
            (m) => "${m[1]},",
          );
    }
    if (v >= 10) return v.toStringAsFixed(2);
    if (v >= 1) return v.toStringAsFixed(3);
    return v.toStringAsFixed(4);
  }

  @override
  Widget build(BuildContext context) {
    final precious = _metals.where((m) => m.group == "precious").toList();
    final base = _metals.where((m) => m.group != "precious").toList();
    final world = _latestPerMarket().where((q) => _isWorldMarket(q.market));
    final local = _latestPerMarket().where((q) => !_isWorldMarket(q.market));

    return Scaffold(
      backgroundColor: GwColors.bgOf(context),
      appBar: AppBar(
        title: Text(tr3(context, "Metal prices", "သတ္တုဈေးနှုန်း", "ราคาโลหะ")),
        actions: [
          IconButton(
            tooltip: tr3(context, "Mine sites", "မိုင်းနေရာများ", "แหล่งเหมือง"),
            icon: const Icon(Icons.terrain_outlined),
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const MineSitesScreen()),
            ),
          ),
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
            ? const GwSkeletonList(count: 8, hasAvatar: false)
            : ListView(
                padding: const EdgeInsets.fromLTRB(
                    GwSpace.lg, GwSpace.md, GwSpace.lg, GwSpace.xxl),
                children: [
                  _unitSwitch(),
                  const SizedBox(height: GwSpace.sm),
                  _sourceLine(),
                  const SizedBox(height: GwSpace.md),
                  if (_error != null && _metals.isEmpty)
                    GwEmpty(
                      icon: Icons.cloud_off,
                      title: tr3(context, "Couldn't load prices",
                          "ဈေးနှုန်း ဆွဲမရပါ", "โหลดราคาไม่ได้"),
                      subtitle: _error,
                      actionLabel: tr3(
                          context, "Try again", "ထပ်ကြိုးစား", "ลองอีกครั้ง"),
                      onAction: _load,
                    ),
                  if (precious.isNotEmpty) ...[
                    _sectionTitle(
                      "💎 ${tr3(context, "Precious", "အဖိုးတန်သတ္တု", "โลหะมีค่า")}",
                      tr3(context, "COMEX / NYMEX — live", "COMEX / NYMEX — တိုက်ရိုက်",
                          "COMEX / NYMEX — เรียลไทม์"),
                    ),
                    for (final m in precious) _metalTile(m),
                    const SizedBox(height: GwSpace.lg),
                  ],
                  if (base.isNotEmpty) ...[
                    _sectionTitle(
                      "🏭 ${tr3(context, "Base / LME", "စက်မှုသတ္တု (Base / LME)", "โลหะพื้นฐาน / LME")}",
                      tr3(context, "Industrial metals", "စက်မှုလုပ်ငန်းသုံး သတ္တုများ",
                          "โลหะอุตสาหกรรม"),
                    ),
                    for (final m in base) _metalTile(m),
                    const SizedBox(height: GwSpace.lg),
                  ],
                  if (world.isNotEmpty) ...[
                    _sectionTitle(
                      "🌍 ${tr3(context, "World reference (logged)", "ကမ္ဘာ့ကိုးကားဈေး (မှတ်တမ်း)", "ราคาอ้างอิงโลก (บันทึก)")}",
                      tr3(
                        context,
                        "Metals no free feed prices — recorded by hand.",
                        "အခမဲ့ feed မရှိသော သတ္တုများ — လက်ဖြင့် မှတ်တမ်းတင်ထားသည်။",
                        "โลหะที่ไม่มีฟีดฟรี — บันทึกด้วยมือ",
                      ),
                    ),
                    for (final q in world) _quoteTile(q, world: true),
                    const SizedBox(height: GwSpace.lg),
                  ],
                  if (local.isNotEmpty) ...[
                    _sectionTitle(
                      "🇲🇲 ${tr3(context, "Myanmar / border gates", "မြန်မာ / နယ်စပ်ဂိတ်များ", "เมียนมา / ด่านชายแดน")}",
                      tr3(
                        context,
                        "Gate prices differ — transport difficulty and who controls the road.",
                        "ဂိတ်အလိုက် ဈေးကွာသည် — သယ်ယူပို့ဆောင်ရေး အခက်အခဲနှင့် လမ်းကြောင်း ထိန်းချုပ်မှုပေါ် မူတည်သည်။",
                        "ราคาต่างกันตามด่าน — ขึ้นกับความยากในการขนส่งและผู้ควบคุมเส้นทาง",
                      ),
                    ),
                    for (final q in local) _quoteTile(q, world: false),
                    const SizedBox(height: GwSpace.lg),
                  ],
                  _help(),
                ],
              ),
      ),
    );
  }

  /// One row per (metal, market) — the log keeps history, the board wants the
  /// newest of each.
  List<_Quote> _latestPerMarket() {
    final seen = <String>{};
    final out = <_Quote>[];
    for (final q in _quotes) {
      final key = "${q.nameMy}|${q.market}|${q.grade ?? ""}";
      if (seen.add(key)) out.add(q);
    }
    return out;
  }

  Widget _unitSwitch() {
    return SizedBox(
      height: 38,
      child: ListView(
        scrollDirection: Axis.horizontal,
        children: [
          for (final u in _displayUnits)
            Padding(
              padding: const EdgeInsets.only(right: GwSpace.sm),
              child: ChoiceChip(
                label: Text(tr3(context, u[1], u[2], u[1])),
                selected: _unit == u[0],
                onSelected: (_) => setState(() => _unit = u[0]),
              ),
            ),
        ],
      ),
    );
  }

  Widget _sourceLine() {
    final comex = _sources["comex"] == true;
    final lme = _sources["lme"] == true;
    final lmeConfigured = _sources["lmeConfigured"] == true;
    return Wrap(
      spacing: GwSpace.sm,
      runSpacing: GwSpace.xs,
      children: [
        GwPill(
          label: comex ? "COMEX ✓" : "COMEX ✕",
          color: comex ? const Color(0xFF16A34A) : GwColors.inkSoftOf(context),
        ),
        GwPill(
          label: lme
              ? "LME ✓"
              : lmeConfigured
                  ? "LME …"
                  : tr3(context, "LME not configured", "LME မသတ်မှတ်ရသေး",
                      "ยังไม่ตั้งค่า LME"),
          color: lme ? const Color(0xFF16A34A) : GwColors.inkSoftOf(context),
        ),
        GwPill(
          label: tr3(context, "Tap a row for detail", "အတန်းကို နှိပ်၍ အသေးစိတ်",
              "แตะแถวเพื่อดูรายละเอียด"),
          icon: Icons.touch_app_outlined,
        ),
      ],
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
          Text(subtitle,
              style: TextStyle(
                  fontSize: 11.5,
                  height: 1.45,
                  color: GwColors.inkSoftOf(context))),
        ],
      ),
    );
  }

  Widget _metalTile(_Metal m) {
    final up = (m.changePct ?? 0) >= 0;
    final color = m.changePct == null
        ? GwColors.inkSoftOf(context)
        : up
            ? const Color(0xFF16A34A)
            : const Color(0xFFDC2626);
    final price = _priceFor(m);
    final open = _expanded == m.key;
    return Padding(
      padding: const EdgeInsets.only(bottom: GwSpace.sm),
      child: GwCard(
        onTap: () => setState(() => _expanded = open ? null : m.key),
        child: Column(
          children: [
            Row(
              children: [
                Expanded(
                  flex: 4,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(m.nameMy.isEmpty ? m.name : m.nameMy,
                          style: const TextStyle(
                              fontWeight: FontWeight.w800, fontSize: 15)),
                      Text("${m.name} · ${m.exchange}",
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                              fontSize: 11.5,
                              color: GwColors.inkSoftOf(context))),
                    ],
                  ),
                ),
                if (m.spark.length > 2)
                  Expanded(
                    flex: 3,
                    child: SizedBox(
                      height: 30,
                      child: CustomPaint(
                        painter: _SparkPainter(m.spark, color),
                        size: Size.infinite,
                      ),
                    ),
                  ),
                const SizedBox(width: GwSpace.sm),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(price.value,
                        style: const TextStyle(
                            fontWeight: FontWeight.w900, fontSize: 16)),
                    Text("USD ${price.suffix}",
                        style: TextStyle(
                            fontSize: 10.5,
                            color: GwColors.inkSoftOf(context))),
                    if (m.changePct != null)
                      Text(
                        "${up ? "▲" : "▼"} ${m.changePct!.abs().toStringAsFixed(2)}%",
                        style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: color),
                      ),
                  ],
                ),
                Icon(open ? Icons.expand_less : Icons.expand_more,
                    size: 20, color: GwColors.inkSoftOf(context)),
              ],
            ),
            if (open) _metalDetail(m),
          ],
        ),
      ),
    );
  }

  /// Every unit at once — because the trader asking "what's that per ကျပ်သား"
  /// shouldn't have to switch the whole board to find out.
  Widget _metalDetail(_Metal m) {
    final perGram = m.usd / (_grams[m.unit] ?? 1);
    final rows = [
      [tr3(context, "Market unit", "ဈေးကွက်ယူနစ်", "หน่วยตลาด"),
        "${_fmt(m.usd)} USD /${_unitLabel[m.unit] ?? m.unit}"],
      ["ကျပ်သား (16.606 g)", "${_fmt(perGram * 16.606)} USD"],
      [tr3(context, "Gram", "ဂရမ်", "กรัม"), "${_fmt(perGram)} USD"],
      [tr3(context, "Kilogram", "ကီလို", "กิโลกรัม"),
        "${_fmt(perGram * 1000)} USD"],
      [tr3(context, "Troy ounce", "အောင်စ (troy)", "ทรอยออนซ์"),
        "${_fmt(perGram * 31.1034768)} USD"],
    ];
    return Padding(
      padding: const EdgeInsets.only(top: GwSpace.md),
      child: Column(
        children: [
          Divider(height: 1, color: GwColors.lineOf(context)),
          const SizedBox(height: GwSpace.sm),
          for (final r in rows)
            Padding(
              padding: const EdgeInsets.only(bottom: 5),
              child: Row(
                children: [
                  Expanded(
                    child: Text(r[0],
                        style: TextStyle(
                            fontSize: 12,
                            color: GwColors.inkSoftOf(context))),
                  ),
                  Text(r[1],
                      style: const TextStyle(
                          fontSize: 12.5, fontWeight: FontWeight.w700)),
                ],
              ),
            ),
          const SizedBox(height: GwSpace.xs),
          Align(
            alignment: Alignment.centerLeft,
            child: Text(
              tr3(
                context,
                "Exchange quote — the benchmark, before refining charges, transport and local margin.",
                "ဈေးကွက် ကိုးကားဈေး — သန့်စင်ခ၊ သယ်ယူစရိတ်နှင့် ဒေသတွင်း အမြတ် မပါသေးပါ။",
                "ราคาอ้างอิงตลาด — ยังไม่รวมค่าถลุง ค่าขนส่ง และกำไรท้องถิ่น",
              ),
              style: TextStyle(
                  fontSize: 11,
                  height: 1.45,
                  color: GwColors.inkSoftOf(context)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _quoteTile(_Quote q, {required bool world}) {
    final accent =
        world ? const Color(0xFF0EA5E9) : GwColors.accentOf(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: GwSpace.sm),
      child: GwCard(
        accent: accent,
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(q.nameMy,
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
                Text(_fmt(q.price),
                    style: const TextStyle(
                        fontWeight: FontWeight.w900, fontSize: 16)),
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

  Widget _help() {
    final items = [
      (
        tr3(context, "Where do these prices come from?", "ဒီဈေးနှုန်းတွေ ဘယ်ကလာသလဲ?",
            "ราคาเหล่านี้มาจากไหน?"),
        tr3(
          context,
          "Gold, silver, platinum, palladium and copper are live COMEX/NYMEX quotes. LME metals arrive when the metals.dev key is configured. Everything under the market log was typed in by hand.",
          "ရွှေ၊ ငွေ၊ ပလက်တီနမ်၊ ပလေဒီယမ်နှင့် ကြေးနီတို့မှာ COMEX/NYMEX မှ တိုက်ရိုက်ဈေးများ ဖြစ်သည်။ LME သတ္တုများသည် metals.dev key သတ်မှတ်ထားမှ ရောက်လာသည်။ မှတ်တမ်းအောက်က ဈေးများမှာ လူကိုယ်တိုင် ရိုက်ထည့်ထားခြင်း ဖြစ်သည်။",
          "ทองคำ เงิน แพลทินัม แพลเลเดียม และทองแดง เป็นราคาสดจาก COMEX/NYMEX ส่วนบันทึกราคาเป็นการกรอกด้วยมือ",
        ),
      ),
      (
        tr3(context, "Why isn't tin here?", "ခဲမဖြူ ဘာလို့ မပါသလဲ?",
            "ทำไมไม่มีดีบุก?"),
        tr3(
          context,
          "The free metals.dev tier does not carry tin or rhodium. Rather than invent a number, tin lives in the market log with the date and market attached, so you can see exactly how old it is.",
          "metals.dev အခမဲ့ အဆင့်တွင် ခဲမဖြူနှင့် rhodium မပါဝင်ပါ။ ကိန်းဂဏန်း လုပ်ကြံမည့်အစား ခဲမဖြူကို ဈေးမှတ်တမ်းတွင် ရက်စွဲနှင့် ဈေးကွက် တွဲဖော်ပြထားသဖြင့် ဘယ်လောက် ဟောင်းနေပြီလဲ တိတိကျကျ မြင်နိုင်ပါသည်။",
          "แพ็กเกจฟรีของ metals.dev ไม่มีดีบุกและโรเดียม จึงบันทึกไว้ในบันทึกราคาพร้อมวันที่และตลาด",
        ),
      ),
      (
        tr3(context, "Why do gate prices differ?", "ဂိတ်အလိုက် ဘာလို့ ဈေးကွာသလဲ?",
            "ทำไมราคาแต่ละด่านต่างกัน?"),
        tr3(
          context,
          "Transport difficulty and who controls the road. A gate that is hard to reach, or that charges more to pass, prices lower at the mine and higher at the border.",
          "သယ်ယူပို့ဆောင်ရေး အခက်အခဲနှင့် လမ်းကြောင်း ထိန်းချုပ်သူပေါ် မူတည်သည်။ သွားရခက်သော (သို့) ဖြတ်သန်းခ ပိုပေးရသော ဂိတ်များတွင် မိုင်းဝ ဈေးနိမ့်ပြီး နယ်စပ်ဈေး မြင့်တတ်သည်။",
          "ขึ้นกับความยากในการขนส่งและผู้ควบคุมเส้นทาง",
        ),
      ),
      (
        tr3(context, "Legal note", "ဥပဒေရေးရာ သတိပေးချက်", "ข้อกฎหมาย"),
        tr3(
          context,
          "Prices are information, not an offer to trade. Mining and exporting minerals in Myanmar requires a licence, and some minerals — uranium above all — are restricted outright.",
          "ဈေးနှုန်းများသည် သတင်းအချက်အလက်သာ ဖြစ်ပြီး ရောင်းဝယ်ရန် ကမ်းလှမ်းချက် မဟုတ်ပါ။ မြန်မာနိုင်ငံတွင် သတ္တုတူးဖော်ခြင်းနှင့် တင်ပို့ခြင်းအတွက် လိုင်စင် လိုအပ်ပြီး အချို့သတ္တုများ — အထူးသဖြင့် ယူရေနီယမ် — မှာ လုံးဝ ကန့်သတ်ထားပါသည်။",
          "ราคาเป็นข้อมูลเท่านั้น ไม่ใช่การเสนอซื้อขาย การทำเหมืองและส่งออกในเมียนมาต้องมีใบอนุญาต",
        ),
      ),
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _sectionTitle(
          "❓ ${tr3(context, "How to use / help", "အသုံးပြုနည်း / အကူအညီ", "วิธีใช้ / ช่วยเหลือ")}",
          "",
        ),
        for (final item in items)
          Theme(
            // ExpansionTile draws its own dividers, which fight the cards.
            data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
            child: ExpansionTile(
              tilePadding: EdgeInsets.zero,
              childrenPadding: const EdgeInsets.only(bottom: GwSpace.sm),
              title: Text(item.$1,
                  style: const TextStyle(
                      fontSize: 13.5, fontWeight: FontWeight.w700)),
              children: [
                Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    item.$2,
                    style: TextStyle(
                        fontSize: 12.5,
                        height: 1.6,
                        color: GwColors.inkSoftOf(context)),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

/// A month of closes as one line — the shape is the message, and a row this
/// small has no room for axes.
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
