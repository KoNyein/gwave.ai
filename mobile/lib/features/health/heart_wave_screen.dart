import 'dart:async';
import 'dart:math' as math;
import 'dart:ui' show FontFeature;

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:provider/provider.dart';

import '../../core/app_state.dart';
import '../../core/i18n.dart';
import '../../core/theme.dart';
import 'health_store.dart';

/// Heart-rate "health wave" using photoplethysmography (PPG): the user covers
/// the rear camera + torch with a fingertip, and the tiny brightness changes as
/// blood pulses through the finger are read from the camera frames, drawn as a
/// live heart-rhythm trace and converted to BPM.
///
/// NOTE: this is a PPG pulse wave, not a medical-grade ECG — it estimates heart
/// rate and rhythm for wellness, and should not be used for diagnosis.
class HeartWaveScreen extends StatefulWidget {
  const HeartWaveScreen({super.key});

  @override
  State<HeartWaveScreen> createState() => _HeartWaveScreenState();
}

class _HeartWaveScreenState extends State<HeartWaveScreen> {
  CameraController? _cam;
  bool _ready = false;
  bool _measuring = false;
  bool _fingerDetected = false;
  String? _error;

  final List<double> _wave = []; // detrended samples for the trace
  final List<double> _raw = []; // recent raw brightness (for finger check)
  final List<int> _beatTimes = []; // recent beats (for the running BPM)
  final List<int> _allBeatTimes = []; // every beat this session (for HRV etc.)
  int _bpm = 0;
  // Derived from the same finger pulse — no extra hardware needed.
  int _respiratory = 0; // breaths / min (from pulse rhythm oscillation)
  int _hrvMs = 0; // heart-rate variability (RMSSD, ms)
  int _calmness = 0; // 0..100 calm score from HRV
  DateTime? _startedAt;
  Timer? _ticker;

  static const _measureSeconds = 18;
  int _remaining = _measureSeconds;

  @override
  void initState() {
    super.initState();
    _init();
  }

  @override
  void dispose() {
    _ticker?.cancel();
    _stopStream();
    _cam?.dispose();
    super.dispose();
  }

  Future<void> _init() async {
    try {
      final granted = await Permission.camera.request();
      if (!granted.isGranted) {
        setState(() => _error = tr(context, "Camera permission is needed.",
            "ကင်မရာ ခွင့်ပြုချက် လိုအပ်ပါတယ်။"));
        return;
      }
      final cams = await availableCameras();
      final rear = cams.firstWhere(
        (c) => c.lensDirection == CameraLensDirection.back,
        orElse: () => cams.first,
      );
      final ctrl = CameraController(
        rear,
        ResolutionPreset.low, // small frames → fast sampling
        enableAudio: false,
      );
      await ctrl.initialize();
      _cam = ctrl;
      if (mounted) setState(() => _ready = true);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    }
  }

