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

/// Pulse-oximeter (SpO₂) using camera photoplethysmography. The fingertip over
/// the rear camera + torch is lit red; as blood pulses, the RED and BLUE light
/// absorbed by oxygenated vs deoxygenated haemoglobin changes by different
/// amounts. From the ratio of the pulsatile (AC) to steady (DC) parts of each
/// colour — the clinical "ratio of ratios" R = (AC_red/DC_red)/(AC_blue/DC_blue)
/// — we estimate blood-oxygen saturation, together with the pulse rate and a
/// perfusion index.
///
/// NOTE: a phone camera is NOT a calibrated medical oximeter. This is a wellness
/// estimate only and must not be used for diagnosis or to manage a medical
/// condition. If you feel unwell, seek professional care.
class OximeterScreen extends StatefulWidget {
  const OximeterScreen({super.key});

  @override
  State<OximeterScreen> createState() => _OximeterScreenState();
}

class _OximeterScreenState extends State<OximeterScreen> {
  CameraController? _cam;
  bool _ready = false;
  bool _measuring = false;
  bool _fingerDetected = false;
  String? _error;

  // Live plethysmograph trace (detrended red signal).
  final List<double> _wave = [];

  // Per-frame channel means over the whole measurement window, used for the
  // ratio-of-ratios once the window completes.
  final List<double> _redSeries = [];
  final List<double> _blueSeries = [];

  // Beat detection on the red channel → pulse rate.
  final List<int> _beatTimes = [];
  int _bpm = 0;

  int _spo2 = 0; // % SpO₂ estimate
  double _perfusion = 0; // perfusion index %
  double _redAvg = 0; // slow moving average for detrending

  Timer? _ticker;

