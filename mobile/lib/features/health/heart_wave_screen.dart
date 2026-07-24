import 'dart:async';
import 'dart:math' as math;

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
  final List<int> _beatTimes = []; // ms timestamps of detected beats
  int _bpm = 0;
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
    _bpm = 0;
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
    setState(() => _measuring = false);
    if (_bpm >= 40 && _bpm <= 220) {
      _offerSave();
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
    final save = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: Text(tr(context, "Heart rate measured", "နှလုံးခုန်နှုန်း ရရှိ")),
        content: Text("$_bpm bpm\n\n${tr(context, "Save this reading to your vitals?", "ဒီမှတ်တမ်းကို သိမ်းမလား?")}"),
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
      final reading = VitalReading(
        id: DateTime.now().microsecondsSinceEpoch.toString(),
        type: VitalType.heartRate.key,
        value: _bpm.toDouble(),
        at: DateTime.now(),
        note: tr(context, "Camera pulse", "ကင်မရာ pulse"),
      );
      await HealthStore.addVital(reading);
      if (mounted) {
        // Also sync to the user's cloud database (best-effort).
        await pushVitalToServer(
            context.read<AppState>().api, reading,
            source: 'camera_ppg');
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(tr(context, "Saved to vitals.", "မှတ်တမ်းသို့ သိမ်းပြီး။"))));
      }
    }
  }

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

  Widget _measureView() {
    return Column(
      children: [
        const SizedBox(height: 20),
        // Big BPM readout with a pulsing heart.
        Text(
          _bpm > 0 ? "$_bpm" : "--",
          style: const TextStyle(
              color: Colors.white,
              fontSize: 72,
              fontWeight: FontWeight.w900,
              height: 1),
        ),
        const Text("bpm",
            style: TextStyle(color: Colors.white54, fontSize: 16)),
        const SizedBox(height: 12),
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

class _WavePainter extends CustomPainter {
  _WavePainter(this.samples);
  final List<double> samples;

  @override
  void paint(Canvas canvas, Size size) {
    // Baseline grid.
    final grid = Paint()
      ..color = Colors.white.withValues(alpha: 0.06)
      ..strokeWidth = 1;
    for (var y = 0.0; y <= size.height; y += size.height / 4) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), grid);
    }
    if (samples.length < 2) return;

    // Normalise the trace to the box height.
    var lo = samples.first, hi = samples.first;
    for (final v in samples) {
      lo = math.min(lo, v);
      hi = math.max(hi, v);
    }
    final span = (hi - lo).abs() < 0.5 ? 1.0 : hi - lo;
    final dx = size.width / (samples.length - 1);
    final mid = size.height / 2;
    final path = Path();
    for (var i = 0; i < samples.length; i++) {
      final x = dx * i;
      // Centre around the middle, ±40% of height.
      final norm = (samples[i] - (lo + hi) / 2) / span;
      final y = mid - norm * size.height * 0.8;
      i == 0 ? path.moveTo(x, y) : path.lineTo(x, y);
    }
    canvas.drawPath(
      path,
      Paint()
        ..color = const Color(0xFF7ED957)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.6
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round,
    );
  }

  @override
  bool shouldRepaint(covariant _WavePainter old) => true;
}