  Future<void> _start() async {
    final cam = _cam;
    if (cam == null || !_ready || _measuring) return;
    _wave.clear();
    _raw.clear();
    _beatTimes.clear();
    _allBeatTimes.clear();
    _bpm = 0;
    _respiratory = 0;
    _hrvMs = 0;
    _calmness = 0;
    _remaining = _measureSeconds;
    _startedAt = DateTime.now();
    setState(() => _measuring = true);
    try {
      await cam.setFlashMode(FlashMode.torch);
    } catch (_) {}
    try {
      await cam.startImageStream(_onFrame);
    } catch (e) {
      setState(() {
        _measuring = false;
        _error = e.toString();
      });
      return;
    }
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      setState(() => _remaining--);
      if (_remaining <= 0) _finish();
    });
  }

  Future<void> _stopStream() async {
    try {
      if (_cam?.value.isStreamingImages ?? false) {
        await _cam!.stopImageStream();
      }
      await _cam?.setFlashMode(FlashMode.off);
    } catch (_) {}
  }

  Future<void> _finish() async {
    _ticker?.cancel();
    await _stopStream();
    if (!mounted) return;
    _computeMetrics();
    setState(() => _measuring = false);
    if (_bpm >= 40 && _bpm <= 220) {
      _offerSave();
    }
  }

  /// Derive respiratory rate, HRV and a calmness score from the beat timing of
  /// the same finger pulse — no extra sensor. Wellness estimates only.
  void _computeMetrics() {
    // RR intervals (ms) between consecutive beats, kept to physiological range.
    final rr = <double>[];
    for (var i = 1; i < _allBeatTimes.length; i++) {
      final d = (_allBeatTimes[i] - _allBeatTimes[i - 1]).toDouble();
      if (d >= 300 && d <= 1500) rr.add(d);
    }
    if (rr.length < 4) return;

    // HRV — RMSSD: root mean square of successive RR differences.
    var sq = 0.0;
    for (var i = 1; i < rr.length; i++) {
      final d = rr[i] - rr[i - 1];
      sq += d * d;
    }
    final rmssd = math.sqrt(sq / (rr.length - 1));
    _hrvMs = rmssd.round();

    // Calmness 0..100 from RMSSD (higher variability ⇒ calmer / more relaxed).
    _calmness = ((rmssd - 10) / 60 * 100).clamp(0, 100).round();

    // Respiratory rate — the pulse rhythm oscillates with breathing
    // (respiratory sinus arrhythmia). Count oscillations of the detrended RR
    // series over the measured window.
    final mean = rr.reduce((a, b) => a + b) / rr.length;
    var crossings = 0;
    var above = rr.first > mean;
    for (final v in rr) {
      final now = v > mean;
      if (now != above) {
        crossings++;
        above = now;
      }
    }
    final windowMin =
        (_allBeatTimes.last - _allBeatTimes.first) / 1000 / 60;
    if (windowMin > 0.1) {
      // Two zero-crossings ≈ one breath cycle.
      final breaths = crossings / 2 / windowMin;
      _respiratory = breaths.clamp(5, 40).round();
    }
  }

  // Called per camera frame. Averages a sampled subset of the luminance (Y)
  // plane; a covered lens + torch makes the finger glow, and the pulse
  // modulates that brightness.
  DateTime _lastSample = DateTime.fromMillisecondsSinceEpoch(0);
  double _avg = 0;
  void _onFrame(CameraImage image) {
    final bytes = image.planes.first.bytes;
    // Sample every 37th byte — enough signal, negligible cost.
    var sum = 0;
    var count = 0;
    for (var i = 0; i < bytes.length; i += 37) {
      sum += bytes[i];
      count++;
    }
    if (count == 0) return;
    final brightness = sum / count;

    // A fingertip over the torch reads bright (Y typically > 100). If it's
    // dark, the finger isn't placed.
    final finger = brightness > 90;
    if (finger != _fingerDetected && mounted) {
      setState(() => _fingerDetected = finger);
    }
    if (!finger) return;

    // Low-pass smoothing + detrend (subtract a slow moving average) to isolate
    // the pulse oscillation.
    _avg = _avg == 0 ? brightness : _avg * 0.9 + brightness * 0.1;
    final detrended = brightness - _avg;

    _raw.add(brightness);
    if (_raw.length > 60) _raw.removeAt(0);

    _wave.add(detrended);
    if (_wave.length > 160) _wave.removeAt(0);

    _detectBeat(detrended);

    // Repaint at ~30fps max to keep the UI smooth.
    final now = DateTime.now();
    if (now.difference(_lastSample).inMilliseconds >= 33) {
      _lastSample = now;
      if (mounted) setState(() {});
    }
  }

  // Rising zero-crossing beat detector with a refractory period.
  bool _above = false;
  void _detectBeat(double v) {
    const threshold = 0.6; // ignore tiny noise around zero
    final nowMs = DateTime.now().millisecondsSinceEpoch;
    if (v > threshold && !_above) {
      _above = true;
      // Refractory: ignore beats < 300ms apart (>200 bpm).
      if (_beatTimes.isEmpty || nowMs - _beatTimes.last > 300) {
        _beatTimes.add(nowMs);
        if (_beatTimes.length > 12) _beatTimes.removeAt(0);
        _allBeatTimes.add(nowMs); // full session, for HRV / respiratory
        _recompute();
      }
    } else if (v < -threshold && _above) {
      _above = false;
    }
  }

  void _recompute() {
    if (_beatTimes.length < 3) return;
    // Average interval between the recent beats → BPM.
    var total = 0;
    for (var i = 1; i < _beatTimes.length; i++) {
      total += _beatTimes[i] - _beatTimes[i - 1];
    }
    final avgMs = total / (_beatTimes.length - 1);
    if (avgMs <= 0) return;
    final bpm = (60000 / avgMs).round();
    if (bpm >= 40 && bpm <= 220) _bpm = bpm;
  }

  Future<void> _offerSave() async {
    final calm = _calmness >= 60
        ? tr(context, "Calm", "တည်ငြိမ်")
        : (_calmness >= 35
            ? tr(context, "Balanced", "အလယ်အလတ်")
            : tr(context, "Tense", "တင်းမာ"));
    final save = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: Text(tr(context, "Measurement complete", "တိုင်းတာမှု ပြီးပါပြီ")),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _resultLine(tr(context, "Heart rate", "နှလုံးခုန်နှုန်း"), "$_bpm bpm"),
            if (_respiratory > 0)
              _resultLine(tr(context, "Respiratory", "အသက်ရှူနှုန်း"),
                  "$_respiratory /min"),
            if (_hrvMs > 0)
              _resultLine("HRV", "$_hrvMs ms"),
            if (_calmness > 0)
              _resultLine(tr(context, "Calmness", "တည်ငြိမ်မှု"),
                  "$_calmness% · $calm"),
            const SizedBox(height: 10),
            Text(tr(context, "Save to your vitals?", "မှတ်တမ်းသို့ သိမ်းမလား?")),
          ],
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: Text(tr(context, "Discard", "ဖျက်မည်"))),
          ElevatedButton(
              onPressed: () => Navigator.pop(context, true),
              child: Text(tr(context, "Save", "သိမ်းမည်"))),
        ],
      ),
    );
    if (save == true) {
      final now = DateTime.now();
      final api = mounted ? context.read<AppState>().api : null;
      final note =
          "${tr(context, "Camera pulse", "ကင်မရာ pulse")} · HRV $_hrvMs ms · ${tr(context, "calm", "တည်ငြိမ်")} $_calmness%";
      final hr = VitalReading(
        id: now.microsecondsSinceEpoch.toString(),
        type: VitalType.heartRate.key,
        value: _bpm.toDouble(),
        at: now,
        note: note,
      );
      await HealthStore.addVital(hr);
      if (api != null) await pushVitalToServer(api, hr, source: 'camera_ppg');
      // Respiratory rate rides along from the same measurement.
      if (_respiratory > 0) {
        final resp = VitalReading(
          id: (now.microsecondsSinceEpoch + 1).toString(),
          type: VitalType.respiratory.key,
          value: _respiratory.toDouble(),
          at: now,
          note: tr(context, "From camera pulse", "ကင်မရာ pulse မှ"),
        );
        await HealthStore.addVital(resp);
        if (api != null) {
          await pushVitalToServer(api, resp, source: 'camera_ppg');
        }
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(tr(context, "Saved to vitals.", "မှတ်တမ်းသို့ သိမ်းပြီး။"))));
      }
    }
  }

  Widget _resultLine(String k, String v) => Padding(
        padding: const EdgeInsets.only(bottom: 4),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(k, style: TextStyle(color: GwColors.inkSoftOf(context))),
            Text(v, style: const TextStyle(fontWeight: FontWeight.w800)),
          ],
        ),
      );

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: Text(tr(context, "Heart wave", "နှလုံးလှိုင်း")),
      ),
      body: _error != null
          ? _errorView()
          : !_ready
              ? const Center(
                  child: CircularProgressIndicator(color: GwColors.primary))
              : _measureView(),
    );
  }

  Widget _errorView() => Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.videocam_off, color: Colors.white38, size: 56),
              const SizedBox(height: 12),
              Text(_error!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Colors.white70)),
            ],
          ),
        ),
      );

  /// 0..1 pulse-signal strength from the recent waveform amplitude.
  double get _signalQuality {
    if (_wave.length < 20) return 0;
    final recent = _wave.sublist(_wave.length - 20);
    var lo = recent.first, hi = recent.first;
    for (final v in recent) {
      lo = math.min(lo, v);
      hi = math.max(hi, v);
    }
    return ((hi - lo) / 6).clamp(0.0, 1.0);
  }

  Widget _statusRow() {
    final q = _signalQuality;
    final Color c;
    final String label;
    if (!_fingerDetected) {
      c = GwColors.gold;
      label = tr(context, "Place fingertip on camera",
          "လက်ဖျားကို ကင်မရာပေါ်တင်ပါ");
    } else if (q < 0.35) {
      c = GwColors.gold;
      label = tr(context, "Hold still — weak signal", "မလှုပ်ပါနဲ့ — signal အား နည်း");
    } else {
      c = const Color(0xFF7ED957);
      label = tr(context, "Good signal ✓", "signal ကောင်း ✓");
    }
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(_fingerDetected ? Icons.fingerprint : Icons.touch_app,
              color: c, size: 18),
          const SizedBox(width: 8),
          Flexible(
            child: Text(label,
                style: TextStyle(color: c, fontWeight: FontWeight.w600)),
          ),
          const SizedBox(width: 10),
          // Signal-strength bars.
          for (var i = 0; i < 4; i++)
            Padding(
              padding: const EdgeInsets.only(left: 2),
              child: Container(
                width: 4,
                height: 8.0 + i * 4,
                decoration: BoxDecoration(
                  color: q * 4 > i ? c : Colors.white24,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
        ],
      ),
    );
  }

  /// One patient-monitor readout tile: label + big coloured number + unit.
  /// Tappable — opens a details sheet explaining the metric and its ranges.
  Widget _vitalTile(String label, String value, String unit, Color color,
      {bool big = false, VoidCallback? onTap}) {
    return InkWell(
      borderRadius: BorderRadius.circular(10),
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(label,
                    style: TextStyle(
                        color: color.withValues(alpha: 0.8),
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.5)),
                if (onTap != null) ...[
                  const SizedBox(width: 3),
                  Icon(Icons.info_outline,
                      size: 11, color: color.withValues(alpha: 0.6)),
                ],
              ],
            ),
            Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(value,
                    style: TextStyle(
                        color: color,
                        fontSize: big ? 52 : 30,
                        fontWeight: FontWeight.w900,
                        height: 1,
                        fontFeatures: const [FontFeature.tabularFigures()])),
                const SizedBox(width: 3),
                Text(unit,
                    style: TextStyle(
                        color: color.withValues(alpha: 0.6), fontSize: 11)),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _monitorRow() {
    final calmColor = _calmness >= 60
        ? const Color(0xFF39E67B)
        : (_calmness >= 35 ? GwColors.gold : GwColors.live);
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        _vitalTile("HR", _bpm > 0 ? "$_bpm" : "--", "bpm",
            const Color(0xFF39E67B),
            big: true, onTap: () => _showMetricInfo("HR")),
        _vitalTile("RESP", _respiratory > 0 ? "$_respiratory" : "--", "/min",
            const Color(0xFF44C8FF), onTap: () => _showMetricInfo("RESP")),
        _vitalTile("HRV", _hrvMs > 0 ? "$_hrvMs" : "--", "ms", GwColors.gold,
            onTap: () => _showMetricInfo("HRV")),
        _vitalTile("CALM", _calmness > 0 ? "$_calmness" : "--", "%", calmColor,
            onTap: () => _showMetricInfo("CALM")),
      ],
    );
  }

  /// A rich details sheet for one metric: what it is, the normal range, a
  /// colour-banded scale with a marker at the current reading, and a plain
  /// interpretation of that reading — so the number actually means something.
  void _showMetricInfo(String key) {
    // spec: title, unit, description, normalRange text, scale lo/hi, and the
    // zones [(start, end, color, en, my)] across that scale.
    late final String titleEn, titleMy, unit, descEn, descMy, rangeEn, rangeMy;
    late final double lo, hi;
    late final List<(double, double, Color, String, String)> zones;
    double? value;

    const green = Color(0xFF39E67B);
    final gold = GwColors.gold;
    final red = GwColors.live;

    switch (key) {
      case "HR":
        titleEn = "Heart rate";
        titleMy = "နှလုံးခုန်နှုန်း";
        unit = "bpm";
        value = _bpm > 0 ? _bpm.toDouble() : null;
        descEn =
            "How many times your heart beats per minute, read from the pulse in "
            "your fingertip. It rises with activity, stress or caffeine and "
            "falls at rest and during sleep.";
        descMy =
            "တစ်မိနစ်မှာ နှလုံး ဘယ်နှစ်ချက် ခုန်လဲ — လက်ဖျား pulse ကနေ ဖတ်တာ။ "
            "လှုပ်ရှား/စိတ်လှုပ်ရှား/ကော်ဖီ သောက်ရင် တက်၊ အနားယူ/အိပ်ရင် ကျ။";
        rangeEn = "Resting adult: 60–100 bpm (athletes 40–60)";
        rangeMy = "အနားယူ လူကြီး: ၆၀–၁၀၀ bpm (အားကစားသမား ၄၀–၆၀)";
        lo = 40;
        hi = 160;
        zones = [
          (40, 60, gold, "Low / athlete", "နိမ့် / အားကစားသမား"),
          (60, 100, green, "Normal", "ပုံမှန်"),
          (100, 160, red, "High", "မြင့်"),
        ];
        break;
      case "RESP":
        titleEn = "Respiratory rate";
        titleMy = "အသက်ရှူနှုန်း";
        unit = "/min";
        value = _respiratory > 0 ? _respiratory.toDouble() : null;
        descEn =
            "Breaths per minute, estimated from the tiny way your pulse speeds "
            "up and slows down as you breathe (respiratory sinus arrhythmia). "
            "No separate sensor is used.";
        descMy =
            "တစ်မိနစ်မှာ ဘယ်နှစ်ကြိမ် အသက်ရှူလဲ — အသက်ရှူတဲ့အခါ pulse "
            "အနည်းငယ် မြန်/နှေးတာ (RSA) ကနေ ခန့်မှန်းတာ။ သီးခြား sensor မလို။";
        rangeEn = "Resting adult: 12–20 breaths/min";
        rangeMy = "အနားယူ လူကြီး: ၁၂–၂၀ ကြိမ်/မိနစ်";
        lo = 5;
        hi = 40;
        zones = [
          (5, 12, gold, "Low", "နိမ့်"),
          (12, 20, green, "Normal", "ပုံမှန်"),
          (20, 40, red, "High", "မြင့်"),
        ];
        break;
      case "HRV":
        titleEn = "Heart-rate variability (RMSSD)";
        titleMy = "နှလုံးခုန် ကွဲပြားမှု (HRV)";
        unit = "ms";
        value = _hrvMs > 0 ? _hrvMs.toDouble() : null;
        descEn =
            "The tiny beat-to-beat difference in the time between heartbeats "
            "(RMSSD). A HIGHER number is generally better — it reflects a "
            "relaxed, well-recovered nervous system. It varies a lot by age and "
            "fitness.";
        descMy =
            "နှလုံးခုန် တစ်ချက်နဲ့ တစ်ချက်ကြား အချိန် ကွာဟမှု (RMSSD)။ "
            "ဂဏန်း မြင့်လေ ကောင်းလေ — ကိုယ်ခန္ဓာ တည်ငြိမ်/ပြန်လည်ကောင်းမွန်မှုကို "
            "ပြ။ အသက်/ကျန်းမာရေးအလိုက် အများကြီး ကွာတတ်။";
        rangeEn = "Typical adult (rest): 20–100+ ms";
        rangeMy = "ပုံမှန် လူကြီး (အနားယူ): ၂၀–၁၀၀+ ms";
        lo = 0;
        hi = 120;
        zones = [
          (0, 20, red, "Low", "နိမ့်"),
          (20, 50, gold, "Moderate", "အလယ်အလတ်"),
          (50, 120, green, "Good", "ကောင်း"),
        ];
        break;
      default: // CALM
        titleEn = "Calmness";
        titleMy = "စိတ်တည်ငြိမ်မှု";
        unit = "%";
        value = _calmness > 0 ? _calmness.toDouble() : null;
        descEn =
            "A 0–100 relaxation score derived from your HRV. Higher means your "
            "body is in a calmer, more parasympathetic (rest-and-digest) state. "
            "Slow breathing usually raises it.";
        descMy =
            "HRV ကနေ ရေတွက်ထားတဲ့ ၀–၁၀၀ တည်ငြိမ်မှု ရမှတ်။ မြင့်လေ ကိုယ်ခန္ဓာ "
            "ပိုတည်ငြိမ်/အနားယူ အခြေအနေ။ ဖြည်းဖြည်း အသက်ရှူရင် များသောအားဖြင့် တက်။";
        rangeEn = "Tense < 35 · Balanced 35–60 · Calm > 60";
        rangeMy = "တင်းမာ < ၃၅ · အလယ်အလတ် ၃၅–၆၀ · တည်ငြိမ် > ၆၀";
        lo = 0;
        hi = 100;
        zones = [
          (0, 35, red, "Tense", "တင်းမာ"),
          (35, 60, gold, "Balanced", "အလယ်အလတ်"),
          (60, 100, green, "Calm", "တည်ငြိမ်"),
        ];
    }

    // Which zone is the current value in?
    (Color, String, String)? band;
    if (value != null) {
      for (final z in zones) {
        if (value >= z.$1 && value <= z.$2) {
          band = (z.$3, z.$4, z.$5);
          break;
        }
      }
    }

    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF161719),
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(18))),
      builder: (_) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(tr(context, titleEn, titleMy),
                style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w900,
                    fontSize: 18)),
            const SizedBox(height: 4),
            // Current reading + band chip.
            Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                Text(value != null ? value.toStringAsFixed(0) : "--",
                    style: TextStyle(
                        color: band?.$1 ?? Colors.white,
                        fontSize: 40,
                        fontWeight: FontWeight.w900,
                        height: 1,
                        fontFeatures:
                            const [FontFeature.tabularFigures()])),
                const SizedBox(width: 4),
                Text(unit,
                    style: const TextStyle(
                        color: Colors.white54, fontSize: 14)),
                const Spacer(),
                if (band != null)
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: band.$1.withValues(alpha: 0.18),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(tr(context, band.$2, band.$3),
                        style: TextStyle(
                            color: band.$1,
                            fontWeight: FontWeight.w800,
                            fontSize: 12.5)),
                  ),
              ],
            ),
            const SizedBox(height: 14),
            _bandScale(value, lo, hi, zones),
            const SizedBox(height: 14),
            Text(tr(context, descEn, descMy),
                style: const TextStyle(
                    color: Colors.white70, fontSize: 13.5, height: 1.4)),
            const SizedBox(height: 12),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.check_circle_outline,
                    size: 16, color: Color(0xFF39E67B)),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(tr(context, rangeEn, rangeMy),
                      style: const TextStyle(
                          color: Colors.white, fontSize: 13,
                          fontWeight: FontWeight.w600)),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              tr(context,
                  "Wellness estimate from a camera pulse — not a medical diagnosis.",
                  "ကင်မရာ pulse မှ ကျန်းမာရေး ခန့်မှန်းချက်သာ — ဆေးဘက်ဆိုင်ရာ ရောဂါရှာဖွေမှု မဟုတ်ပါ။"),
              style: const TextStyle(color: Colors.white38, fontSize: 11.5),
            ),
          ],
        ),
      ),
    );
  }

  /// A colour-banded horizontal scale with a marker at the current value.
  Widget _bandScale(double? value, double lo, double hi,
      List<(double, double, Color, String, String)> zones) {
    return LayoutBuilder(builder: (context, c) {
      final w = c.maxWidth;
      double posFor(double v) => ((v - lo) / (hi - lo)).clamp(0.0, 1.0) * w;
      return SizedBox(
        height: 34,
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            // Zone bar.
            Positioned(
              top: 12,
              left: 0,
              right: 0,
              child: Row(
                children: [
                  for (final z in zones)
                    Expanded(
                      flex: ((z.$2 - z.$1) * 100).round(),
                      child: Container(
                        height: 10,
                        decoration: BoxDecoration(
                          color: z.$3.withValues(alpha: 0.55),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            // Marker.
            if (value != null)
              Positioned(
                left: (posFor(value) - 6).clamp(0.0, w - 12),
                top: 8,
                child: Container(
                  width: 12,
                  height: 18,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(3),
                    border: Border.all(color: Colors.black, width: 1),
                  ),
                ),
              ),
          ],
        ),
      );
    });
  }

  Widget _measureView() {
    return Column(
      children: [
        const SizedBox(height: 18),
        // Patient-monitor readouts: HR / RESP / HRV / CALM.
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: _monitorRow(),
        ),
        const SizedBox(height: 4),
        Text(
          tr(context, "ⓘ Tap a number for details",
              "ⓘ Number တစ်ခုကို နှိပ်ပြီး အသေးစိတ်ကြည့်ပါ"),
          style: const TextStyle(color: Colors.white38, fontSize: 11),
        ),
        const SizedBox(height: 8),
        // Live status: finger + signal quality, so the user understands what
        // the reading needs.
        if (_measuring) _statusRow(),
        const SizedBox(height: 6),
        // Progress of the measurement window.
        if (_measuring)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value:
                    (_measureSeconds - _remaining) / _measureSeconds,
                minHeight: 5,
                backgroundColor: Colors.white12,
                color: const Color(0xFF7ED957),
              ),
            ),
          ),
        const SizedBox(height: 8),
        // Live waveform.
        Expanded(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: CustomPaint(
              size: Size.infinite,
              painter: _WavePainter(_wave),
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(24, 4, 24, 8),
          child: Text(
            _measuring
                ? (_fingerDetected
                    ? tr(context, "Hold still… $_remaining s",
                        "မလှုပ်ဘဲ ဆက်ဖိထားပါ… $_remaining s")
                    : tr(context,
                        "Cover the rear camera + flash with your fingertip.",
                        "နောက်ကင်မရာ + flash ကို လက်ဖျားနဲ့ ဖုံးဖိထားပါ။"))
                : tr(context,
                    "Cover the rear camera + flash with your fingertip, then Start.",
                    "နောက်ကင်မရာ + flash ကို လက်ဖျားနဲ့ ဖုံးပြီး Start နှိပ်ပါ။"),
            textAlign: TextAlign.center,
            style: const TextStyle(color: Colors.white70, fontSize: 13),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(24, 0, 24, 8),
          child: Text(
            tr(context,
                "PPG pulse estimate for wellness — not a medical ECG.",
                "PPG pulse ခန့်မှန်းချက်သာ — ဆေးဘက်ဆိုင်ရာ ECG မဟုတ်ပါ။"),
            textAlign: TextAlign.center,
            style: const TextStyle(color: Colors.white38, fontSize: 11),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(24, 0, 24, 28),
          child: SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: _measuring ? _finish : _start,
              style: ElevatedButton.styleFrom(
                backgroundColor:
                    _measuring ? GwColors.live : GwColors.primary,
                padding: const EdgeInsets.symmetric(vertical: 16),
              ),
              icon: Icon(_measuring ? Icons.stop : Icons.favorite),
              label: Text(_measuring
                  ? tr(context, "Stop", "ရပ်မည်")
                  : tr(context, "Start", "စတင်မည်")),
            ),
          ),
        ),
      ],
    );
  }
}

