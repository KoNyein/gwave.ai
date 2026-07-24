import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_blue_plus/flutter_blue_plus.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:wifi_scan/wifi_scan.dart';

import '../../core/i18n.dart';
import '../../core/theme.dart';
import 'drone_map_screen.dart';

/// A detected drone / drone-like signal.
class DroneHit {
  DroneHit({
    required this.key,
    required this.label,
    required this.rssi,
    required this.source,
    this.remoteId,
    this.lat,
    this.lng,
    this.confirmed = false,
  });

  final String key; // BSSID / BLE id — dedup key
  String label;
  int rssi;
  final String source; // "BLE" or "WiFi"
  String? remoteId;
  double? lat;
  double? lng;
  bool confirmed; // true = parsed Remote ID (high confidence)
  DateTime seen = DateTime.now();

  /// Rough distance (m) from RSSI: d = 10^((measuredPower - rssi)/(10*n)).
  double get distanceM {
    const measuredPower = -59; // RSSI at 1 m
    const n = 2.7; // path-loss exponent (open-ish air)
    return math.pow(10, (measuredPower - rssi) / (10 * n)).toDouble();
  }
}

/// Passive drone-detection radar. The phone listens (never transmits) for the
/// Remote ID that modern drones are required to broadcast — over Bluetooth LE
/// (Open Drone ID / ASTM F3411) and, heuristically, over Wi-Fi — and warns when
/// one is close. Works fully offline. See the on-screen limitations note.
class DroneScannerScreen extends StatefulWidget {
  const DroneScannerScreen({super.key});

  @override
  State<DroneScannerScreen> createState() => _DroneScannerScreenState();
}

