import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:light/light.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:wakelock_plus/wakelock_plus.dart';

import '../../../core/i18n.dart';
import '../../../core/theme.dart';
import 'light_science.dart';

/// Plant light meter — reads the phone's ambient-light sensor and converts it
/// to PPFD and DLI for a chosen crop and growth stage.
///
/// This is an estimate, not an instrument, and the screen says so in three
/// places rather than one. A grower who trusts a wrong number and moves a
/// lamp 30 cm closer can bleach a canopy in a day, so every place the estimate
/// can break — wrong lamp type, saturated sensor, purple LEDs, a phone case
/// over the sensor — is surfaced instead of smoothed over.
class LightMeterScreen extends StatefulWidget {
  const LightMeterScreen({super.key});

  @override
  State<LightMeterScreen> createState() => _LightMeterScreenState();
}

enum _Page { measure, explain, grid, history, calibrate }

class _LightMeterScreenState extends State<LightMeterScreen> {
  static const _prefCalib = "gw_light_calib";
  static const _prefLog = "gw_light_log";
  static const _prefSource = "gw_light_source";
  static const _prefCrop = "gw_light_crop";
  static const _prefStage = "gw_light_stage";
  static const _prefNight = "gw_light_night";

  StreamSubscription<int>? _sub;

  /// Fires if no reading ever arrives — see [_start].
  Timer? _probe;
  bool? _hasSensor; // null = still checking
  final _smoother = LuxSmoother();
  final _saturation = SaturationDetector();

  double _rawLux = 0;
  double _lux = 0;
  double _calibration = 1;

  /// Deliberately null at first — PPFD is not shown until a lamp is chosen,
  /// because the conversion factor differs by more than 2× across sources.
  LightSource? _source;
  String _cropId = "hemp";
  int _stageIndex = 1;
  int _hours = 12;

  _Page _page = _Page.measure;
  bool _night = false;

  /// Set when a sensor-less phone opts into the reference pages. Kept apart
  /// from [_hasSensor] so the meter never pretends to have a reading.
  bool _referenceOnly = false;

  /// ★ Must live in state, not build(): the sensor fires ~20 times a second
  /// and every event calls setState, so a controller created in build would
  /// be replaced mid-keystroke and the field could never be typed into.
  final _refCtrl = TextEditingController();

  final List<LightSample> _log = [];
  final Map<String, double> _grid = {}; // "r,c" -> ppfd
  int _gridRows = 4;
  int _gridCols = 4;

  @override
  void initState() {
    super.initState();
    _restore();
    _start();
    // Growers hold the phone at canopy height for a while waiting for the
    // reading to settle; letting the screen sleep mid-measurement is the
    // single most annoying thing this screen could do.
    WakelockPlus.enable().catchError((_) {});
  }

  @override
  void dispose() {
    _sub?.cancel();
    _probe?.cancel();
    _refCtrl.dispose();
    WakelockPlus.disable().catchError((_) {});
    super.dispose();
  }

  Future<void> _restore() async {
    try {
      final p = await SharedPreferences.getInstance();
      final srcName = p.getString(_prefSource);
      final logRaw = p.getString(_prefLog);
      if (!mounted) return;
      setState(() {
        _calibration = p.getDouble(_prefCalib) ?? 1;
        _cropId = p.getString(_prefCrop) ?? "hemp";
        _stageIndex = p.getInt(_prefStage) ?? 1;
        _night = p.getBool(_prefNight) ?? false;
        if (srcName != null) {
          for (final s in LightSource.values) {
            if (s.name == srcName) _source = s;
          }
        }
        if (logRaw != null) {
          final list = jsonDecode(logRaw);
          if (list is List) {
            _log
              ..clear()
              ..addAll(list
                  .whereType<Map<String, dynamic>>()
                  .map(LightSample.fromJson));
          }
        }
        _hours = _stage.photoperiod;
      });
    } catch (_) {
      // Corrupt prefs must not brick the meter — defaults are fine.
    }
  }

  Future<void> _persist() async {
    try {
      final p = await SharedPreferences.getInstance();
      await p.setDouble(_prefCalib, _calibration);
      await p.setString(_prefCrop, _cropId);
      await p.setInt(_prefStage, _stageIndex);
      await p.setBool(_prefNight, _night);
      if (_source != null) await p.setString(_prefSource, _source!.name);
      await p.setString(
          _prefLog, jsonEncode(_log.map((e) => e.toJson()).toList()));
    } catch (_) {}
  }

  /// Subscribe and decide availability from what actually arrives.
  ///
  /// ★ The plugin has no "does this phone have the sensor" call, and a boolean
  ///   from one would not be worth much anyway — phones exist that report a
  ///   light sensor and then never deliver an event. So: an event means yes,
  ///   an error means no, and silence for four seconds means no. Android
  ///   delivers the first reading almost immediately on registration, so the
  ///   timeout is generous rather than tight.
  Future<void> _start() async {
    try {
      _sub = Light().lightSensorStream.listen(
        (v) {
          // -1 is the plugin's "could not parse" value; treating it as a
          // reading would show a negative PPFD.
          if (v < 0) return;
          _probe?.cancel();
          final raw = v.toDouble();
          _saturation.add(raw);
          final smooth = _smoother.add(raw);
          if (!mounted) return;
          setState(() {
            _hasSensor = true;
            _rawLux = raw;
            _lux = smooth * _calibration;
          });
        },
        onError: (Object _) {
          _probe?.cancel();
          if (mounted) setState(() => _hasSensor = false);
        },
      );
    } catch (_) {
      if (mounted) setState(() => _hasSensor = false);
      return;
    }

    _probe = Timer(const Duration(seconds: 4), () {
      if (mounted && _hasSensor == null) setState(() => _hasSensor = false);
    });
  }

  CropProfile get _crop =>
      cropProfiles.firstWhere((c) => c.id == _cropId, orElse: () => cropProfiles.first);

  GrowthStageTarget get _stage {
    final stages = _crop.stages;
    final i = _stageIndex.clamp(0, stages.length - 1);
    return stages[i];
  }

  double? get _ppfd => _source == null ? null : luxToPpfd(_lux, _source!);

  double? get _dliNow {
    final p = _ppfd;
    return p == null ? null : dli(p, _hours.toDouble());
  }

  // ── UI ────────────────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    // Red night mode: during flowering the room must stay dark, and a bright
    // white screen in there is exactly the light leak the app warns about.
    final tint = _night ? const Color(0xFFFF3B30) : null;
    final showMeter = _hasSensor == true || _referenceOnly;
    final body = _hasSensor == null
        ? const Center(child: CircularProgressIndicator())
        : !showMeter
            ? _noSensor(context)
            : switch (_page) {
                _Page.measure => _measurePage(context),
                _Page.explain => _explainPage(context),
                _Page.grid => _gridPage(context),
                _Page.history => _historyPage(context),
                _Page.calibrate => _calibratePage(context),
              };

