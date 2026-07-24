import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_blue_plus/flutter_blue_plus.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:wifi_scan/wifi_scan.dart';

import '../../core/i18n.dart';
import '../../core/theme.dart';
import 'drone_library_screen.dart';
import 'drone_map_screen.dart';
import 'drone_signatures.dart';

/// How a detection is classified.
enum HitClass { remoteId, drone, unusual, unknown }

/// A detected radio device — a drone, a controller, or any nearby BLE/Wi-Fi
/// signal. The scanner tracks EVERY signal (not just drone matches) so the
/// radar visibly works and can flag anomalies.
class DroneHit {
  DroneHit({
    required this.key,
    required this.label,
    required this.rssi,
    required this.source,
    this.vendor,
    this.kind = DroneKind.unknown,
    this.protocol,
    this.band,
    this.channel,
    this.ssid,
    this.mac,
    this.remoteId,
    this.sig,
    this.lat,
    this.lng,
    this.confirmed = false,
  }) {
    rssiHistory.add(rssi);
  }

  final String key;
  String label;
  int rssi;
  String source; // "BLE" or "WiFi"
  String? vendor;
  DroneKind kind;
  String? protocol;
  String? band;
  int? channel;
  String? ssid;
  String? mac;
  String? remoteId;
  DroneSignature? sig;
  double? lat;
  double? lng;
  bool confirmed; // parsed Remote ID
  DateTime seen = DateTime.now();
  final DateTime firstSeen = DateTime.now();
  final List<int> rssiHistory = [];

  void pushRssi(int v) {
    rssi = v;
    rssiHistory.add(v);
    if (rssiHistory.length > 20) rssiHistory.removeAt(0);
    seen = DateTime.now();
  }

  double get distanceM {
    const measuredPower = -59;
    const n = 2.7;
    return math.pow(10, (measuredPower - rssi) / (10 * n)).toDouble();
  }

  /// +1 approaching, -1 leaving, 0 steady.
  int get trend {
    if (rssiHistory.length < 6) return 0;
    final n = rssiHistory.length;
    final recent = rssiHistory.sublist(n - 3);
    final older = rssiHistory.sublist(n - 6, n - 3);
    final ra = recent.reduce((a, b) => a + b) / 3;
    final oa = older.reduce((a, b) => a + b) / 3;
    if (ra - oa > 3) return 1;
    if (oa - ra > 3) return -1;
    return 0;
  }

  bool get isDroneish => confirmed || vendor != null;

  /// An "unusual" signal worth flagging: any drone-vendor device, or an unknown
  /// device that is close AND actively approaching (something moving toward you)
  /// — while ignoring the many stationary Wi-Fi routers / BLE gadgets around.
  bool get unusual {
    if (confirmed) return false; // a confirmed drone is a threat, not "unusual"
    if (vendor != null) return true; // any known drone-maker device
    return trend > 0 && rssi >= -72; // unknown, close & getting closer
  }

  HitClass get klass {
    if (confirmed) return HitClass.remoteId;
    if (vendor != null) return HitClass.drone;
    if (unusual) return HitClass.unusual;
    return HitClass.unknown;
  }
}

/// Passive drone-detection radar. Listens (never transmits) on the phone's BLE
/// and Wi-Fi radios, tracks every nearby signal, matches drones against the
/// built-in [kDroneSignatures] database, flags anomalies (unknown signals that
/// approach) and alerts. Proprietary RC links (OcuSync, ELRS, Crossfire, FrSky,
/// analog FPV) still need an external SDR — see the capability panel. Works
/// offline. A safety aid, not a guarantee.
class DroneScannerScreen extends StatefulWidget {
  const DroneScannerScreen({super.key});

  @override
  State<DroneScannerScreen> createState() => _DroneScannerScreenState();
}