class _DroneScannerScreenState extends State<DroneScannerScreen>
    with SingleTickerProviderStateMixin {
  final Map<String, DroneHit> _hits = {};
  StreamSubscription<List<ScanResult>>? _bleSub;
  Timer? _wifiTimer;
  Timer? _alarmTimer;
  Timer? _pruneTimer;
  bool _scanning = false;
  String? _error;
  late final AnimationController _sweep = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 3),
  )..repeat();

  // Alert when a confirmed drone is within this distance (m).
  static const _alertDistanceM = 200.0;

  // SSID fragments that strongly suggest a drone's Wi-Fi.
  static const _wifiPatterns = [
    "dji", "mavic", "tello", "phantom", "anafi", "parrot", "fpv",
    "drone", "skydio", "autel", "evo", "mini se", "air2", "avata",
  ];

  @override
  void initState() {
    super.initState();
    _start();
  }

  @override
  void dispose() {
    _sweep.dispose();
    _bleSub?.cancel();
    _wifiTimer?.cancel();
    _alarmTimer?.cancel();
    _pruneTimer?.cancel();
    FlutterBluePlus.stopScan();
    super.dispose();
  }

  Future<void> _start() async {
    try {
      await [
        Permission.bluetoothScan,
        Permission.bluetoothConnect,
        Permission.locationWhenInUse,
        Permission.nearbyWifiDevices,
      ].request();

      _bleSub = FlutterBluePlus.scanResults.listen(_onBle);
      await FlutterBluePlus.startScan(
        continuousUpdates: true,
        removeIfGone: const Duration(seconds: 20),
      );
      if (mounted) setState(() => _scanning = true);

      // Wi-Fi is polled (the OS rate-limits scans).
      _scanWifi();
      _wifiTimer = Timer.periodic(const Duration(seconds: 12), (_) => _scanWifi());

      // Drop stale hits + re-evaluate the alarm every 2 s.
      _pruneTimer =
          Timer.periodic(const Duration(seconds: 2), (_) => _prune());
    } catch (e) {
      if (mounted) setState(() => _error = "$e");
    }
  }

  // ---- Bluetooth LE (Open Drone ID) ----------------------------------------

  void _onBle(List<ScanResult> results) {
    for (final r in results) {
      final odid = _parseOpenDroneId(r);
      if (odid != null) {
        final k = r.device.remoteId.str;
        final hit = _hits[k] ??
            DroneHit(
                key: k,
                label: tr(context, "Drone (Remote ID)", "ဒရုန်း (Remote ID)"),
                rssi: r.rssi,
                source: "BLE",
                confirmed: true);
        hit.rssi = r.rssi;
        hit.seen = DateTime.now();
        hit.confirmed = true;
        if (odid.$1 != null && odid.$1!.isNotEmpty) {
          hit.remoteId = odid.$1;
          hit.label = "${tr(context, "Drone", "ဒရုန်း")} · ${odid.$1}";
        }
        if (odid.$2 != null) {
          hit.lat = odid.$2;
          hit.lng = odid.$3;
        }
        _hits[k] = hit;
      }
    }
    if (mounted) setState(() {});
    _evaluateAlarm();
  }

  /// Best-effort Open Drone ID parse from a BLE advertisement. ODID over BT4
  /// Legacy is carried as Service Data for 16-bit UUID 0xFFFA, whose first byte
  /// is the app code 0x0D. Returns (remoteId, lat, lng) or null if not ODID.
  /// Everything is wrapped so a malformed frame is simply ignored.
  (String?, double?, double?)? _parseOpenDroneId(ScanResult r) {
    try {
      List<int>? payload;
      for (final entry in r.advertisementData.serviceData.entries) {
        if (entry.key.str.toLowerCase().contains("fffa")) {
          payload = entry.value;
          break;
        }
      }
      if (payload == null || payload.length < 3) return null;
      if (payload[0] != 0x0D) return null; // ODID app code
      // payload[1] = message counter; message starts at [2].
      final msg = payload.sublist(2);
      final header = msg[0];
      final type = (header >> 4) & 0x0F;

      String? id;
      double? lat, lng;
      if (type == 0 && msg.length >= 22) {
        // Basic ID: bytes 2..21 = UAS ID (ASCII).
        final raw = msg.sublist(2, 22);
        id = String.fromCharCodes(raw.where((b) => b >= 32 && b < 127)).trim();
      } else if (type == 1 && msg.length >= 17) {
        // Location/Vector: lat int32 LE @ offset 5, lng @ offset 9 (×1e-7).
        lat = _int32le(msg, 5) / 1e7;
        lng = _int32le(msg, 9) / 1e7;
        if (lat.abs() > 90 || lng.abs() > 180 || (lat == 0 && lng == 0)) {
          lat = null;
          lng = null;
        }
      }
      return (id, lat, lng);
    } catch (_) {
      // Any parse issue → treat as "detected but unparsed": still an ODID frame
      // if the service data was present, so signal a bare detection.
      return ("", null, null);
    }
  }

  int _int32le(List<int> b, int o) {
    final v = b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24);
    return v >= 0x80000000 ? v - 0x100000000 : v;
  }

  // ---- Wi-Fi heuristic ------------------------------------------------------

  Future<void> _scanWifi() async {
    try {
      final can = await WiFiScan.instance.canGetScannedResults();
      if (can != CanGetScannedResults.yes) return;
      final results = await WiFiScan.instance.getScannedResults();
      for (final a in results) {
        final ssid = a.ssid.toLowerCase();
        if (ssid.isEmpty) continue;
        if (_wifiPatterns.any((p) => ssid.contains(p))) {
          final k = a.bssid;
          final hit = _hits[k] ??
              DroneHit(
                  key: k,
                  label: "${tr(context, "Wi-Fi drone?", "Wi-Fi ဒရုန်း?")} · ${a.ssid}",
                  rssi: a.level,
                  source: "WiFi",
                  confirmed: false);
          hit.rssi = a.level;
          hit.seen = DateTime.now();
          _hits[k] = hit;
        }
      }
      if (mounted) setState(() {});
      _evaluateAlarm();
    } catch (_) {}
  }

  // ---- Alarm + housekeeping -------------------------------------------------

  void _prune() {
    final now = DateTime.now();
    _hits.removeWhere((_, h) => now.difference(h.seen).inSeconds > 25);
    if (mounted) setState(() {});
    _evaluateAlarm();
  }

  bool get _threat => _hits.values.any((h) =>
      h.confirmed && h.distanceM <= _alertDistanceM &&
      DateTime.now().difference(h.seen).inSeconds < 15);

  void _evaluateAlarm() {
    if (_threat) {
      _alarmTimer ??= Timer.periodic(const Duration(milliseconds: 900), (_) {
        HapticFeedback.heavyImpact();
      });
    } else {
      _alarmTimer?.cancel();
      _alarmTimer = null;
    }
  }

  // ---- UI -------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    final hits = _hits.values.toList()
      ..sort((a, b) => b.rssi.compareTo(a.rssi));
    final threat = _threat;
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: Text(tr(context, "Drone radar", "ဒရုန်း ရေဒါ")),
        actions: [
          IconButton(
            tooltip: tr(context, "Map", "မြေပုံ"),
            icon: const Icon(Icons.map_outlined),
            onPressed: () => Navigator.of(context).push(MaterialPageRoute(
              builder: (_) =>
                  DroneMapScreen(liveHits: () => _hits.values.toList()),
            )),
          ),
        ],
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
          : Column(
              children: [
                if (threat) _threatBanner(context),
                _radar(hits),
                Expanded(child: _list(hits)),
                _disclaimer(context),
              ],
            ),
    );
  }

  Widget _threatBanner(BuildContext context) => Container(
        width: double.infinity,
        color: GwColors.live,
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 16),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.warning_amber, color: Colors.white),
            const SizedBox(width: 8),
            Text(
              tr(context, "⚠ Drone nearby!", "⚠ ဒရုန်း အနီးတွင်ရှိသည်!"),
              style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w900,
                  fontSize: 16),
            ),
          ],
        ),
      );

  Widget _radar(List<DroneHit> hits) {
    return SizedBox(
      height: 280,
      child: AnimatedBuilder(
        animation: _sweep,
        builder: (_, __) => CustomPaint(
          size: Size.infinite,
          painter: _RadarPainter(hits, _sweep.value),
        ),
      ),
    );
  }

  Widget _list(List<DroneHit> hits) {
    if (hits.isEmpty) {
      return Center(
        child: Text(
          _scanning
              ? tr(context, "Scanning for drones…", "ဒရုန်း ရှာဖွေနေသည်…")
              : tr(context, "Idle", "ရပ်နားနေသည်"),
          style: const TextStyle(color: Colors.white38),
        ),
      );
    }
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(14, 8, 14, 8),
      itemCount: hits.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (_, i) {
        final h = hits[i];
        final d = h.distanceM;
        final near = h.confirmed && d <= _alertDistanceM;
        return Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: near
                ? GwColors.live.withValues(alpha: 0.16)
                : Colors.white.withValues(alpha: 0.06),
            borderRadius: BorderRadius.circular(GwRadius.md),
            border: Border.all(
                color: near
                    ? GwColors.live
                    : Colors.white.withValues(alpha: 0.12)),
          ),
          child: Row(
            children: [
              Icon(h.confirmed ? Icons.flight : Icons.wifi_tethering,
                  color: near ? GwColors.live : Colors.white70),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(h.label,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w700)),
                    Text(
                      "${h.source} · ${h.rssi} dBm · ≈ ${d < 1000 ? "${d.round()} m" : "${(d / 1000).toStringAsFixed(1)} km"}"
                      "${h.confirmed ? "" : "  (${tr(context, "unconfirmed", "မသေချာ")})"}",
                      style: const TextStyle(
                          color: Colors.white54, fontSize: 12),
                    ),
                    if (h.lat != null)
                      Text("📍 ${h.lat!.toStringAsFixed(5)}, ${h.lng!.toStringAsFixed(5)}",
                          style: const TextStyle(
                              color: Colors.white54, fontSize: 12)),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _disclaimer(BuildContext context) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(12),
        color: Colors.white.withValues(alpha: 0.04),
        child: Text(
          tr(
              context,
              "Detects only drones that broadcast Remote ID over BLE/Wi-Fi, within ~100–300 m. Military, custom FPV and Remote-ID-off drones cannot be detected. A safety aid, not a guarantee.",
              "BLE/Wi-Fi ကနေ Remote ID ထုတ်လွှင့်တဲ့ ဒရုန်း (~၁၀၀–၃၀၀ မီတာ) ကိုသာ ဖမ်းနိုင်သည်။ စစ်ဘက်သုံး၊ ကိုယ်တိုင်ဆင် FPV၊ Remote ID ပိတ်ထားသော ဒရုန်းများကို မဖမ်းနိုင်ပါ။ အာမခံချက် မဟုတ်ပါ။"),
          style: const TextStyle(color: Colors.white38, fontSize: 11),
        ),
      );
}