    return Scaffold(
      backgroundColor: _night ? Colors.black : GwColors.bgOf(context),
      appBar: AppBar(
        backgroundColor: _night ? Colors.black : null,
        foregroundColor: tint,
        title: Text(tr(context, "Light meter", "အလင်းရောင်တိုင်းစက်")),
        actions: [
          IconButton(
            tooltip: tr(context, "Night mode (red)", "ညမုဒ် (အနီ)"),
            icon: Icon(_night ? Icons.nightlight : Icons.nightlight_outlined),
            onPressed: () {
              setState(() => _night = !_night);
              _persist();
            },
          ),
        ],
      ),
      body: DefaultTextStyle.merge(
        style: tint == null ? const TextStyle() : TextStyle(color: tint),
        child: body,
      ),
      bottomNavigationBar: showMeter
          ? NavigationBar(
              selectedIndex: _Page.values.indexOf(_page),
              onDestinationSelected: (i) =>
                  setState(() => _page = _Page.values[i]),
              destinations: [
                NavigationDestination(
                    icon: const Icon(Icons.speed_outlined),
                    label: tr(context, "Measure", "တိုင်းရန်")),
                NavigationDestination(
                    icon: const Icon(Icons.menu_book_outlined),
                    label: tr(context, "Explain", "ရှင်းလင်း")),
                NavigationDestination(
                    icon: const Icon(Icons.grid_on_outlined),
                    label: tr(context, "Map", "မြေပုံ")),
                NavigationDestination(
                    icon: const Icon(Icons.history),
                    label: tr(context, "History", "မှတ်တမ်း")),
                NavigationDestination(
                    icon: const Icon(Icons.tune),
                    label: tr(context, "Calibrate", "ချိန်ညှိ")),
              ],
            )
          : null,
    );
  }

  /// Phones without an ambient-light sensor exist, and they are exactly the
  /// cheap ones this app's users carry. Explain instead of crashing — and
  /// leave the reference material reachable, since that part still works.
  Widget _noSensor(BuildContext context) => ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const SizedBox(height: 24),
          Icon(Icons.sensors_off,
              size: 56, color: GwColors.inkSoftOf(context)),
          const SizedBox(height: 12),
          Text(
            tr(context, "This phone has no light sensor",
                "ဤဖုန်းတွင် အလင်းရောင် sensor မပါပါ"),
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          Text(
            tr(
                context,
                "Measuring needs the ambient-light sensor next to the earpiece. The light guide below still works — it explains what your plants need and how to read the symptoms.",
                "တိုင်းတာဖို့ နားကပ်ဘေးက အလင်းရောင် sensor လိုပါတယ်။ အောက်က လမ်းညွှန်ကတော့ ဆက်ဖတ်လို့ရပါတယ် — အပင်တွေ ဘာလိုအပ်လဲ၊ လက္ခဏာတွေကို ဘယ်လိုဖတ်ရမလဲ ရှင်းပြထားပါတယ်။"),
            textAlign: TextAlign.center,
            style: TextStyle(color: GwColors.inkSoftOf(context)),
          ),
          const SizedBox(height: 20),
          FilledButton.icon(
            onPressed: () => setState(() {
              _referenceOnly = true;
              _page = _Page.explain;
            }),
            icon: const Icon(Icons.menu_book_outlined),
            label: Text(tr(context, "Open the light guide", "လမ်းညွှန် ဖွင့်ရန်")),
          ),
        ],
      );

  Widget _measurePage(BuildContext context) {
    final ppfd = _ppfd;
    final verdict = ppfd == null ? null : evaluate(ppfd, _stage);
    final dliNow = _dliNow;

    return ListView(
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 28),
      children: [
        _card(
          context,
          Column(
            children: [
              if (ppfd == null) ...[
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  child: Text(
                    tr(context, "Choose a light source to see PPFD",
                        "PPFD ကြည့်ရန် အလင်းအမျိုးအစား ရွေးပါ"),
                    textAlign: TextAlign.center,
                    style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: GwColors.inkSoftOf(context)),
                  ),
                ),
              ] else ...[
                Text(ppfd.round().toString(),
                    style: const TextStyle(
                        fontSize: 56,
                        fontWeight: FontWeight.w800,
                        height: 1.05)),
                Text("µmol/m²/s (PPFD)",
                    style: TextStyle(color: GwColors.inkSoftOf(context))),
              ],
              const SizedBox(height: 6),
              Text("${_lux.round()} lux",
                  style: TextStyle(
                      fontSize: 13, color: GwColors.inkSoftOf(context))),
              if (_calibration != 1)
                Text(
                    tr(context, "calibrated ×${_calibration.toStringAsFixed(2)}",
                        "ချိန်ညှိ ×${_calibration.toStringAsFixed(2)}"),
                    style: TextStyle(
                        fontSize: 11, color: GwColors.inkSoftOf(context))),
              if (ppfd != null) ...[
                const SizedBox(height: 14),
                _gauge(context, ppfd, _stage),
                const SizedBox(height: 10),
                _verdictLine(context, verdict!),
              ],
            ],
          ),
        ),
        if (!_smoother.warm)
          _note(
              context,
              Icons.hourglass_empty,
              tr(context, "Hold still — the reading is still settling.",
                  "ခဏစောင့်ပါ — တန်ဖိုး တည်ငြိမ်နေဆဲပါ။"),
              GwColors.inkSoftOf(context)),
        if (_saturation.saturated)
          _note(
              context,
              Icons.warning_amber_rounded,
              tr(
                  context,
                  "The sensor looks maxed out at ${_saturation.pinnedAt.round()} lux — the real light is higher. Most phones stop around 10,000 lux.",
                  "Sensor က ${_saturation.pinnedAt.round()} lux မှာ ပြည့်နေပုံရတယ် — အမှန်တကယ် ပိုများပါတယ်။ ဖုန်းအများစုက ~၁၀,၀၀၀ lux မှာ ရပ်တတ်ပါတယ်။"),
              const Color(0xFFE07A1F)),
        if (_source?.lowConfidence == true)
          _note(
              context,
              Icons.error_outline,
              tr(
                  context,
                  "Purple LEDs emit almost no green, which is what a lux sensor measures best. Expect a large error here.",
                  "ခရမ်းရောင် LED မှာ အစိမ်းရောင် အလွန်နည်းပြီး lux sensor က အစိမ်းကို အများဆုံးဖတ်တာမို့ ဤအလင်းအမျိုးအစားတွင် အမှားများနိုင်ပါသည်။"),
              const Color(0xFFE07A1F)),
        const SizedBox(height: 10),
        _card(
          context,
          Column(
            children: [
              _dropdown<LightSource?>(
                context,
                tr(context, "Light source", "အလင်းအမျိုးအစား"),
                _source,
                [
                  DropdownMenuItem(
                      value: null,
                      child: Text(tr(context, "— choose —", "— ရွေးပါ —"))),
                  ...LightSource.values.map((s) => DropdownMenuItem(
                      value: s,
                      child: Text(tr(context, s.labelEn, s.labelMy)))),
                ],
                (v) {
                  setState(() => _source = v);
                  _persist();
                },
              ),
              _dropdown<String>(
                context,
                tr(context, "Crop", "သီးနှံ"),
                _cropId,
                cropProfiles
                    .map((c) => DropdownMenuItem(
                        value: c.id,
                        child: Text(tr(context, c.nameEn, c.nameMy))))
                    .toList(),
                (v) {
                  setState(() {
                    _cropId = v ?? "hemp";
                    _stageIndex = 0;
                    _hours = _stage.photoperiod;
                  });
                  _persist();
                },
              ),
              _dropdown<int>(
                context,
                tr(context, "Stage", "အဆင့်"),
                _stageIndex.clamp(0, _crop.stages.length - 1),
                [
                  for (var i = 0; i < _crop.stages.length; i++)
                    DropdownMenuItem(
                        value: i,
                        child: Text(tr(context, _crop.stages[i].stageEn,
                            _crop.stages[i].stageMy))),
                ],
                (v) {
                  setState(() {
                    _stageIndex = v ?? 0;
                    _hours = _stage.photoperiod;
                  });
                  _persist();
                },
              ),
              _dropdown<int>(
                context,
                tr(context, "Hours of light", "မီးဖွင့်ချိန်"),
                _hours,
                [
                  for (final h in const [8, 10, 12, 14, 16, 18, 20, 24])
                    DropdownMenuItem(
                        value: h,
                        child: Text(tr(context, "$h hours", "$h နာရီ"))),
                ],
                (v) => setState(() => _hours = v ?? 12),
              ),
            ],
          ),
        ),
        if (dliNow != null) ...[
          const SizedBox(height: 10),
          _card(
            context,
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.wb_sunny_outlined, size: 18),
                    const SizedBox(width: 8),
                    Text(tr(context, "Daily light (DLI)", "တစ်နေ့တာ အလင်း (DLI)"),
                        style: const TextStyle(fontWeight: FontWeight.w700)),
                    const Spacer(),
                    Text(dliNow.toStringAsFixed(1),
                        style: const TextStyle(
                            fontSize: 18, fontWeight: FontWeight.w800)),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  tr(
                      context,
                      "Target ${_stage.dliMin.toStringAsFixed(0)}–${_stage.dliMax.toStringAsFixed(0)} mol/m²/day · ${_verdictWord(context, evaluateDli(dliNow, _stage))}",
                      "ရည်မှန်း ${_stage.dliMin.toStringAsFixed(0)}–${_stage.dliMax.toStringAsFixed(0)} mol/m²/day · ${_verdictWord(context, evaluateDli(dliNow, _stage))}"),
                  style: TextStyle(
                      fontSize: 12, color: GwColors.inkSoftOf(context)),
                ),
                const SizedBox(height: 4),
                Text(
                  tr(
                      context,
                      "Assumes this PPFD holds for $_hours hours. Under sunlight it will not — log samples through the day instead.",
                      "ဤ PPFD ကို $_hours နာရီ ဆက်ရတယ်လို့ ယူဆထားပါတယ်။ နေရောင်အောက်မှာ အဲဒါ မမှန်ပါ — တစ်နေ့တာ အကြိမ်ကြိမ် မှတ်တမ်းတင်ပါ။"),
                  style: TextStyle(
                      fontSize: 11, color: GwColors.inkSoftOf(context)),
                ),
              ],
            ),
          ),
        ],
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: FilledButton.icon(
                onPressed: _ppfd == null ? null : _saveSample,
                icon: const Icon(Icons.bookmark_add_outlined),
                label: Text(tr(context, "Log reading", "မှတ်တမ်းသိမ်း")),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: OutlinedButton.icon(
                onPressed: () => setState(() => _page = _Page.explain),
                icon: const Icon(Icons.info_outline),
                label: Text(tr(context, "Explain", "ရှင်းလင်းချက်")),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        _darknessCard(context),
        const SizedBox(height: 12),
        _estimateDisclaimer(context),
      ],
    );
  }

  /// The disclaimer is a permanent fixture of the measure page, not a
  /// one-time dialog someone dismisses and forgets.
  Widget _estimateDisclaimer(BuildContext context) => Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: GwColors.surfaceMutedOf(context),
          borderRadius: BorderRadius.circular(GwRadius.md),
          border: Border.all(color: GwColors.lineOf(context)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.info_outline, size: 18),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                tr(
                    context,
                    "This is an estimate from a phone sensor, not a laboratory reading. For accurate work use a quantum sensor (for example an Apogee MQ-500). It is good for comparing spots, spotting light that is far too low or too high, and tracking change over time.",
                    "ဤသည်မှာ ဖုန်း sensor မှ ခန့်မှန်းချက်သာဖြစ်ပြီး တိကျသောတိုင်းတာမှု မဟုတ်ပါ။ တိကျမှုလိုအပ်ပါက quantum sensor (Apogee MQ-500 စသည်) သုံးပါ။ နေရာချင်း နှိုင်းယှဉ်ရန်၊ အလွန်နည်း/များနေသည်ကို သိရန်နှင့် ပြောင်းလဲမှု စောင့်ကြည့်ရန် အသုံးဝင်ပါသည်။"),
                style:
                    TextStyle(fontSize: 11.5, color: GwColors.inkSoftOf(context)),
              ),
            ),
          ],
        ),
      );

  /// Live "is the room actually dark?" check. A few lux from a charger LED is
  /// enough to delay flowering or turn a plant hermaphrodite, and nobody can
  /// judge that by eye after their pupils adjust.
  Widget _darknessCard(BuildContext context) {
    final dark = _rawLux <= darknessLuxLimit;
    return _card(
      context,
      Row(
        children: [
          Icon(dark ? Icons.check_circle_outline : Icons.lightbulb_outline,
              color: dark ? const Color(0xFF2E9E5B) : const Color(0xFFE07A1F)),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(tr(context, "Dark-period check", "အမှောင်ချိန် စစ်ဆေးရန်"),
                    style: const TextStyle(fontWeight: FontWeight.w700)),
                Text(
                  dark
                      ? tr(context, "Dark enough (${_rawLux.toStringAsFixed(1)} lux)",
                          "လုံလောက်စွာ မှောင်ပါသည် (${_rawLux.toStringAsFixed(1)} lux)")
                      : tr(
                          context,
                          "Light is leaking in — ${_rawLux.toStringAsFixed(1)} lux. During flowering this delays bloom and can cause hermaphrodites.",
                          "အလင်း ဝင်နေပါသည် — ${_rawLux.toStringAsFixed(1)} lux။ အပွင့်ကာလတွင် အပွင့်နောက်ကျစေပြီး ထီး/မ ရောနိုင်ပါသည်။"),
                  style: TextStyle(
                      fontSize: 12, color: GwColors.inkSoftOf(context)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _explainPage(BuildContext context) {
    final src = _source;
    return ListView(
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 28),
      children: [
        if (src == null)
          _note(
              context,
              Icons.info_outline,
              tr(
                  context,
                  "Pick a light source on the Measure tab and this page explains that lamp specifically.",
                  "တိုင်းရန် စာမျက်နှာတွင် အလင်းအမျိုးအစား ရွေးပါ — ဤစာမျက်နှာက အဲဒီမီးအကြောင်း အထူးရှင်းပြပါမည်။"),
              GwColors.inkSoftOf(context))
        else
          _lampCard(context, src),
        const SizedBox(height: 10),
        _sectionTitle(context, tr(context, "The spectrum", "အလင်းလှိုင်းအလျား")),
        for (final b in spectrumBands)
          _card(
            context,
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text("${b.range}  ",
                        style: const TextStyle(
                            fontWeight: FontWeight.w800, fontSize: 13)),
                    Expanded(
                      child: Text(tr(context, b.nameEn, b.nameMy),
                          style: const TextStyle(fontWeight: FontWeight.w700)),
                    ),
                    if (!b.measurable)
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: const Color(0x22E07A1F),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          tr(context, "phone can't see", "ဖုန်းက မဖတ်နိုင်"),
                          style: const TextStyle(
                              fontSize: 10, color: Color(0xFFE07A1F)),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(tr(context, b.effectEn, b.effectMy),
                    style: TextStyle(
                        fontSize: 12.5, color: GwColors.inkSoftOf(context))),
              ],
            ),
          ),
        const SizedBox(height: 10),
        _sectionTitle(context, tr(context, "Target mix", "အချိုးအစား")),
        _card(
          context,
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(tr(context, "Vegetative", "ရွက်ထွက်ကာလ"),
                  style: const TextStyle(fontWeight: FontWeight.w700)),
              Text(tr(context, vegMixEn, vegMixMy)),
              const SizedBox(height: 8),
              Text(tr(context, "Flowering", "အပွင့်ကာလ"),
                  style: const TextStyle(fontWeight: FontWeight.w700)),
              Text(tr(context, flowerMixEn, flowerMixMy)),
              const SizedBox(height: 8),
              Text(
                tr(
                    context,
                    "Too little blue → long, floppy stems that fall over. Too little red → small flowers and low yield.",
                    "အပြာနည်းလွန်းရင် ပင်စည်ရှည်ပြီး လဲကျတတ်တယ်။ အနီနည်းလွန်းရင် အပွင့်သေးပြီး အထွက်နည်းတယ်။"),
                style:
                    TextStyle(fontSize: 12, color: GwColors.inkSoftOf(context)),
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        _sectionTitle(
            context, tr(context, "Symptom guide", "လက္ခဏာအလိုက် ရောဂါရှာ")),
        for (final s in symptomRows)
          _card(
            context,
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(tr(context, s.symptomEn, s.symptomMy),
                    style: const TextStyle(fontWeight: FontWeight.w700)),
                const SizedBox(height: 2),
                Text("→ ${tr(context, s.causeEn, s.causeMy)}",
                    style: TextStyle(
                        fontSize: 12.5, color: GwColors.inkSoftOf(context))),
                Text("✓ ${tr(context, s.fixEn, s.fixMy)}",
                    style: const TextStyle(
                        fontSize: 12.5, color: Color(0xFF2E9E5B))),
              ],
            ),
          ),
        const SizedBox(height: 10),
        _sectionTitle(context, tr(context, "How to measure", "ဘယ်လိုတိုင်းရမလဲ")),
        _card(
          context,
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _bullet(context,
                  tr(context, "Lay the phone flat at canopy height, screen up toward the lamp.", "ဖုန်းကို အပင်ရွက်ဖျားအမြင့်တွင် ပြားပြားထားပါ — မျက်နှာပြင် မီးဆီလှည့်ပါ။")),
              _bullet(context,
                  tr(context, "The sensor sits beside the earpiece — a case or your thumb over it ruins the reading.", "Sensor က နားကပ်ဘေးမှာ ရှိတယ် — ဖုန်းအဖုံး ဒါမှမဟုတ် လက်မ ဖုံးထားရင် တန်ဖိုး မှားတယ်။")),
              _bullet(context,
                  tr(context, "Stand to the side so your own shadow does not fall on it.", "ကိုယ့်အရိပ် မကျအောင် ဘေးဘက်ကနေ ရပ်ပါ။")),
              _bullet(context,
                  tr(context, "Wait about five seconds for the number to settle.", "တန်ဖိုးတည်ငြိမ်ဖို့ ၅ စက္ကန့်ခန့် စောင့်ပါ။")),
              _bullet(context,
                  tr(context, "Measure the middle and all four corners — the corners are usually much darker.", "အလယ်တစ်နေရာနဲ့ ထောင့် ၄ ခုလုံး တိုင်းပါ — ထောင့်တွေက များသောအားဖြင့် အလင်းနည်းတယ်။")),
              _bullet(context,
                  tr(context, "Measure 30 minutes after switching a lamp on; for sunlight, between 11am and 1pm.", "မီးဖွင့်ပြီး ၃၀ မိနစ်ကြာမှ တိုင်းပါ။ နေရောင်ဆိုရင် နေ့လယ် ၁၁ နာရီ–၁ နာရီကြား။")),
            ],
          ),
        ),
        const SizedBox(height: 10),
        _sectionTitle(context, tr(context, "Lux vs PPFD", "Lux နှင့် PPFD")),
        _card(
          context,
          Text(
            tr(
                context,
                "Lux measures how bright light looks to a human eye, which is most sensitive to green. PPFD counts the photons a plant can actually use, and plants use red and blue most. That is why a lamp can look bright and still grow poor plants — and why this app makes you pick the lamp type before it will show a PPFD.",
                "Lux က လူ့မျက်လုံးအတွက် ဘယ်လောက်တောက်ပလဲ တိုင်းတာတာပါ — လူက အစိမ်းရောင်ကို အထိခိုက်ဆုံးမြင်တယ်။ PPFD ကတော့ အပင်တကယ်သုံးလို့ရတဲ့ photon အရေအတွက်ကို ရေတွက်တာပါ — အပင်က အနီနဲ့ အပြာကို အများဆုံးသုံးတယ်။ ဒါကြောင့် မီးက တောက်ပနေပေမယ့် အပင်မကောင်းတာ ဖြစ်နိုင်တာပါ — ပြီးတော့ ဒီ app က အလင်းအမျိုးအစား မရွေးဘဲ PPFD မပြတာလည်း ဒါကြောင့်ပါ။"),
            style: TextStyle(fontSize: 12.5, color: GwColors.inkSoftOf(context)),
          ),
        ),
        const SizedBox(height: 10),
        _card(
          context,
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(tr(context, "Why DLI matters more than PPFD",
                  "DLI က PPFD ထက် ဘာကြောင့် ပိုအရေးကြီးလဲ"),
                  style: const TextStyle(fontWeight: FontWeight.w700)),
              const SizedBox(height: 4),
              Text(
                tr(
                    context,
                    "PPFD is a snapshot; DLI is the whole day. Less light for longer can add up to the same total:",
                    "PPFD က အခိုက်အတန့်၊ DLI က တစ်နေ့တာ စုစုပေါင်းပါ။ အလင်းနည်းပေမယ့် ကြာကြာပေးရင် စုစုပေါင်း တူနိုင်တယ် —"),
                style: TextStyle(
                    fontSize: 12.5, color: GwColors.inkSoftOf(context)),
              ),
              const SizedBox(height: 6),
              const Text("PPFD 400 × 18h  =  DLI 25.9",
                  style: TextStyle(fontFamily: "monospace")),
              const Text("PPFD 600 × 12h  =  DLI 25.9",
                  style: TextStyle(fontFamily: "monospace")),
            ],
          ),
        ),
        const SizedBox(height: 10),
        _card(
          context,
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                const Icon(Icons.warning_amber_rounded,
                    color: Color(0xFFE07A1F), size: 18),
                const SizedBox(width: 6),
                Text(tr(context, "Safety", "လုံခြုံရေး"),
                    style: const TextStyle(fontWeight: FontWeight.w800)),
              ]),
              const SizedBox(height: 4),
              _bullet(context,
                  tr(context, "If you run UV-B lamps: wear eye protection, cover your skin, and stay out of the room while they are on.", "UV-B မီးသုံးရင် — မျက်လုံးကာမျက်မှန် တပ်ပါ၊ အသားရေ ဖုံးအုပ်ပါ၊ မီးဖွင့်ထားချိန် အခန်းထဲ မဝင်ပါနဲ့။")),
              _bullet(context,
                  tr(context, "Never look straight into a high-power grow lamp.", "မီးအားပြင်းများကို တိုက်ရိုက် မကြည့်ပါနဲ့။")),
              _bullet(context,
                  tr(context, "Keep water away from lamp cables and ballasts.", "မီးကြိုးများ ရေမထိစေပါနဲ့။")),
              _bullet(context,
                  tr(context, "This app cannot measure UV at all — a zero here does not mean the room is safe.", "ဤ app က UV ကို လုံးဝ မတိုင်းနိုင်ပါ — သုညပြနေတာက အခန်းဘေးကင်းတယ်လို့ မဆိုလိုပါ။")),
            ],
          ),
        ),
      ],
    );
  }

  Widget _lampCard(BuildContext context, LightSource src) {
    final mix = src.spectrumMix;
    return _card(
      context,
      Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(tr(context, src.labelEn, src.labelMy),
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
          if (src.noteEn.isNotEmpty)
            Text(tr(context, src.noteEn, src.noteMy),
                style: TextStyle(color: GwColors.inkSoftOf(context))),
          const SizedBox(height: 10),
          Text(
            tr(
                context,
                "Roughly: blue ${mix.$1}% · green ${mix.$2}% · red ${mix.$3}%",
                "ခန့်မှန်း — အပြာ ${mix.$1}% · အစိမ်း ${mix.$2}% · အနီ ${mix.$3}%"),
            style: const TextStyle(fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 6),
          _mixBar(mix.$1, mix.$2, mix.$3),
          const SizedBox(height: 10),
          Text(_lampAdvice(context, src),
              style: TextStyle(color: GwColors.inkSoftOf(context))),
        ],
      ),
    );
  }

  String _lampAdvice(BuildContext context, LightSource src) => switch (src) {
        LightSource.hps => tr(
            context,
            "HPS is strong in red, which is why it flowers well — but it is very short on blue, so plants under it stretch. Adding a white LED alongside shortens the internodes.",
            "HPS က အနီရောင် အားကောင်းလို့ အပွင့်ကောင်းတယ် — ဒါပေမယ့် အပြာအလွန်နည်းလို့ ပင်စည်ရှည်တတ်တယ်။ LED အဖြူ တွဲထည့်ရင် ပင်စည်တိုစေပါတယ်။"),
        LightSource.ledBlurple => tr(
            context,
            "Purple LEDs skip green almost entirely. Plants do fine, but you cannot judge them by eye and a lux sensor under-reads badly — treat the number as a rough guide only.",
            "ခရမ်းရောင် LED က အစိမ်းရောင်ကို လုံးဝနီးပါး ချန်ထားတယ်။ အပင်ကတော့ ကောင်းပါတယ်၊ ဒါပေမယ့် မျက်လုံးနဲ့ အကဲဖြတ်လို့ မရသလို lux sensor ကလည်း အလွန်နည်းအောင် ဖတ်တယ် — တန်ဖိုးကို ကြမ်းကြမ်းတမ်းတမ်းသာ ယူပါ။"),
        LightSource.ledGrow => tr(
            context,
            "Full-spectrum grow LEDs are the easiest case: the mix is close to what plants want, and lux tracks PPFD reasonably well.",
            "Full-spectrum စိုက်ပျိုးရေး LED က အလွယ်ဆုံးပါ — အချိုးက အပင်လိုချင်တာနဲ့ နီးပြီး lux နဲ့ PPFD က တော်တော်ကိုက်တယ်။"),
        LightSource.sunlight || LightSource.sunlightCloudy => tr(
            context,
            "Sunlight has everything, including the UV and far-red this app cannot see. The catch is that most phone sensors max out well below full noon sun.",
            "နေရောင်မှာ အားလုံးပါတယ် — ဒီ app မမြင်နိုင်တဲ့ UV နဲ့ far-red အပါအဝင်။ ပြဿနာက ဖုန်း sensor အများစုက မွန်းတည့်နေရောင်ရဲ့ အောက်မှာတင် ပြည့်သွားတာပါ။"),
        LightSource.fluorescent => tr(
            context,
            "T5 fluorescents are gentle and even — good for seedlings and clones, too weak for flower.",
            "T5 က နူးညံ့ပြီး ညီညာတယ် — ပျိုးပင်နဲ့ ကလုန်းအတွက် ကောင်းပေမယ့် အပွင့်အတွက် အားနည်းတယ်။"),
        LightSource.metalHalide => tr(
            context,
            "Metal halide is blue-heavy, which suits vegetative growth and keeps plants compact.",
            "Metal halide က အပြာများလို့ ရွက်ထွက်ကာလနဲ့ ကိုက်ပြီး အပင်ကို တိုတောင်းစေတယ်။"),
        LightSource.ledCool || LightSource.ledWarm => tr(
            context,
            "An ordinary household LED works for herbs and seedlings, but rarely reaches the intensity flowering needs.",
            "ပုံမှန်အိမ်သုံး LED က ပင်စိမ်းနဲ့ ပျိုးပင်အတွက် ရပေမယ့် အပွင့်လိုအပ်တဲ့ အားကို ရှားရှားပါးပါးမှ မီပါတယ်။"),
      };

  Widget _gridPage(BuildContext context) {
    final cells = <GridCell>[
      for (final e in _grid.entries)
        GridCell(int.parse(e.key.split(",")[0]), int.parse(e.key.split(",")[1]),
            e.value),
    ];
    final stats = gridStats(cells);
    final ppfd = _ppfd;

    return ListView(
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 28),
      children: [
        _card(
          context,
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(tr(context, "Canopy light map", "စိုက်ခင်း အလင်းမြေပုံ"),
                  style: const TextStyle(
                      fontSize: 16, fontWeight: FontWeight.w800)),
              const SizedBox(height: 4),
              Text(
                tr(
                    context,
                    "Most people measure one spot in the middle and never find out the edges are half as bright. Walk the grid, tap each cell where you stand, and the spread appears below.",
                    "လူအများစုက အလယ်တစ်နေရာပဲ တိုင်းပြီး ဘေးပတ်လည် အလင်း တစ်ဝက်နည်းနေမှန်း မသိကြဘူး။ တစ်ကွက်ချင်း သွားရပ်ပြီး နှိပ်ပါ — ကွာဟမှုကို အောက်မှာ ပြပါမယ်။"),
                style: TextStyle(
                    fontSize: 12, color: GwColors.inkSoftOf(context)),
              ),
              const SizedBox(height: 10),
              if (ppfd == null)
                Text(
                  tr(context, "Choose a light source first.",
                      "အလင်းအမျိုးအစား အရင်ရွေးပါ။"),
                  style: const TextStyle(color: Color(0xFFE07A1F)),
                ),
              const SizedBox(height: 6),
              Row(
                children: [
                  Text(tr(context, "Grid", "ဇယားကွက်")),
                  const SizedBox(width: 10),
                  DropdownButton<int>(
                    value: _gridRows,
                    items: [
                      for (final n in const [2, 3, 4, 5])
                        DropdownMenuItem(value: n, child: Text("$n"))
                    ],
                    onChanged: (v) => setState(() => _gridRows = v ?? 4),
                  ),
                  const Text(" × "),
                  DropdownButton<int>(
                    value: _gridCols,
                    items: [
                      for (final n in const [2, 3, 4, 5])
                        DropdownMenuItem(value: n, child: Text("$n"))
                    ],
                    onChanged: (v) => setState(() => _gridCols = v ?? 4),
                  ),
                  const Spacer(),
                  TextButton.icon(
                    onPressed: _grid.isEmpty
                        ? null
                        : () => setState(() => _grid.clear()),
                    icon: const Icon(Icons.clear_all, size: 18),
                    label: Text(tr(context, "Clear", "ရှင်း")),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        for (var r = 0; r < _gridRows; r++)
          Row(
            children: [
              for (var c = 0; c < _gridCols; c++)
                Expanded(child: _gridTile(context, r, c, ppfd)),
            ],
          ),
        const SizedBox(height: 12),
        if (_grid.isNotEmpty)
          _card(
            context,
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  tr(
                      context,
                      "Average ${stats.average.round()} · lowest ${stats.min.round()} · highest ${stats.max.round()}",
                      "ပျမ်းမျှ ${stats.average.round()} · အနည်းဆုံး ${stats.min.round()} · အများဆုံး ${stats.max.round()}"),
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 4),
                Text(
                  tr(
                      context,
                      "Spread ${stats.spreadPct.round()}% below average at the darkest cell.",
                      "အမှောင်ဆုံးကွက်က ပျမ်းမျှထက် ${stats.spreadPct.round()}% နည်းသည်။"),
                  style: TextStyle(color: GwColors.inkSoftOf(context)),
                ),
                if (stats.spreadPct >= 30) ...[
                  const SizedBox(height: 6),
                  Text(
                    tr(
                        context,
                        "That is a big gap. Raise the lamp to spread the light wider, or add reflective walls — plants in the dark cells will finish behind the rest.",
                        "ဒါက ကွာဟမှု ကြီးပါတယ်။ အလင်းပိုပြန့်အောင် မီးကို အမြင့်တိုးပါ ဒါမှမဟုတ် ဘေးမှန် ထည့်ပါ — အမှောင်ကွက်က အပင်တွေ နောက်ကျကျန်ခဲ့ပါလိမ့်မယ်။"),
                    style: const TextStyle(color: Color(0xFFE07A1F)),
                  ),
                ],
              ],
            ),
          ),
      ],
    );
  }

  Widget _gridTile(BuildContext context, int r, int c, double? ppfd) {
    final key = "$r,$c";
    final v = _grid[key];
    final verdict = v == null ? null : evaluate(v, _stage);
    return InkWell(
      onTap: ppfd == null
          ? null
          : () => setState(() => _grid[key] = ppfd),
      onLongPress: () => setState(() => _grid.remove(key)),
      child: Container(
        height: 56,
        margin: const EdgeInsets.all(2),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: verdict == null
              ? GwColors.surfaceMutedOf(context)
              : _verdictColor(verdict).withValues(alpha: 0.22),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
              color: verdict == null
                  ? GwColors.lineOf(context)
                  : _verdictColor(verdict).withValues(alpha: 0.5)),
        ),
        child: Text(
          v == null ? "—" : v.round().toString(),
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
    );
  }

  Widget _historyPage(BuildContext context) {
    if (_log.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            tr(context, "No readings logged yet.",
                "မှတ်တမ်းတင်ထားတာ မရှိသေးပါ။"),
            textAlign: TextAlign.center,
            style: TextStyle(color: GwColors.inkSoftOf(context)),
          ),
        ),
      );
    }
    final sorted = [..._log]..sort((a, b) => b.timeMs.compareTo(a.timeMs));
    return ListView(
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 28),
      children: [
        Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: _exportCsv,
                icon: const Icon(Icons.ios_share),
                label: Text(tr(context, "Export CSV", "CSV ထုတ်ရန်")),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: OutlinedButton.icon(
                onPressed: _confirmClearLog,
                icon: const Icon(Icons.delete_outline),
                label: Text(tr(context, "Clear", "ရှင်းရန်")),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        for (final s in sorted)
          _card(
            context,
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text("${s.ppfd.round()} µmol/m²/s",
                          style: const TextStyle(fontWeight: FontWeight.w800)),
                      Text(
                        "${_stamp(s.timeMs)} · ${s.lux.round()} lux"
                        "${s.source == null ? "" : " · ${tr(context, s.source!.labelEn, s.source!.labelMy)}"}",
                        style: TextStyle(
                            fontSize: 12, color: GwColors.inkSoftOf(context)),
                      ),
                      if (s.note.isNotEmpty)
                        Text(s.note,
                            style: TextStyle(
                                fontSize: 12,
                                color: GwColors.inkSoftOf(context))),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close, size: 18),
                  onPressed: () {
                    setState(() => _log.remove(s));
                    _persist();
                  },
                ),
              ],
            ),
          ),
      ],
    );
  }

  Widget _calibratePage(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 28),
      children: [
        _card(
          context,
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(tr(context, "Calibration", "ချိန်ညှိခြင်း"),
                  style: const TextStyle(
                      fontSize: 16, fontWeight: FontWeight.w800)),
              const SizedBox(height: 4),
              Text(
                tr(
                    context,
                    "Every phone's sensor reads a little differently. If you can borrow a proper meter once, enter its reading here and everything after that gets closer to the truth.",
                    "ဖုန်းတိုင်း sensor မတူညီပါ။ တိကျတဲ့ meter တစ်ခု တစ်ခါငှားရမ်းနိုင်ရင် အဲဒီတန်ဖိုးကို ဒီမှာ ထည့်ပါ — နောက်ပိုင်း တန်ဖိုးတွေ ပိုမှန်လာပါမယ်။"),
                style:
                    TextStyle(fontSize: 12.5, color: GwColors.inkSoftOf(context)),
              ),
              const SizedBox(height: 12),
              Text(
                  tr(context, "Phone reads now: ${_smoother.value.round()} lux",
                      "ဖုန်းဖတ်တန်ဖိုး: ${_smoother.value.round()} lux"),
                  style: const TextStyle(fontWeight: FontWeight.w700)),
              const SizedBox(height: 8),
              TextField(
                controller: _refCtrl,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  labelText: tr(context, "Reference meter (lux)",
                      "တိကျသော meter (lux)"),
                  border: const OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: FilledButton(
                      onPressed: () {
                        final ref = double.tryParse(_refCtrl.text.trim()) ?? 0;
                        final f = calibrationFactor(ref, _smoother.value);
                        setState(() => _calibration = f);
                        _persist();
                        if (!mounted) return;
                        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                          content: Text(f == 1
                              ? tr(
                                  context,
                                  "That value looks off — calibration left unchanged.",
                                  "အဲဒီတန်ဖိုး မမှန်ပုံရလို့ ချိန်ညှိမှု မပြောင်းလိုက်ပါ။")
                              : tr(context, "Calibration set to ×${f.toStringAsFixed(2)}",
                                  "ချိန်ညှိကိန်း ×${f.toStringAsFixed(2)} အဖြစ် သိမ်းပြီး")),
                        ));
                      },
                      child: Text(tr(context, "Save", "သိမ်းမည်")),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () {
                        setState(() => _calibration = 1);
                        _persist();
                      },
                      child: Text(tr(context, "Reset", "မူလအတိုင်း")),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Text(
                tr(
                    context,
                    "Current factor ×${_calibration.toStringAsFixed(2)}. Values outside 0.2–5 are rejected as typos — a bad factor would quietly poison every later reading.",
                    "လက်ရှိ ချိန်ညှိကိန်း ×${_calibration.toStringAsFixed(2)}။ ၀.၂–၅ အပြင်ဘက် တန်ဖိုးတွေကို လက်မခံပါ — မှားနေတဲ့ ကိန်းက နောက်ပိုင်း တန်ဖိုးအားလုံးကို တိတ်တိတ်ပဲ ပျက်စေတယ်။"),
                style:
                    TextStyle(fontSize: 11.5, color: GwColors.inkSoftOf(context)),
              ),
              const SizedBox(height: 10),
              Text(
                tr(
                    context,
                    "No meter? On a cloudless day at noon, direct sun should read somewhere near 100,000 lux. If your phone shows far less and stops changing, it has hit its ceiling — calibrating against that will not help.",
                    "Meter မရှိရင် — မိုးကင်းစင်တဲ့နေ့ မွန်းတည့်ချိန် နေရောင်တိုက်ရိုက်အောက်မှာ ~၁၀၀,၀၀၀ lux ဝန်းကျင် ဖြစ်သင့်ပါတယ်။ ဖုန်းက အဲဒီထက် အများကြီးနည်းပြီး မပြောင်းတော့ရင် ceiling ရောက်နေတာပါ — အဲဒါနဲ့ ချိန်ညှိလို့ မရပါဘူး။"),
                style:
                    TextStyle(fontSize: 11.5, color: GwColors.inkSoftOf(context)),
              ),
            ],
          ),
        ),
      ],
    );
  }

  // ── actions ───────────────────────────────────────────────────────────
  Future<void> _saveSample() async {
    final ppfd = _ppfd;
    if (ppfd == null) return;
    final noteCtrl = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: Text(tr(c, "Log this reading", "မှတ်တမ်းသိမ်းမည်")),
        content: TextField(
          controller: noteCtrl,
          decoration: InputDecoration(
            labelText: tr(c, "Where? (optional)", "ဘယ်နေရာလဲ (ရွေးချယ်)"),
            hintText: tr(c, "Tent A, centre", "တဲ A, အလယ်"),
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(c, false),
              child: Text(tr(c, "Cancel", "မလုပ်တော့"))),
          FilledButton(
              onPressed: () => Navigator.pop(c, true),
              child: Text(tr(c, "Save", "သိမ်းမည်"))),
        ],
      ),
    );
    if (ok != true) return;
    setState(() {
      _log.add(LightSample(
        timeMs: DateTime.now().millisecondsSinceEpoch,
        lux: _lux,
        ppfd: ppfd,
        note: noteCtrl.text.trim(),
        source: _source,
        crop: _cropId,
        stageIndex: _stageIndex,
      ));
    });
    await _persist();
  }

  Future<void> _confirmClearLog() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: Text(tr(c, "Clear all readings?", "မှတ်တမ်းအားလုံး ဖျက်မလား")),
        content: Text(tr(c, "This cannot be undone.",
            "ပြန်ရနိုင်မည် မဟုတ်ပါ။")),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(c, false),
              child: Text(tr(c, "Cancel", "မလုပ်တော့"))),
          FilledButton(
              onPressed: () => Navigator.pop(c, true),
              child: Text(tr(c, "Clear", "ဖျက်မည်"))),
        ],
      ),
    );
    if (ok != true) return;
    setState(_log.clear);
    await _persist();
  }

  Future<void> _exportCsv() async {
    final buf = StringBuffer("time,lux,ppfd,source,crop,stage,note\n");
    for (final s in _log) {
      final t = DateTime.fromMillisecondsSinceEpoch(s.timeMs).toIso8601String();
      final note = s.note.replaceAll('"', "'");
      buf.writeln('$t,${s.lux.toStringAsFixed(1)},${s.ppfd.toStringAsFixed(1)},'
          '${s.source?.name ?? ""},${s.crop ?? ""},${s.stageIndex ?? ""},"$note"');
    }
    try {
      final dir = await getTemporaryDirectory();
      final f = File("${dir.path}/gwave-light-log.csv");
      await f.writeAsString(buf.toString());
      await Share.shareXFiles([XFile(f.path)], text: "Gwave light meter log");
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(tr(context, "Could not export the file.",
            "ဖိုင် ထုတ်၍ မရပါ။")),
      ));
    }
  }

  // ── small pieces ──────────────────────────────────────────────────────
  Widget _gauge(BuildContext context, double ppfd, GrowthStageTarget t) {
    // Scale runs to 1.5× the stage maximum so "too high" still has somewhere
    // to sit rather than pinning at the end.
    final span = t.ppfdMax * 1.5;
    final pos = (ppfd / span).clamp(0.0, 1.0);
    final lo = (t.ppfdMin / span).clamp(0.0, 1.0);
    final hi = (t.ppfdMax / span).clamp(0.0, 1.0);
    return LayoutBuilder(builder: (context, box) {
      final w = box.maxWidth;
      return SizedBox(
        height: 34,
        child: Stack(
          children: [
            Positioned(
              top: 12,
              left: 0,
              right: 0,
              child: Container(
                height: 8,
                decoration: BoxDecoration(
                  color: GwColors.surfaceMutedOf(context),
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
            ),
            Positioned(
              top: 12,
              left: w * lo,
              width: w * (hi - lo),
              child: Container(
                height: 8,
                decoration: BoxDecoration(
                  color: const Color(0xFF2E9E5B).withValues(alpha: 0.55),
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
            ),
            Positioned(
              top: 6,
              left: (w * pos - 8).clamp(0.0, w - 16),
              child: Container(
                width: 16,
                height: 20,
                decoration: BoxDecoration(
                  color: GwColors.inkOf(context),
                  borderRadius: BorderRadius.circular(5),
                ),
              ),
            ),
          ],
        ),
      );
    });
  }

  Widget _verdictLine(BuildContext context, Verdict v) {
    final color = _verdictColor(v);
    final stageName = tr(context, _stage.stageEn, _stage.stageMy);
    final text = switch (v) {
      Verdict.tooLow => tr(context, "Far too dark for $stageName",
          "$stageName အတွက် အလွန်မှောင်နေသည်"),
      Verdict.low => tr(context, "A little low for $stageName",
          "$stageName အတွက် အနည်းငယ်နည်းသည်"),
      Verdict.optimal => tr(context, "Good for $stageName",
          "$stageName အတွက် သင့်တော်သည်"),
      Verdict.high => tr(context, "A little strong for $stageName",
          "$stageName အတွက် အနည်းငယ်များသည်"),
      Verdict.tooHigh => tr(context, "Too strong — risk of bleaching",
          "အလွန်များနေသည် — ရွက်ဖြူသွားနိုင်သည်"),
    };
    final icon = switch (v) {
      Verdict.optimal => Icons.check_circle,
      Verdict.tooLow || Verdict.tooHigh => Icons.error_outline,
      _ => Icons.info_outline,
    };
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(icon, color: color, size: 18),
        const SizedBox(width: 6),
        Flexible(
          child: Text(text,
              style: TextStyle(color: color, fontWeight: FontWeight.w700)),
        ),
      ],
    );
  }

  String _verdictWord(BuildContext context, Verdict v) => switch (v) {
        Verdict.tooLow => tr(context, "far too low", "အလွန်နည်း"),
        Verdict.low => tr(context, "a little low", "အနည်းငယ်နည်း"),
        Verdict.optimal => tr(context, "on target", "သင့်တော်"),
        Verdict.high => tr(context, "a little high", "အနည်းငယ်များ"),
        Verdict.tooHigh => tr(context, "far too high", "အလွန်များ"),
      };

  Color _verdictColor(Verdict v) => switch (v) {
        Verdict.optimal => const Color(0xFF2E9E5B),
        Verdict.low || Verdict.high => const Color(0xFFE0A81F),
        Verdict.tooLow || Verdict.tooHigh => const Color(0xFFD84343),
      };

  Widget _mixBar(int blue, int green, int red) => ClipRRect(
        borderRadius: BorderRadius.circular(4),
        child: SizedBox(
          height: 10,
          child: Row(
            children: [
              Expanded(flex: blue, child: Container(color: const Color(0xFF3F88C5))),
              Expanded(flex: green, child: Container(color: const Color(0xFF44BB6A))),
              Expanded(flex: red, child: Container(color: const Color(0xFFD84343))),
            ],
          ),
        ),
      );

  Widget _dropdown<T>(BuildContext context, String label, T value,
          List<DropdownMenuItem<T>> items, ValueChanged<T?> onChanged) =>
      Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          children: [
            SizedBox(
                width: 116,
                child: Text(label,
                    style: TextStyle(color: GwColors.inkSoftOf(context)))),
            Expanded(
              child: DropdownButton<T>(
                value: value,
                isExpanded: true,
                items: items,
                onChanged: onChanged,
              ),
            ),
          ],
        ),
      );

  Widget _card(BuildContext context, Widget child) => Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: _night ? const Color(0xFF140000) : GwColors.surfaceOf(context),
          borderRadius: BorderRadius.circular(GwRadius.lg),
          border: Border.all(
              color: _night
                  ? const Color(0xFF3A0000)
                  : GwColors.lineOf(context)),
        ),
        child: child,
      );

  Widget _note(BuildContext context, IconData icon, String text, Color color) =>
      Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, size: 16, color: color),
            const SizedBox(width: 6),
            Expanded(
              child: Text(text,
                  style: TextStyle(fontSize: 12, color: color)),
            ),
          ],
        ),
      );

  Widget _sectionTitle(BuildContext context, String text) => Padding(
        padding: const EdgeInsets.fromLTRB(2, 6, 2, 6),
        child: Text(text,
            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
      );

  Widget _bullet(BuildContext context, String text) => Padding(
        padding: const EdgeInsets.only(bottom: 4),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text("· "),
            Expanded(
                child: Text(text,
                    style: TextStyle(
                        fontSize: 12.5, color: GwColors.inkSoftOf(context)))),
          ],
        ),
      );

  String _stamp(int ms) {
    final d = DateTime.fromMillisecondsSinceEpoch(ms);
    String two(int v) => v.toString().padLeft(2, "0");
    return "${d.year}-${two(d.month)}-${two(d.day)} ${two(d.hour)}:${two(d.minute)}";
  }
}