class _DroneScannerScreenState extends State<DroneScannerScreen>
    with SingleTickerProviderStateMixin {
  final Map<String, DroneHit> _hits = {};
  final List<_Alert> _alerts = [];
  final Set<String> _alerted = {}; // keys already alerted (avoid repeat buzz)
  StreamSubscription<List<ScanResult>>? _bleSub;
  Timer? _wifiTimer;
  Timer? _wifiScanTimer;
  Timer? _alarmTimer;
  Timer? _pruneTimer;
  bool _scanning = false;
  String? _error;
  String _filter = "priority"; // priority | all | drones | unusual
  late final AnimationController _sweep = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 3),
  )..repeat();

  static const _alertDistanceM = 200.0;

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
    _wifiScanTimer?.cancel();
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
        removeIfGone: const Duration(seconds: 15),
      );
      if (mounted) setState(() => _scanning = true);

      _triggerWifiScan();
      _wifiScanTimer = Timer.periodic(
          const Duration(seconds: 25), (_) => _triggerWifiScan());
      _readWifi();
      _wifiTimer =
          Timer.periodic(const Duration(seconds: 5), (_) => _readWifi());

      _pruneTimer = Timer.periodic(const Duration(seconds: 2), (_) => _prune());
    } catch (e) {
      if (mounted) setState(() => _error = "$e");
    }
  }

  // ---- Bluetooth LE — track EVERY device -----------------------------------

  void _onBle(List<ScanResult> results) {
    for (final r in results) {
      final k = r.device.remoteId.str;
      final odid = _parseOpenDroneId(r);
      final name = r.advertisementData.advName.trim();
      final hit = _hits[k] ??
          DroneHit(
            key: k,
            label: name.isEmpty
                ? tr(context, "Unknown BLE device", "အမည်မသိ BLE")
                : name,
            rssi: r.rssi,
            source: "BLE",
            mac: k,
          );
      hit.pushRssi(r.rssi);

      if (odid != null) {
        hit.confirmed = true;
        hit.protocol = "Remote ID";
        hit.kind = DroneKind.remoteId;
        if (odid.$1 != null && odid.$1!.isNotEmpty) {
          hit.remoteId = odid.$1;
          hit.label = "${tr(context, "Drone", "ဒရုန်း")} · ${odid.$1}";
        } else {
          hit.label = tr(context, "Drone (Remote ID)", "ဒရုန်း (Remote ID)");
        }
        if (odid.$2 != null) {
          hit.lat = odid.$2;
          hit.lng = odid.$3;
        }
      } else if (name.isNotEmpty && hit.sig == null) {
        final sig = matchSignature(name);
        if (sig != null) _applySig(hit, sig, name);
      }
      _hits[k] = hit;
    }
    if (mounted) setState(() {});
    _evaluate();
  }

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
      if (payload[0] != 0x0D) return null;
      final msg = payload.sublist(2);
      final type = (msg[0] >> 4) & 0x0F;
      String? id;
      double? lat, lng;
      if (type == 0 && msg.length >= 22) {
        final raw = msg.sublist(2, 22);
        id = String.fromCharCodes(raw.where((b) => b >= 32 && b < 127)).trim();
      } else if (type == 1 && msg.length >= 17) {
        lat = _int32le(msg, 5) / 1e7;
        lng = _int32le(msg, 9) / 1e7;
        if (lat.abs() > 90 || lng.abs() > 180 || (lat == 0 && lng == 0)) {
          lat = null;
          lng = null;
        }
      }
      return (id, lat, lng);
    } catch (_) {
      return ("", null, null);
    }
  }

  int _int32le(List<int> b, int o) {
    final v = b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24);
    return v >= 0x80000000 ? v - 0x100000000 : v;
  }

  // ---- Wi-Fi — track EVERY access point ------------------------------------

  Future<void> _triggerWifiScan() async {
    try {
      final can = await WiFiScan.instance.canStartScan();
      if (can == CanStartScan.yes) await WiFiScan.instance.startScan();
    } catch (_) {}
  }

  Future<void> _readWifi() async {
    try {
      final can = await WiFiScan.instance.canGetScannedResults();
      if (can != CanGetScannedResults.yes) return;
      final results = await WiFiScan.instance.getScannedResults();
      for (final a in results) {
        final ssid = a.ssid.trim();
        final k = "wifi:${a.bssid}";
        final hit = _hits[k] ??
            DroneHit(
              key: k,
              label: ssid.isEmpty
                  ? tr(context, "Hidden Wi-Fi", "ဖုံးထား Wi-Fi")
                  : ssid,
              rssi: a.level,
              source: "WiFi",
              ssid: ssid.isEmpty ? null : ssid,
              mac: a.bssid,
            );
        hit.pushRssi(a.level);
        hit.band = _bandFor(a.frequency);
        hit.channel = _channelFor(a.frequency);
        if (hit.sig == null) {
          final sig = ssid.isEmpty ? null : matchSignature(ssid);
          final ouiVendor = vendorForOui(a.bssid);
          if (sig != null) {
            _applySig(hit, sig, ssid.isEmpty ? "(${sig.vendor})" : ssid);
          } else if (ouiVendor != null) {
            hit.vendor = ouiVendor;
            hit.kind = DroneKind.drone;
            hit.label = "$ouiVendor · ${ssid.isEmpty ? "(hidden)" : ssid}";
          }
        }
        _hits[k] = hit;
      }
      if (mounted) setState(() {});
      _evaluate();
    } catch (_) {}
  }

  void _applySig(DroneHit hit, DroneSignature sig, String shownName) {
    hit.sig = sig;
    hit.vendor = sig.vendor;
    hit.kind = sig.kind;
    hit.protocol = sig.protocol;
    hit.label = "${sig.vendor} · $shownName";
  }

  String _bandFor(int mhz) {
    if (mhz >= 5925) return "6 GHz";
    if (mhz >= 4900) return "5 GHz";
    if (mhz >= 2400) return "2.4 GHz";
    return "$mhz MHz";
  }

  int? _channelFor(int mhz) {
    if (mhz == 2484) return 14;
    if (mhz >= 2412 && mhz <= 2472) return ((mhz - 2412) ~/ 5) + 1;
    if (mhz >= 5160 && mhz <= 5885) return (mhz - 5000) ~/ 5;
    return null;
  }

  // ---- Alerts + housekeeping ------------------------------------------------

  void _prune() {
    final now = DateTime.now();
    _hits.removeWhere((_, h) => now.difference(h.seen).inSeconds > 20);
    if (mounted) setState(() {});
    _evaluate();
  }

  bool get _threatActive => _hits.values.any((h) =>
      (h.confirmed && h.distanceM <= _alertDistanceM) ||
      (h.vendor != null && h.distanceM <= _alertDistanceM) ||
      h.unusual);

  /// Raise alerts for newly-noteworthy devices, and drive the buzzing alarm.
  void _evaluate() {
    for (final h in _hits.values) {
      if (_alerted.contains(h.key)) continue;
      String? reason;
      if (h.confirmed) {
        reason =
            tr(context, "Drone (Remote ID) detected", "ဒရုန်း (Remote ID) တွေ့");
      } else if (h.vendor != null) {
        reason = tr(context, "${h.vendor} device nearby", "${h.vendor} စက် အနီး");
      } else if (h.unusual) {
        reason = tr(context, "Unusual signal approaching",
            "ထူးခြား signal ချဉ်းကပ်လာ");
      }
      if (reason != null) {
        _alerted.add(h.key);
        _alerts.insert(0, _Alert(reason, h.label, DateTime.now()));
        if (_alerts.length > 40) _alerts.removeLast();
        HapticFeedback.heavyImpact();
      }
    }
    if (_threatActive) {
      _alarmTimer ??= Timer.periodic(const Duration(milliseconds: 1100), (_) {
        HapticFeedback.heavyImpact();
      });
    } else {
      _alarmTimer?.cancel();
      _alarmTimer = null;
    }
  }

  // ---- UI helpers -----------------------------------------------------------

  IconData _kindIcon(DroneHit h) {
    if (h.confirmed) return Icons.flight;
    switch (h.kind) {
      case DroneKind.controller:
        return Icons.sports_esports;
      case DroneKind.goggles:
        return Icons.visibility;
      case DroneKind.drone:
        return Icons.airplanemode_active;
      default:
        return h.source == "WiFi" ? Icons.wifi : Icons.bluetooth;
    }
  }

  Color _classColor(HitClass c) {
    switch (c) {
      case HitClass.remoteId:
        return const Color(0xFFE23B54);
      case HitClass.drone:
        return const Color(0xFF44C8FF);
      case HitClass.unusual:
        return const Color(0xFFF0B429);
      case HitClass.unknown:
        return Colors.white38;
    }
  }

  List<DroneHit> _visible() {
    var list = _hits.values.toList();
    switch (_filter) {
      case "drones":
        list = list.where((h) => h.isDroneish).toList();
        break;
      case "unusual":
        list = list.where((h) => h.unusual || h.confirmed).toList();
        break;
      case "all":
        break;
      default: // priority: drones + unusual first, unknowns after
        list.sort((a, b) {
          int rank(DroneHit h) =>
              h.confirmed ? 0 : (h.vendor != null ? 1 : (h.unusual ? 2 : 3));
          final r = rank(a).compareTo(rank(b));
          return r != 0 ? r : b.rssi.compareTo(a.rssi);
        });
        return list;
    }
    list.sort((a, b) => b.rssi.compareTo(a.rssi));
    return list;
  }

  @override
  Widget build(BuildContext context) {
    final hits = _visible();
    final threat = _threatActive;
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: Text(tr(context, "Drone radar", "ဒရုန်း ရေဒါ")),
        actions: [
          _alertsButton(),
          IconButton(
            tooltip: tr(context, "Signal library", "Signal စာကြည့်တိုက်"),
            icon: const Icon(Icons.menu_book_outlined),
            onPressed: () => Navigator.of(context).push(MaterialPageRoute(
                builder: (_) => const DroneLibraryScreen())),
          ),
          IconButton(
            tooltip: tr(context, "What can this detect?", "ဘာတွေ ဖမ်းနိုင်လဲ?"),
            icon: const Icon(Icons.info_outline),
            onPressed: _showCapabilities,
          ),
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
                _radar(_hits.values.toList()),
                _summaryBar(),
                _filterRow(),
                Expanded(child: _list(hits)),
                _disclaimer(context),
              ],
            ),
    );
  }

  Widget _alertsButton() {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        IconButton(
          tooltip: tr(context, "Alerts", "သတိပေးချက်များ"),
          icon: const Icon(Icons.notifications_none),
          onPressed: _showAlerts,
        ),
        if (_alerts.isNotEmpty)
          Positioned(
            right: 6,
            top: 6,
            child: Container(
              padding: const EdgeInsets.all(4),
              decoration: const BoxDecoration(
                  color: GwColors.live, shape: BoxShape.circle),
              constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
              child: Text("${_alerts.length}",
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                      color: Colors.white,
                      fontSize: 10,
                      fontWeight: FontWeight.w900)),
            ),
          ),
      ],
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
              tr(context, "⚠ Signal alert — check the list",
                  "⚠ Signal သတိပေးချက် — စာရင်း စစ်ပါ"),
              style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w900,
                  fontSize: 15),
            ),
          ],
        ),
      );

  Widget _summaryBar() {
    final all = _hits.values;
    final rid = all.where((h) => h.confirmed).length;
    final drones = all.where((h) => h.vendor != null).length;
    final unusual = all.where((h) => h.unusual).length;
    Widget cell(String v, String label, Color c) => Column(
          children: [
            Text(v,
                style: TextStyle(
                    color: c, fontWeight: FontWeight.w900, fontSize: 18)),
            Text(label,
                style: const TextStyle(color: Colors.white38, fontSize: 10.5)),
          ],
        );
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 8),
      decoration: const BoxDecoration(
        border: Border(
            bottom: BorderSide(color: Colors.white10),
            top: BorderSide(color: Colors.white10)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: [
          cell("${all.length}", tr(context, "Signals", "signal"), Colors.white),
          cell("$rid", "Remote ID", const Color(0xFFE23B54)),
          cell("$drones", tr(context, "Drone", "ဒရုန်း"),
              const Color(0xFF44C8FF)),
          cell("$unusual", tr(context, "Unusual", "ထူးခြား"),
              const Color(0xFFF0B429)),
        ],
      ),
    );
  }

  Widget _filterRow() {
    final chips = <(String, String)>[
      ("priority", tr(context, "Priority", "ဦးစားပေး")),
      ("all", tr(context, "All", "အားလုံး")),
      ("drones", tr(context, "Drones", "ဒရုန်း")),
      ("unusual", tr(context, "Unusual", "ထူးခြား")),
    ];
    return SizedBox(
      height: 44,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        children: [
          for (final c in chips)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: ChoiceChip(
                label: Text(c.$2),
                selected: _filter == c.$1,
                selectedColor: GwColors.primary,
                backgroundColor: Colors.white.withValues(alpha: 0.06),
                labelStyle: TextStyle(
                    color: _filter == c.$1 ? Colors.white : Colors.white70,
                    fontSize: 12.5),
                onSelected: (_) => setState(() => _filter = c.$1),
              ),
            ),
        ],
      ),
    );
  }

  Widget _radar(List<DroneHit> hits) {
    return SizedBox(
      height: 210,
      child: AnimatedBuilder(
        animation: _sweep,
        builder: (_, __) => CustomPaint(
          size: Size.infinite,
          painter: _RadarPainter(hits, _sweep.value, _classColor),
        ),
      ),
    );
  }

  Widget _list(List<DroneHit> hits) {
    if (hits.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                _scanning
                    ? tr(context, "Scanning…", "ရှာဖွေနေသည်…")
                    : tr(context, "Idle", "ရပ်နားနေသည်"),
                style: const TextStyle(color: Colors.white38),
              ),
              const SizedBox(height: 8),
              TextButton.icon(
                onPressed: _showCapabilities,
                icon: const Icon(Icons.help_outline,
                    size: 16, color: Colors.white38),
                label: Text(
                    tr(context, "Why nothing shows?", "ဘာလို့ မပေါ်တာလဲ?"),
                    style: const TextStyle(color: Colors.white38)),
              ),
            ],
          ),
        ),
      );
    }
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(14, 8, 14, 8),
      itemCount: hits.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (_, i) => _rowTile(hits[i]),
    );
  }

  Widget _rowTile(DroneHit h) {
    final d = h.distanceM;
    final c = _classColor(h.klass);
    final near = (h.confirmed || h.vendor != null) && d <= _alertDistanceM;
    final trend = h.trend;
    final trendIcon = trend > 0
        ? Icons.trending_up
        : (trend < 0 ? Icons.trending_down : Icons.trending_flat);
    final q = ((h.rssi + 100) / 60).clamp(0.0, 1.0);
    return InkWell(
      borderRadius: BorderRadius.circular(GwRadius.md),
      onTap: () => _showDetail(h),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: h.unusual
              ? const Color(0xFFF0B429).withValues(alpha: 0.12)
              : (near
                  ? GwColors.live.withValues(alpha: 0.14)
                  : Colors.white.withValues(alpha: 0.05)),
          borderRadius: BorderRadius.circular(GwRadius.md),
          border: Border.all(
              color: h.klass == HitClass.unknown
                  ? Colors.white.withValues(alpha: 0.1)
                  : c.withValues(alpha: 0.5)),
        ),
        child: Row(
          children: [
            Icon(_kindIcon(h), color: c),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(h.label,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w700)),
                      ),
                      if (h.unusual) ...[
                        const SizedBox(width: 6),
                        const Icon(Icons.priority_high,
                            size: 15, color: Color(0xFFF0B429)),
                      ],
                      const SizedBox(width: 4),
                      Icon(trendIcon,
                          size: 15,
                          color: trend > 0
                              ? GwColors.live
                              : (trend < 0
                                  ? const Color(0xFF7ED957)
                                  : Colors.white30)),
                    ],
                  ),
                  Text(
                    [
                      if (h.protocol != null) h.protocol!,
                      h.source,
                      if (h.band != null) h.band!,
                      "${h.rssi} dBm",
                      "≈ ${d < 1000 ? "${d.round()} m" : "${(d / 1000).toStringAsFixed(1)} km"}",
                    ].join(" · "),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(color: Colors.white54, fontSize: 12),
                  ),
                  if (h.lat != null)
                    Text(
                        "📍 ${h.lat!.toStringAsFixed(5)}, ${h.lng!.toStringAsFixed(5)}",
                        style: const TextStyle(
                            color: Colors.white54, fontSize: 12)),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Row(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                for (var b = 0; b < 4; b++)
                  Padding(
                    padding: const EdgeInsets.only(left: 2),
                    child: Container(
                      width: 4,
                      height: 6.0 + b * 4,
                      decoration: BoxDecoration(
                        color: q * 4 > b ? c : Colors.white24,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  void _showDetail(DroneHit h) {
    final d = h.distanceM;
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF161719),
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(18))),
      builder: (_) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(_kindIcon(h), color: _classColor(h.klass)),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(h.sig?.title ?? h.label,
                      style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w900,
                          fontSize: 17)),
                ),
              ],
            ),
            const SizedBox(height: 14),
            if (h.vendor != null)
              _detailRow(tr(context, "Maker", "ထုတ်လုပ်သူ"), h.vendor!),
            if (h.protocol != null)
              _detailRow(tr(context, "Radio link", "လှိုင်း link"), h.protocol!),
            _detailRow(tr(context, "Detected via", "တွေ့ရသည့်လမ်း"),
                h.confirmed ? "Remote ID (${h.source})" : h.source),
            if (h.band != null)
              _detailRow(tr(context, "Band", "လှိုင်း"),
                  "${h.band}${h.channel != null ? "  ·  ch ${h.channel}" : ""}"),
            _detailRow("RSSI", "${h.rssi} dBm"),
            _detailRow(tr(context, "Distance (est.)", "အကွာအဝေး (ခန့်)"),
                d < 1000
                    ? "≈ ${d.round()} m"
                    : "≈ ${(d / 1000).toStringAsFixed(1)} km"),
            _detailRow(
                tr(context, "Proximity", "ချဉ်းကပ်မှု"),
                h.trend > 0
                    ? tr(context, "Approaching ↑", "ချဉ်းကပ်လာ ↑")
                    : (h.trend < 0
                        ? tr(context, "Moving away ↓", "ဝေးသွား ↓")
                        : tr(context, "Steady", "တည်ငြိမ်"))),
            if (h.ssid != null) _detailRow("SSID", h.ssid!),
            if (h.mac != null) _detailRow("MAC / ID", h.mac!),
            if (h.remoteId != null && h.remoteId!.isNotEmpty)
              _detailRow("Remote ID", h.remoteId!),
            if (h.lat != null)
              _detailRow(tr(context, "Drone GPS", "ဒရုန်း GPS"),
                  "${h.lat!.toStringAsFixed(5)}, ${h.lng!.toStringAsFixed(5)}"),
            const SizedBox(height: 10),
            Text(
              h.sig != null
                  ? tr(context, h.sig!.noteEn, h.sig!.noteMy)
                  : (h.confirmed
                      ? tr(context, "Broadcasting Remote ID — high confidence.",
                          "Remote ID ထုတ်လွှင့် — ယုံကြည်ရမှုမြင့်။")
                      : (h.unusual
                          ? tr(context,
                              "Unknown signal that is close and approaching — worth a look.",
                              "အနီးရောက်ပြီး ချဉ်းကပ်လာတဲ့ အမည်မသိ signal — ဂရုစိုက်သင့်။")
                          : tr(context,
                              "A nearby Wi-Fi/BLE device. Not identified as a drone.",
                              "အနီးက Wi-Fi/BLE စက်။ ဒရုန်းအဖြစ် မသတ်မှတ်ရသေး။"))),
              style: const TextStyle(color: Colors.white54, fontSize: 12.5),
            ),
          ],
        ),
      ),
    );
  }

  Widget _detailRow(String k, String v) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 5),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
                width: 132,
                child: Text(k,
                    style:
                        const TextStyle(color: Colors.white54, fontSize: 13))),
            Expanded(
              child: Text(v,
                  style: const TextStyle(
                      color: Colors.white,
                      fontSize: 13,
                      fontWeight: FontWeight.w600)),
            ),
          ],
        ),
      );

  void _showAlerts() {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF161719),
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(18))),
      builder: (_) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text(tr(context, "Alerts", "သတိပေးချက်များ"),
                    style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w900,
                        fontSize: 18)),
                const Spacer(),
                if (_alerts.isNotEmpty)
                  TextButton(
                      onPressed: () {
                        setState(_alerts.clear);
                        Navigator.pop(context);
                      },
                      child: Text(tr(context, "Clear", "ရှင်း"))),
              ],
            ),
            const SizedBox(height: 4),
            if (_alerts.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 20),
                child: Text(
                    tr(context,
                        "No alerts yet. You'll be buzzed when a drone or an unusual signal appears.",
                        "သတိပေးချက် မရှိသေး။ ဒရုန်း/ထူးခြား signal ပေါ်ရင် တုန်ခါ သတိပေးပါမယ်။"),
                    style: const TextStyle(color: Colors.white54)),
              )
            else
              ..._alerts.take(30).map((a) => Padding(
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    child: Row(
                      children: [
                        const Icon(Icons.warning_amber,
                            color: Color(0xFFF0B429), size: 18),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(a.reason,
                                  style: const TextStyle(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w700)),
                              Text(a.label,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                      color: Colors.white54, fontSize: 12)),
                            ],
                          ),
                        ),
                        Text(_hhmm(a.at),
                            style: const TextStyle(
                                color: Colors.white38, fontSize: 12)),
                      ],
                    ),
                  )),
          ],
        ),
      ),
    );
  }

  String _hhmm(DateTime t) =>
      "${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}";

  void _showCapabilities() {
    Widget line(IconData icon, Color c, String s) => Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, color: c, size: 18),
              const SizedBox(width: 10),
              Expanded(
                child: Text(s,
                    style:
                        const TextStyle(color: Colors.white70, fontSize: 13)),
              ),
            ],
          ),
        );
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF161719),
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(18))),
      builder: (_) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.8,
        maxChildSize: 0.92,
        builder: (_, controller) => ListView(
          controller: controller,
          padding: const EdgeInsets.fromLTRB(20, 18, 20, 28),
          children: [
            Text(
                tr(context, "How this radar works", "ဒီ ရေဒါ ဘယ်လိုအလုပ်လုပ်လဲ"),
                style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w900,
                    fontSize: 18)),
            const SizedBox(height: 6),
            Text(
              tr(context,
                  "It now lists EVERY nearby Wi-Fi and Bluetooth signal, highlights drones from the built-in database, and buzzes you for an unusual signal — an unknown device that is close and moving toward you.",
                  "အခု အနီးက Wi-Fi/Bluetooth signal အားလုံးကို ပြ၊ database ထဲက ဒရုန်းတွေကို မီးမောင်းထိုးပြ၊ ထူးခြား signal (အနီးရောက်ပြီး ချဉ်းကပ်လာတဲ့ အမည်မသိစက်) ဆိုရင် တုန်ခါ သတိပေးတယ်။"),
              style: const TextStyle(color: Colors.white54, fontSize: 12.5),
            ),
            const SizedBox(height: 14),
            Text(tr(context, "✔ CAN detect", "✔ ဖမ်းနိုင်သည်"),
                style: const TextStyle(
                    color: Color(0xFF7ED957), fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            line(Icons.flight, const Color(0xFF7ED957),
                tr(context,
                    "Remote-ID drones (BLE/Wi-Fi) — most drones sold since 2023, often with live GPS.",
                    "Remote-ID ဒရုန်းများ (BLE/Wi-Fi) — GPS ပါတတ်။")),
            line(Icons.wifi, const Color(0xFF7ED957),
                tr(context,
                    "Wi-Fi drones & controllers (DJI Wi-Fi, Tello, Parrot, Autel…) by SSID + maker MAC.",
                    "Wi-Fi ဒရုန်း/ကွန်ထရိုလာ — SSID + MAC ဖြင့်။")),
            line(Icons.priority_high, const Color(0xFFF0B429),
                tr(context,
                    "Unusual signals — any unknown device that is close and approaching.",
                    "ထူးခြား signal — အနီးရောက်ပြီး ချဉ်းကပ်လာတဲ့ အမည်မသိစက်။")),
            const SizedBox(height: 16),
            Text(
                tr(context, "✘ CANNOT detect (needs an external SDR)",
                    "✘ မဖမ်းနိုင် (SDR အပို လိုသည်)"),
                style: const TextStyle(
                    color: Color(0xFFE23B54), fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            line(Icons.videocam_off, const Color(0xFFE23B54),
                tr(context,
                    "DJI OcuSync (Avata, Mavic, Mini 3/4, DJI FPV) — proprietary link, not Wi-Fi/BLE.",
                    "DJI OcuSync (Avata, Mavic…) — Wi-Fi/BLE မဟုတ်။")),
            line(Icons.settings_remote, const Color(0xFFE23B54),
                tr(context,
                    "RC links — ELRS, Crossfire, FrSky — 900 MHz/2.4 GHz FHSS a phone can't tune.",
                    "ELRS, Crossfire, FrSky — ဖုန်းက မဖမ်းနိုင်။")),
            const SizedBox(height: 12),
            Text(
              tr(context,
                  "Tip: your DJI Avata (O3) and the ELRS/Crossfire quad won't appear — those bands need an SDR. Fly a Remote-ID drone nearby to see the radar light up.",
                  "မှတ်ချက်— DJI Avata (O3) နဲ့ ELRS/Crossfire quad မပေါ်ပါ (SDR လို)။ Remote-ID ဒရုန်းဆို ပေါ်ပါမယ်။"),
              style: const TextStyle(color: Colors.white38, fontSize: 12),
            ),
          ],
        ),
      ),
    );
  }

  Widget _disclaimer(BuildContext context) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(12),
        color: Colors.white.withValues(alpha: 0.04),
        child: Text(
          tr(
              context,
              "Lists all nearby Wi-Fi/BLE signals, flags drones + unusual approaching signals, and buzzes you. DJI OcuSync, ELRS, Crossfire, FrSky & analog FPV need an external SDR — tap ⓘ. A safety aid, not a guarantee.",
              "အနီးက Wi-Fi/BLE signal အားလုံး ပြ၊ ဒရုန်း + ချဉ်းကပ်လာ ထူးခြား signal သတိပေး။ DJI OcuSync၊ ELRS၊ Crossfire၊ FrSky၊ analog FPV အတွက် SDR လို — ⓘ ။ အာမခံ မဟုတ်။"),
          style: const TextStyle(color: Colors.white38, fontSize: 11),
        ),
      );
}

