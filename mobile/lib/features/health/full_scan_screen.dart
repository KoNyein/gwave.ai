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

/// One-tap "Full scan": a single camera-PPG session that measures every vital
/// the phone can derive from a fingertip pulse at once — heart rate, blood
/// oxygen (SpO₂), respiratory rate, heart-rate variability (HRV/RMSSD), a
/// calmness score and a perfusion index — then saves them all to the vitals
/// database (local + cloud).
///
/// Wellness estimates from a camera, not a medical device.
class FullScanScreen extends StatefulWidget {
  const FullScanScreen({super.key});

  @override
  State<FullScanScreen> createState() => _FullScanScreenState();
}

class _FullScanScreenState extends State<FullScanScreen> {
  CameraController? _cam;
  bool _ready = false;
  bool _measuring = false;
  bool _fingerDetected = false;
  String? _error;

  final List<double> _wave = []; // detrended red trace
  final List<double> _redSeries = [];
  final List<double> _blueSeries = [];
  final List<int> _beatTimes = []; // recent (running BPM)
  final List<int> _allBeatTimes = []; // whole session (HRV/RESP)
  double _redAvg = 0;

  int _bpm = 0;
  int _spo2 = 0;
  int _respiratory = 0;
  int _hrvMs = 0;
  int _calmness = 0;
  double _perfusion = 0;