/// ECG-monitor style trace: classic ECG-paper grid, a glowing green sweep with
/// a bright leading dot, and a flat baseline when there's no signal — so it
/// reads like a real patient monitor rather than a random zig-zag.
class _WavePainter extends CustomPainter {
  _WavePainter(this.samples);
  final List<double> samples;

  static const _green = Color(0xFF39E67B);

  @override
  void paint(Canvas canvas, Size size) {
    // ECG-paper grid: fine 8px squares, bold every 5th line.
    const cell = 8.0;
    final minor = Paint()
      ..color = const Color(0xFF0C2E14)
      ..strokeWidth = 0.6;
    final major = Paint()
      ..color = const Color(0xFF124A20)
      ..strokeWidth = 1.0;
    for (var x = 0.0; x <= size.width; x += cell) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height),
          (x ~/ cell) % 5 == 0 ? major : minor);
    }
    for (var y = 0.0; y <= size.height; y += cell) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y),
          (y ~/ cell) % 5 == 0 ? major : minor);
    }

    final mid = size.height / 2;
    if (samples.length < 2) {
      // No signal → flat monitor baseline.
      canvas.drawLine(
        Offset(0, mid),
        Offset(size.width, mid),
        Paint()
          ..color = _green.withValues(alpha: 0.7)
          ..strokeWidth = 2,
      );
      return;
    }

    // Scale by the peak amplitude so the pulse fills ~40% of the height without
    // stretching a few flat points into a giant zig-zag.
    var maxAbs = 0.6;
    for (final v in samples) {
      maxAbs = math.max(maxAbs, v.abs());
    }
    final scale = (size.height * 0.40) / maxAbs;
    final dx = size.width / (samples.length - 1);
    final path = Path();
    for (var i = 0; i < samples.length; i++) {
      final x = dx * i;
      final y = (mid - samples[i] * scale).clamp(2.0, size.height - 2);
      i == 0 ? path.moveTo(x, y) : path.lineTo(x, y);
    }

    // Soft glow under the trace.
    canvas.drawPath(
      path,
      Paint()
        ..color = _green.withValues(alpha: 0.25)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 6
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 4),
    );
    // Crisp trace.
    canvas.drawPath(
      path,
      Paint()
        ..color = _green
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.4
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round,
    );
    // Bright leading dot (the sweep head).
    final lastX = dx * (samples.length - 1);
    final lastY =
        (mid - samples.last * scale).clamp(2.0, size.height - 2);
    canvas.drawCircle(Offset(lastX, lastY), 8,
        Paint()..color = _green.withValues(alpha: 0.35));
    canvas.drawCircle(
        Offset(lastX, lastY), 3.5, Paint()..color = Colors.white);
  }

  @override
  bool shouldRepaint(covariant _WavePainter old) => true;
}