class _Alert {
  _Alert(this.reason, this.label, this.at);
  final String reason;
  final String label;
  final DateTime at;
}

class _RadarPainter extends CustomPainter {
  _RadarPainter(this.hits, this.sweep, this.colorOf);
  final List<DroneHit> hits;
  final double sweep;
  final Color Function(HitClass) colorOf;

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
    canvas.drawLine(Offset(center.dx, center.dy - maxR),
        Offset(center.dx, center.dy + maxR), ring);
    canvas.drawLine(Offset(center.dx - maxR, center.dy),
        Offset(center.dx + maxR, center.dy), ring);

    final ang = sweep * 2 * math.pi;
    canvas.drawLine(
      center,
      center + Offset(math.cos(ang), math.sin(ang)) * maxR,
      Paint()
        ..color = const Color(0xFF7ED957).withValues(alpha: 0.8)
        ..strokeWidth = 2,
    );

    for (final h in hits) {
      final norm = (h.distanceM / 600).clamp(0.05, 1.0);
      final a = (h.key.hashCode % 360) * math.pi / 180;
      final p = center + Offset(math.cos(a), math.sin(a)) * (maxR * norm);
      final c = colorOf(h.klass);
      final big = h.confirmed || h.vendor != null || h.unusual;
      if (big) {
        canvas.drawCircle(p, 9, Paint()..color = c.withValues(alpha: 0.25));
      }
      canvas.drawCircle(p, big ? 6 : 3.5, Paint()..color = c);
    }

    canvas.drawCircle(center, 5, Paint()..color = Colors.white);
  }

  @override
  bool shouldRepaint(covariant _RadarPainter old) => true;
}