  static const _measureSeconds = 22;
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
        ResolutionPreset.low,
        enableAudio: false,
        imageFormatGroup: ImageFormatGroup.yuv420,
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
    _redSeries.clear();
    _blueSeries.clear();
    _beatTimes.clear();
    _bpm = 0;
    _spo2 = 0;
    _perfusion = 0;
    _redAvg = 0;
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
    _computeSpo2();
    setState(() => _measuring = false);
    if (_spo2 >= 70 && _bpm >= 40 && _bpm <= 220) {
      _offerSave();
    }
  }

  // ---- Frame processing -----------------------------------------------------

  DateTime _lastRepaint = DateTime.fromMillisecondsSinceEpoch(0);

  /// Reconstruct approximate mean RED and BLUE from the YUV420 planes over a
  /// coarse grid of pixels (full-res conversion would be far too slow at frame
  /// rate). Y is luminance; U/V are the chroma planes (half resolution).
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
    // Sample a ~40x40 grid across the frame.
    final stepX = math.max(1, w ~/ 40);
    final stepY = math.max(1, h ~/ 40);
    for (var y = 0; y < h; y += stepY) {
      final yRowBase = y * yP.bytesPerRow;
      final uvRowBase = (y >> 1) * uvRow;
      for (var x = 0; x < w; x += stepX) {
        final yi = yRowBase + x;
        final uvi = uvRowBase + (x >> 1) * uvPix;
        if (yi >= yP.bytes.length || uvi >= uP.bytes.length ||
            uvi >= vP.bytes.length) {
          continue;
        }
        final yv = yP.bytes[yi].toDouble();
        final uv = uP.bytes[uvi].toDouble() - 128.0;
        final vv = vP.bytes[uvi].toDouble() - 128.0;
        // BT.601 YUV→RGB (red & blue only).
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

    // Finger present when the frame is bright & red-dominant (torch through
    // tissue). Otherwise prompt the user.
    final finger = lum > 90 && red > blue;
    if (finger != _fingerDetected && mounted) {
      setState(() => _fingerDetected = finger);
    }
    if (!finger) return;

    final nowMs = DateTime.now().millisecondsSinceEpoch;
    _redSeries.add(red);
    _blueSeries.add(blue);

    // Detrend the red channel for the live plethysmograph + beat detection.
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

  /// The ratio-of-ratios SpO₂ estimate, computed once over the full window.
  /// Drops the first second (torch/auto-exposure settling).
  void _computeSpo2() {
    if (_redSeries.length < 30) return;
    // Skip settling samples.
    final start = _redSeries.length > 40 ? 15 : 0;
    final red = _redSeries.sublist(start);
    final blue = _blueSeries.sublist(start);

    final redDc = _mean(red);
    final blueDc = _mean(blue);
    if (redDc <= 0 || blueDc <= 0) return;

    // AC = pulsatile amplitude. Use the RMS of the detrended signal (robust to
    // single-frame spikes) scaled to peak-to-peak equivalent.
    final redAc = _pulsatile(red);
    final blueAc = _pulsatile(blue);
    if (redAc <= 0 || blueAc <= 0) return;

    _perfusion = (redAc / redDc * 100).clamp(0.0, 20.0);

    final ratio = (redAc / redDc) / (blueAc / blueDc);
    // Empirical reflectance-PPG calibration. Uncalibrated hardware, so this is
    // clamped to a plausible wellness range and clearly labelled an estimate.
    final spo2 = 110.0 - 25.0 * ratio;
    _spo2 = spo2.clamp(90.0, 100.0).round();
  }

  double _mean(List<double> xs) =>
      xs.isEmpty ? 0 : xs.reduce((a, b) => a + b) / xs.length;

  /// Pulsatile amplitude of a signal: RMS about a slow moving-average baseline.
  double _pulsatile(List<double> xs) {
    if (xs.length < 4) return 0;
    var avg = xs.first;
    var sumSq = 0.0;
    var n = 0;
    for (final x in xs) {
      avg = avg * 0.9 + x * 0.1; // baseline (DC drift)
      final ac = x - avg;
      sumSq += ac * ac;
      n++;
    }
    // RMS → approx peak-to-peak (×2√2) for a roughly sinusoidal pulse.
    return math.sqrt(sumSq / n) * 2.828;
  }

  // ---- Save -----------------------------------------------------------------

  Future<void> _offerSave() async {
    final band = _spo2 >= 95
        ? tr(context, "Normal", "ပုံမှန်")
        : (_spo2 >= 90
            ? tr(context, "Low-normal", "အနည်းငယ်နိမ့်")
            : tr(context, "Low", "နိမ့်"));
    final save = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: Text(tr(context, "Measurement complete", "တိုင်းတာမှု ပြီးပါပြီ")),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _resultLine(tr(context, "Oxygen (SpO₂)", "အောက်ဆီဂျင် (SpO₂)"),
                "$_spo2% · $band"),
            _resultLine(tr(context, "Pulse", "နှလုံးခုန်နှုန်း"), "$_bpm bpm"),
            if (_perfusion > 0)
              _resultLine(tr(context, "Perfusion", "သွေးစီးဆင်း (PI)"),
                  "${_perfusion.toStringAsFixed(1)}%"),
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
      final spo2Reading = VitalReading(
        id: now.microsecondsSinceEpoch.toString(),
        type: VitalType.spo2.key,
        value: _spo2.toDouble(),
        at: now,
        note:
            "${tr(context, "Camera oximeter", "ကင်မရာ oximeter")} · PI ${_perfusion.toStringAsFixed(1)}%",
      );
      await HealthStore.addVital(spo2Reading);
      if (api != null) {
        await pushVitalToServer(api, spo2Reading, source: 'camera_ppg');
      }
      // Pulse rides along from the same measurement.
      if (_bpm >= 40 && _bpm <= 220) {
        final hr = VitalReading(
          id: (now.microsecondsSinceEpoch + 1).toString(),
          type: VitalType.heartRate.key,
          value: _bpm.toDouble(),
          at: now,
          note: tr(context, "From camera oximeter", "ကင်မရာ oximeter မှ"),
        );
        await HealthStore.addVital(hr);
        if (api != null) await pushVitalToServer(api, hr, source: 'camera_ppg');
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content:
                Text(tr(context, "Saved to vitals.", "မှတ်တမ်းသို့ သိမ်းပြီး။"))));
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

  // ---- UI -------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: Text(tr(context, "Oximeter (SpO₂)", "အောက်ဆီမီတာ (SpO₂)")),
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

  double get _signalQuality {
    if (_wave.length < 20) return 0;
    final recent = _wave.sublist(_wave.length - 20);
    var lo = recent.first, hi = recent.first;
    for (final v in recent) {
      lo = math.min(lo, v);
      hi = math.max(hi, v);
    }
    return ((hi - lo) / 5).clamp(0.0, 1.0);
  }

  Widget _statusRow() {
    final q = _signalQuality;
    final Color c;
    final String label;
    if (!_fingerDetected) {
      c = GwColors.gold;
      label = tr(context, "Place fingertip on camera",
          "လက်ဖျားကို ကင်မရာပေါ်တင်ပါ");
    } else if (q < 0.3) {
      c = GwColors.gold;
      label =
          tr(context, "Hold still — weak signal", "မလှုပ်ပါနဲ့ — signal အား နည်း");
    } else {
      c = const Color(0xFF44C8FF);
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

  Widget _vitalTile(String label, String value, String unit, Color color,
      {bool big = false}) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(label,
            style: TextStyle(
                color: color.withValues(alpha: 0.8),
                fontSize: 11,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.5)),
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
                style:
                    TextStyle(color: color.withValues(alpha: 0.6), fontSize: 11)),
          ],
        ),
      ],
    );
  }

  Widget _monitorRow() {
    final spo2Color = _spo2 == 0
        ? const Color(0xFF44C8FF)
        : (_spo2 >= 95
            ? const Color(0xFF44C8FF)
            : (_spo2 >= 90 ? GwColors.gold : GwColors.live));
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        _vitalTile("SpO₂", _spo2 > 0 ? "$_spo2" : "--", "%", spo2Color,
            big: true),
        _vitalTile("PULSE", _bpm > 0 ? "$_bpm" : "--", "bpm",
            const Color(0xFF39E67B)),
        _vitalTile(
            "PI",
            _perfusion > 0 ? _perfusion.toStringAsFixed(1) : "--",
            "%",
            GwColors.gold),
      ],
    );
  }

  Widget _measureView() {
    return Column(
      children: [
        const SizedBox(height: 18),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: _monitorRow(),
        ),
        const SizedBox(height: 12),
        if (_measuring) _statusRow(),
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
                color: const Color(0xFF44C8FF),
              ),
            ),
          ),
        const SizedBox(height: 8),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: CustomPaint(
              size: Size.infinite,
              painter: _PlethPainter(_wave),
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
                    : tr(
                        context,
                        "Cover the rear camera + flash with your fingertip.",
                        "နောက်ကင်မရာ + flash ကို လက်ဖျားနဲ့ ဖုံးဖိထားပါ။"))
                : tr(
                    context,
                    "Cover the rear camera + flash with your fingertip, then Start.",
                    "နောက်ကင်မရာ + flash ကို လက်ဖျားနဲ့ ဖုံးပြီး Start နှိပ်ပါ။"),
            textAlign: TextAlign.center,
            style: const TextStyle(color: Colors.white70, fontSize: 13),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(24, 0, 24, 8),
          child: Text(
            tr(
                context,
                "SpO₂ estimate from the camera — not a calibrated medical oximeter.",
                "ကင်မရာ SpO₂ ခန့်မှန်းချက်သာ — တိကျသော ဆေးဘက် oximeter မဟုတ်ပါ။"),
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
                    _measuring ? GwColors.live : const Color(0xFF2E7DB1),
                padding: const EdgeInsets.symmetric(vertical: 16),
              ),
              icon: Icon(_measuring ? Icons.stop : Icons.spa),
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