  Timer? _ticker;
  static const _measureSeconds = 30; // longer window ⇒ better HRV + SpO₂
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
      final ctrl = CameraController(rear, ResolutionPreset.low,
          enableAudio: false, imageFormatGroup: ImageFormatGroup.yuv420);
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
    _redSeries.clear();
    _blueSeries.clear();
    _beatTimes.clear();
    _allBeatTimes.clear();
    _redAvg = 0;
    _bpm = _spo2 = _respiratory = _hrvMs = _calmness = 0;
    _perfusion = 0;
    _remaining = _measureSeconds;
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
    _computeSpo2();
    setState(() => _measuring = false);
    if (_bpm >= 40 && _bpm <= 220) _offerSave();
  }

  // ---- Frame processing (red + blue means from YUV420) ---------------------

  DateTime _lastRepaint = DateTime.fromMillisecondsSinceEpoch(0);
  void _onFrame(CameraImage image) {
    if (image.planes.length < 3) return;
    final yP = image.planes[0];
    final uP = image.planes[1];
    final vP = image.planes[2];
    final w = image.width;
    final h = image.height;
    final uvRow = uP.bytesPerRow;
    final uvPix = uP.bytesPerPixel ?? 1;

    double rSum = 0, bSum = 0, ySum = 0;
    var n = 0;
    final stepX = math.max(1, w ~/ 40);
    final stepY = math.max(1, h ~/ 40);
    for (var y = 0; y < h; y += stepY) {
      final yRowBase = y * yP.bytesPerRow;
      final uvRowBase = (y >> 1) * uvRow;
      for (var x = 0; x < w; x += stepX) {
        final yi = yRowBase + x;
        final uvi = uvRowBase + (x >> 1) * uvPix;
        if (yi >= yP.bytes.length ||
            uvi >= uP.bytes.length ||
            uvi >= vP.bytes.length) {
          continue;
        }
        final yv = yP.bytes[yi].toDouble();
        final uv = uP.bytes[uvi].toDouble() - 128.0;
        final vv = vP.bytes[uvi].toDouble() - 128.0;
        final r = (yv + 1.370705 * vv).clamp(0.0, 255.0);
        final b = (yv + 1.732446 * uv).clamp(0.0, 255.0);
        rSum += r;
        bSum += b;
        ySum += yv;
        n++;
      }
    }
    if (n == 0) return;
    final red = rSum / n;
    final blue = bSum / n;
    final lum = ySum / n;

    final finger = lum > 90 && red > blue;
    if (finger != _fingerDetected && mounted) {
      setState(() => _fingerDetected = finger);
    }
    if (!finger) return;

    final nowMs = DateTime.now().millisecondsSinceEpoch;
    _redSeries.add(red);
    _blueSeries.add(blue);
    _redAvg = _redAvg == 0 ? red : _redAvg * 0.9 + red * 0.1;
    final detrended = red - _redAvg;
    _wave.add(detrended);
    if (_wave.length > 160) _wave.removeAt(0);
    _detectBeat(detrended, nowMs);

    final now = DateTime.now();
    if (now.difference(_lastRepaint).inMilliseconds >= 33) {
      _lastRepaint = now;
      if (mounted) setState(() {});
    }
  }

  bool _above = false;
  void _detectBeat(double v, int nowMs) {
    const threshold = 0.5;
    if (v > threshold && !_above) {
      _above = true;
      if (_beatTimes.isEmpty || nowMs - _beatTimes.last > 300) {
        _beatTimes.add(nowMs);
        if (_beatTimes.length > 12) _beatTimes.removeAt(0);
        _allBeatTimes.add(nowMs);
        _recomputeBpm();
      }
    } else if (v < -threshold && _above) {
      _above = false;
    }
  }

  void _recomputeBpm() {
    if (_beatTimes.length < 3) return;
    var total = 0;
    for (var i = 1; i < _beatTimes.length; i++) {
      total += _beatTimes[i] - _beatTimes[i - 1];
    }
    final avgMs = total / (_beatTimes.length - 1);
    if (avgMs <= 0) return;
    final bpm = (60000 / avgMs).round();
    if (bpm >= 40 && bpm <= 220) _bpm = bpm;
  }

  /// HRV (RMSSD), calmness and respiratory rate from the beat timing.
  void _computeMetrics() {
    final rr = <double>[];
    for (var i = 1; i < _allBeatTimes.length; i++) {
      final d = (_allBeatTimes[i] - _allBeatTimes[i - 1]).toDouble();
      if (d >= 300 && d <= 1500) rr.add(d);
    }
    if (rr.length < 4) return;
    var sq = 0.0;
    for (var i = 1; i < rr.length; i++) {
      final d = rr[i] - rr[i - 1];
      sq += d * d;
    }
    final rmssd = math.sqrt(sq / (rr.length - 1));
    _hrvMs = rmssd.round();
    _calmness = ((rmssd - 10) / 60 * 100).clamp(0, 100).round();

    final mean = rr.reduce((a, b) => a + b) / rr.length;
    var crossings = 0;
    var above = rr.first > mean;
    for (final val in rr) {
      final now = val > mean;
      if (now != above) {
        crossings++;
        above = now;
      }
    }
    final windowMin = (_allBeatTimes.last - _allBeatTimes.first) / 1000 / 60;
    if (windowMin > 0.1) {
      _respiratory = (crossings / 2 / windowMin).clamp(5, 40).round();
    }
  }

  /// SpO₂ + perfusion index from the red/blue ratio of ratios.
  void _computeSpo2() {
    if (_redSeries.length < 30) return;
    final start = _redSeries.length > 40 ? 15 : 0;
    final red = _redSeries.sublist(start);
    final blue = _blueSeries.sublist(start);
    final redDc = _mean(red);
    final blueDc = _mean(blue);
    if (redDc <= 0 || blueDc <= 0) return;
    final redAc = _pulsatile(red);
    final blueAc = _pulsatile(blue);
    if (redAc <= 0 || blueAc <= 0) return;
    _perfusion = (redAc / redDc * 100).clamp(0.0, 20.0);
    final ratio = (redAc / redDc) / (blueAc / blueDc);
    _spo2 = (110.0 - 25.0 * ratio).clamp(90.0, 100.0).round();
  }

  double _mean(List<double> xs) =>
      xs.isEmpty ? 0 : xs.reduce((a, b) => a + b) / xs.length;

  double _pulsatile(List<double> xs) {
    if (xs.length < 4) return 0;
    var avg = xs.first;
    var sumSq = 0.0;
    var n = 0;
    for (final x in xs) {
      avg = avg * 0.9 + x * 0.1;
      final ac = x - avg;
      sumSq += ac * ac;
      n++;
    }
    return math.sqrt(sumSq / n) * 2.828;
  }

  // ---- Save all -------------------------------------------------------------

  Future<void> _offerSave() async {
    final save = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: Text(tr(context, "Full scan complete", "Full scan ပြီးပါပြီ")),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _line(tr(context, "Heart rate", "နှလုံးခုန်နှုန်း"), "$_bpm bpm"),
            if (_spo2 > 0)
              _line(tr(context, "Oxygen (SpO₂)", "အောက်ဆီဂျင်"), "$_spo2%"),
            if (_respiratory > 0)
              _line(tr(context, "Respiratory", "အသက်ရှူနှုန်း"),
                  "$_respiratory /min"),
            if (_hrvMs > 0) _line("HRV", "$_hrvMs ms"),
            if (_calmness > 0)
              _line(tr(context, "Calmness", "တည်ငြိမ်မှု"), "$_calmness%"),
            if (_perfusion > 0)
              _line(tr(context, "Perfusion", "PI"),
                  "${_perfusion.toStringAsFixed(1)}%"),
            const SizedBox(height: 10),
            Text(tr(context, "Save all to your vitals?",
                "အားလုံးကို မှတ်တမ်းသို့ သိမ်းမလား?")),
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
    if (save != true) return;

    final api = mounted ? context.read<AppState>().api : null;
    var micro = DateTime.now().microsecondsSinceEpoch;
    Future<void> put(String type, double value, String note) async {
      final r = VitalReading(
          id: (micro++).toString(),
          type: type,
          value: value,
          at: DateTime.now(),
          note: note);
      await HealthStore.addVital(r);
      if (api != null) await pushVitalToServer(api, r, source: 'full_scan');
    }

    final n = tr(context, "Full scan", "Full scan");
    await put(VitalType.heartRate.key, _bpm.toDouble(),
        "$n · HRV $_hrvMs ms · ${tr(context, "calm", "တည်ငြိမ်")} $_calmness%");
    if (_spo2 > 0) {
      await put(VitalType.spo2.key, _spo2.toDouble(),
          "$n · PI ${_perfusion.toStringAsFixed(1)}%");
    }
    if (_respiratory > 0) {
      await put(VitalType.respiratory.key, _respiratory.toDouble(), n);
    }
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(tr(context, "Saved to vitals.", "မှတ်တမ်းသို့ သိမ်းပြီး။"))));
    }
  }

  Widget _line(String k, String v) => Padding(
        padding: const EdgeInsets.only(bottom: 4),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(k, style: TextStyle(color: GwColors.inkSoftOf(context))),
            Text(v, style: const TextStyle(fontWeight: FontWeight.w800)),
          ],
        ),
      );

  // ---- UI -------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: Text(tr(context, "Full scan", "အပြည့်အစုံ တိုင်းတာ")),
      ),
      body: _error != null
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(28),
                child: Text(_error!,
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: Colors.white70)),
              ),
            )
          : !_ready
              ? const Center(
                  child: CircularProgressIndicator(color: GwColors.primary))
              : _view(),
    );
  }

  Widget _view() {
    return Column(
      children: [
        const SizedBox(height: 14),
        // Six-metric grid.
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: GridView.count(
            crossAxisCount: 3,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            childAspectRatio: 1.35,
            children: [
              _tile("HR", _bpm > 0 ? "$_bpm" : "--", "bpm",
                  const Color(0xFF39E67B)),
              _tile("SpO₂", _spo2 > 0 ? "$_spo2" : "--", "%",
                  const Color(0xFF44C8FF)),
              _tile("RESP", _respiratory > 0 ? "$_respiratory" : "--", "/min",
                  const Color(0xFF8E7BFF)),
              _tile("HRV", _hrvMs > 0 ? "$_hrvMs" : "--", "ms", GwColors.gold),
              _tile("CALM", _calmness > 0 ? "$_calmness" : "--", "%",
                  const Color(0xFF39E67B)),
              _tile("PI", _perfusion > 0 ? _perfusion.toStringAsFixed(1) : "--",
                  "%", GwColors.gold),
            ],
          ),
        ),
        const SizedBox(height: 6),
        if (_measuring)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: (_measureSeconds - _remaining) / _measureSeconds,
                minHeight: 5,
                backgroundColor: Colors.white12,
                color: const Color(0xFF39E67B),
              ),
            ),
          ),
        const SizedBox(height: 8),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: CustomPaint(
                size: Size.infinite, painter: _ScanWavePainter(_wave)),
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
                    "Measures HR, SpO₂, respiration, HRV, calmness & perfusion in one go.",
                    "HR, SpO₂, အသက်ရှူ, HRV, တည်ငြိမ်မှု, PI ကို တစ်ကြိမ်တည်း တိုင်း။"),
            textAlign: TextAlign.center,
            style: const TextStyle(color: Colors.white70, fontSize: 13),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(24, 0, 24, 8),
          child: Text(
            tr(context, "Wellness estimates from a camera — not a medical device.",
                "ကင်မရာမှ ကျန်းမာရေး ခန့်မှန်းချက်သာ — ဆေးဘက်ကိရိယာ မဟုတ်ပါ။"),
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
                backgroundColor: _measuring ? GwColors.live : GwColors.primary,
                padding: const EdgeInsets.symmetric(vertical: 16),
              ),
              icon: Icon(_measuring ? Icons.stop : Icons.monitor_heart),
              label: Text(_measuring
                  ? tr(context, "Stop", "ရပ်မည်")
                  : tr(context, "Start full scan", "စတင်တိုင်းမည်")),
            ),
          ),
        ),
      ],
    );
  }

  Widget _tile(String label, String value, String unit, Color color) {
    return Container(
      margin: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(label,
              style: TextStyle(
                  color: color.withValues(alpha: 0.85),
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.4)),
          const SizedBox(height: 2),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(value,
                  style: TextStyle(
                      color: color,
                      fontSize: 26,
                      fontWeight: FontWeight.w900,
                      height: 1,
                      fontFeatures: const [FontFeature.tabularFigures()])),
              const SizedBox(width: 2),
              Text(unit,
                  style: TextStyle(
                      color: color.withValues(alpha: 0.6), fontSize: 10)),
            ],
          ),
        ],
      ),
    );
  }
}

class _ScanWavePainter extends CustomPainter {
  _ScanWavePainter(this.samples);
  final List<double> samples;
  static const _green = Color(0xFF39E67B);

  @override
  void paint(Canvas canvas, Size size) {
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
      canvas.drawLine(Offset(0, mid), Offset(size.width, mid),
          Paint()..color = _green.withValues(alpha: 0.7)..strokeWidth = 2);
      return;
    }
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
    canvas.drawPath(
      path,
      Paint()
        ..color = _green
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.4
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round,
    );
    final lastX = dx * (samples.length - 1);
    final lastY = (mid - samples.last * scale).clamp(2.0, size.height - 2);
    canvas.drawCircle(Offset(lastX, lastY), 3.5, Paint()..color = Colors.white);
  }

  @override
  bool shouldRepaint(covariant _ScanWavePainter old) => true;
}