class _RadarPainter extends CustomPainter {
  _RadarPainter(this.hits, this.sweep);
  final List<DroneHit> hits;
  final double sweep;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final maxR = math.min(size.width, size.height) / 2 - 12;
    final ring = Paint()
      ..color = const Color(0xFF2E9E5B).withValues(alpha: 0.35)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.2;
    for (var i = 1; i <= 3; i++) {
      canvas.drawCircle(center, maxR * i / 3, ring);
    }
    // Cross-hairs.
    canvas.drawLine(Offset(center.dx, center.dy - maxR),
        Offset(center.dx, center.dy + maxR), ring);
    canvas.drawLine(Offset(center.dx - maxR, center.dy),
        Offset(center.dx + maxR, center.dy), ring);

    // Sweep line.
    final ang = sweep * 2 * math.pi;
    canvas.drawLine(
      center,
      center + Offset(math.cos(ang), math.sin(ang)) * maxR,
      Paint()
        ..color = const Color(0xFF7ED957).withValues(alpha: 0.8)
        ..strokeWidth = 2,
    );

    // Blips — distance mapped to ring radius (cap ~600 m), stable angle by key.
    for (final h in hits) {
      final norm = (h.distanceM / 600).clamp(0.05, 1.0);
      final a = (h.key.hashCode % 360) * math.pi / 180;
      final p = center + Offset(math.cos(a), math.sin(a)) * (maxR * norm);
      final near = h.confirmed && h.distanceM <= 200;
      canvas.drawCircle(
        p,
        near ? 7 : 5,
        Paint()..color = near ? const Color(0xFFE23B54) : const Color(0xFFF0B429),
      );
    }

    // Centre = you.
    canvas.drawCircle(center, 5, Paint()..color = Colors.white);
  }

  @override
  bool shouldRepaint(covariant _RadarPainter old) => true;
}