/// Monitor-style plethysmograph: ECG-paper grid with a glowing cyan pulse wave
/// and a bright leading sweep dot; flat baseline when there is no signal.
class _PlethPainter extends CustomPainter {
  _PlethPainter(this.samples);
  final List<double> samples;

  static const _cyan = Color(0xFF44C8FF);

  @override
  void paint(Canvas canvas, Size size) {
    const cell = 8.0;
    final minor = Paint()
      ..color = const Color(0xFF0A2333)
      ..strokeWidth = 0.6;
    final major = Paint()
      ..color = const Color(0xFF103A54)
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
      canvas.drawLine(
        Offset(0, mid),
        Offset(size.width, mid),
        Paint()
          ..color = _cyan.withValues(alpha: 0.7)
          ..strokeWidth = 2,
      );
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
        ..color = _cyan.withValues(alpha: 0.25)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 6
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 4),
    );
    canvas.drawPath(
      path,
      Paint()
        ..color = _cyan
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.4
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round,
    );
    final lastX = dx * (samples.length - 1);
    final lastY = (mid - samples.last * scale).clamp(2.0, size.height - 2);
    canvas.drawCircle(Offset(lastX, lastY), 8,
        Paint()..color = _cyan.withValues(alpha: 0.35));
    canvas.drawCircle(Offset(lastX, lastY), 3.5, Paint()..color = Colors.white);
  }

  @override
  bool shouldRepaint(covariant _PlethPainter old) => true;
}
