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

/// A detected drone / controller / drone-like radio signal.
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

  final String key; // BSSID / BLE id — dedup key
  String label;
  int rssi;
  final String source; // "BLE", "WiFi", "Remote ID"
  String? vendor;
  DroneKind kind;
  String? protocol; // radio link, from the signature DB
  String? band; // "2.4 GHz" / "5 GHz" / "6 GHz"
  int? channel;
  String? ssid;
  String? mac;
  String? remoteId; // operator / serial from Remote ID
  DroneSignature? sig; // matched catalogue entry (for rich detail)
  double? lat;
  double? lng;
  bool confirmed; // true = parsed Remote ID (high confidence)
  DateTime seen = DateTime.now();
  final List<int> rssiHistory = [];

  void pushRssi(int v) {
    rssi = v;
    rssiHistory.add(v);
    if (rssiHistory.length > 20) rssiHistory.removeAt(0);
    seen = DateTime.now();
  }

  /// Rough distance (m) from RSSI: d = 10^((measuredPower - rssi)/(10*n)).
  double get distanceM {
    const measuredPower = -59; // RSSI at 1 m
    const n = 2.7; // path-loss exponent (open-ish air)
    return math.pow(10, (measuredPower - rssi) / (10 * n)).toDouble();
  }

  /// Signal trend from RSSI history: +1 approaching, -1 leaving, 0 steady.
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
}

/// Passive drone-detection radar. The phone listens (never transmits) for the
/// radios a drone or its controller exposes — Bluetooth LE Remote ID (Open
/// Drone ID / ASTM F3411) and Wi-Fi — and matches each hit against the built-in
/// [kDroneSignatures] database to name it and show its protocol/band. It cannot
/// see proprietary RC links (OcuSync, ELRS, Crossfire, FrSky, analog FPV); the
/// "What can this detect?" panel and the Signal library explain why. Works
/// fully offline. A safety aid, not a guarantee.
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
  Timer? _wifiScanTimer;
  Timer? _alarmTimer;
  Timer? _pruneTimer;
  bool _scanning = false;
  String? _error;
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
        removeIfGone: const Duration(seconds: 20),
      );
      if (mounted) setState(() => _scanning = true);

      // Trigger fresh Wi-Fi scans (OS-throttled) and read results more often —
      // reading alone returns cached data, so without startScan the list never
      // refreshes.
      _triggerWifiScan();
      _wifiScanTimer = Timer.periodic(
          const Duration(seconds: 30), (_) => _triggerWifiScan());
      _readWifi();
      _wifiTimer =
          Timer.periodic(const Duration(seconds: 6), (_) => _readWifi());

      _pruneTimer = Timer.periodic(const Duration(seconds: 2), (_) => _prune());
    } catch (e) {
      if (mounted) setState(() => _error = "$e");
    }
  }

  // ---- Bluetooth LE (Open Drone ID + vendor names) -------------------------

  void _onBle(List<ScanResult> results) {
    for (final r in results) {
      final k = r.device.remoteId.str;
      final odid = _parseOpenDroneId(r);
      final name = r.advertisementData.advName.trim();

      if (odid != null) {
        final hit = _hits[k] ??
            DroneHit(
                key: k,
                label: tr(context, "Drone (Remote ID)", "ဒရုန်း (Remote ID)"),
                rssi: r.rssi,
                source: "Remote ID",
                mac: k,
                protocol: "Remote ID",
                kind: DroneKind.remoteId,
                confirmed: true);
        hit.pushRssi(r.rssi);
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
      } else if (name.isNotEmpty) {
        final sig = matchSignature(name);
        if (sig != null) {
          final hit = _hits[k] ??
              DroneHit(
                  key: k,
                  label: "${sig.vendor} · $name",
                  rssi: r.rssi,
                  source: "BLE",
                  mac: k);
          hit.pushRssi(r.rssi);
          _applySig(hit, sig, name);
          _hits[k] = hit;
        }
      }
    }
    if (mounted) setState(() {});
    _evaluateAlarm();
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
      if (payload[0] != 0x0D) return null; // ODID app code
      final msg = payload.sublist(2);
      final header = msg[0];
      final type = (header >> 4) & 0x0F;

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

  // ---- Wi-Fi (SSID + OUI vendor) via signature DB --------------------------

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
        final sig = ssid.isEmpty ? null : matchSignature(ssid);
        final ouiVendor = vendorForOui(a.bssid);
        if (sig == null && ouiVendor == null) continue; // not drone-like

        final k = a.bssid;
        final shownName = ssid.isEmpty ? "(${sig?.vendor ?? ouiVendor})" : ssid;
        final hit = _hits[k] ??
            DroneHit(
                key: k,
                label: "${sig?.vendor ?? ouiVendor} · $shownName",
                rssi: a.level,
                source: "WiFi",
                ssid: ssid.isEmpty ? null : ssid,
                mac: a.bssid);
        hit.pushRssi(a.level);
        hit.band = _bandFor(a.frequency);
        hit.channel = _channelFor(a.frequency);
        if (sig != null) {
          _applySig(hit, sig, shownName);
        } else {
          hit.vendor = ouiVendor;
          hit.kind = DroneKind.drone;
          hit.label = "$ouiVendor · $shownName";
        }
        _hits[k] = hit;
      }
      if (mounted) setState(() {});
      _evaluateAlarm();
    } catch (_) {}
  }

  /// Copy a catalogue match onto a hit.
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

  // ---- Alarm + housekeeping -------------------------------------------------

  void _prune() {
    final now = DateTime.now();
    _hits.removeWhere((_, h) => now.difference(h.seen).inSeconds > 25);
    if (mounted) setState(() {});
    _evaluateAlarm();
  }

  bool get _threat => _hits.values.any((h) =>
      h.confirmed &&
      h.distanceM <= _alertDistanceM &&
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

  // ---- UI helpers -----------------------------------------------------------

  IconData _kindIcon(DroneKind k) {
    switch (k) {
      case DroneKind.controller:
        return Icons.sports_esports;
      case DroneKind.goggles:
        return Icons.visibility;
      case DroneKind.remoteId:
        return Icons.flight;
      case DroneKind.drone:
        return Icons.airplanemode_active;
      case DroneKind.unknown:
        return Icons.wifi_tethering;
    }
  }

  String _kindLabel(DroneKind k) {
    switch (k) {
      case DroneKind.controller:
        return tr(context, "Controller", "ကွန်ထရိုလာ");
      case DroneKind.goggles:
        return tr(context, "Goggles", "မျက်မှန်");
      case DroneKind.remoteId:
        return tr(context, "Drone (Remote ID)", "ဒရုန်း (Remote ID)");
      case DroneKind.drone:
        return tr(context, "Drone", "ဒရုန်း");
      case DroneKind.unknown:
        return tr(context, "Signal", "signal");
    }
  }

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
                _radar(hits),
                _summaryBar(hits),
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

  Widget _summaryBar(List<DroneHit> hits) {
    final rid = hits.where((h) => h.confirmed).length;
    final wifi = hits.where((h) => h.source == "WiFi").length;
    final ble = hits.where((h) => h.source == "BLE").length;
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
          cell("${hits.length}", tr(context, "Total", "စုစုပေါင်း"),
              Colors.white),
          cell("$rid", tr(context, "Remote ID", "Remote ID"),
              const Color(0xFFE23B54)),
          cell("$wifi", "Wi-Fi", const Color(0xFF44C8FF)),
          cell("$ble", "BLE", const Color(0xFFF0B429)),
        ],
      ),
    );
  }

  Widget _radar(List<DroneHit> hits) {
    return SizedBox(
      height: 250,
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
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                _scanning
                    ? tr(context, "Scanning for drones…", "ဒရုန်း ရှာဖွေနေသည်…")
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
    final near = h.confirmed && d <= _alertDistanceM;
    final trend = h.trend;
    final trendIcon = trend > 0
        ? Icons.trending_up
        : (trend < 0 ? Icons.trending_down : Icons.trending_flat);
    final trendColor = trend > 0
        ? GwColors.live
        : (trend < 0 ? const Color(0xFF7ED957) : Colors.white38);
    final q = ((h.rssi + 100) / 60).clamp(0.0, 1.0);
    return InkWell(
      borderRadius: BorderRadius.circular(GwRadius.md),
      onTap: () => _showDetail(h),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: near
              ? GwColors.live.withValues(alpha: 0.16)
              : Colors.white.withValues(alpha: 0.06),
          borderRadius: BorderRadius.circular(GwRadius.md),
          border: Border.all(
              color:
                  near ? GwColors.live : Colors.white.withValues(alpha: 0.12)),
        ),
        child: Row(
          children: [
            Icon(_kindIcon(h.kind),
                color: near
                    ? GwColors.live
                    : (h.confirmed ? const Color(0xFFE23B54) : Colors.white70)),
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
                      const SizedBox(width: 6),
                      Icon(trendIcon, size: 15, color: trendColor),
                    ],
                  ),
                  Text(
                    [
                      _kindLabel(h.kind),
                      if (h.protocol != null) h.protocol!,
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
            Column(
              mainAxisSize: MainAxisSize.min,
              children: [
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
                            color: q * 4 > b
                                ? (near ? GwColors.live : Colors.white)
                                : Colors.white24,
                            borderRadius: BorderRadius.circular(2),
                          ),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 2),
                Icon(Icons.chevron_right,
                    size: 16, color: Colors.white.withValues(alpha: 0.3)),
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
                Icon(_kindIcon(h.kind),
                    color: h.confirmed
                        ? const Color(0xFFE23B54)
                        : const Color(0xFF44C8FF)),
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
            _detailRow(tr(context, "Type", "အမျိုးအစား"), _kindLabel(h.kind)),
            if (h.vendor != null)
              _detailRow(tr(context, "Maker", "ထုတ်လုပ်သူ"), h.vendor!),
            if (h.protocol != null)
              _detailRow(tr(context, "Radio link", "လှိုင်း link"), h.protocol!),
            _detailRow(tr(context, "Detected via", "တွေ့ရသည့်လမ်း"),
                h.confirmed ? "Remote ID (${h.source})" : h.source),
            if (h.band != null)
              _detailRow(tr(context, "Band", "လှိုင်းအမျိုးအစား"),
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
                      ? tr(context,
                          "Broadcasting Remote ID — high-confidence detection.",
                          "Remote ID ထုတ်လွှင့်နေသည် — ယုံကြည်ရမှုမြင့်။")
                      : tr(context,
                          "Detected by its Wi-Fi/BLE radio. Distance is a rough RSSI estimate.",
                          "Wi-Fi/BLE လှိုင်းဖြင့် တွေ့ရှိ။ အကွာအဝေး RSSI ခန့်မှန်းသာ။")),
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
        initialChildSize: 0.78,
        maxChildSize: 0.92,
        builder: (_, controller) => ListView(
          controller: controller,
          padding: const EdgeInsets.fromLTRB(20, 18, 20, 28),
          children: [
            Text(
                tr(context, "What can this radar detect?",
                    "ဒီ ရေဒါက ဘာတွေ ဖမ်းနိုင်လဲ?"),
                style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w900,
                    fontSize: 18)),
            const SizedBox(height: 6),
            Text(
              tr(context,
                  "A phone can only listen with its Wi-Fi and Bluetooth radios. That limits what is physically possible:",
                  "ဖုန်းဟာ Wi-Fi နဲ့ Bluetooth လှိုင်းတွေနဲ့ပဲ နားထောင်နိုင်တယ်။ ဒါကြောင့် အမှန်တကယ် ဖမ်းနိုင်တာက ကန့်သတ်ရှိတယ်—"),
              style: const TextStyle(color: Colors.white54, fontSize: 12.5),
            ),
            const SizedBox(height: 14),
            Text(tr(context, "✔ CAN detect", "✔ ဖမ်းနိုင်သည်"),
                style: const TextStyle(
                    color: Color(0xFF7ED957), fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            line(Icons.flight, const Color(0xFF7ED957),
                tr(context,
                    "Remote ID drones (BLE / Wi-Fi) — most drones sold since 2023 broadcast this, often with live GPS.",
                    "Remote ID ဒရုန်းများ (BLE / Wi-Fi) — ၂၀၂၃ နောက်ပိုင်း ဒရုန်းအများစု ထုတ်လွှင့်—GPS ပါတတ်။")),
            line(Icons.wifi, const Color(0xFF7ED957),
                tr(context,
                    "Wi-Fi drones & controllers running as a hotspot — DJI Wi-Fi, Tello, Parrot, Autel, Hubsan, FIMI… by SSID + maker MAC (OUI), with band + channel.",
                    "Wi-Fi hotspot လုပ်နေတဲ့ ဒရုန်း/ကွန်ထရိုလာ — DJI Wi-Fi၊ Tello၊ Parrot၊ Autel၊ Hubsan၊ FIMI… SSID + MAC (OUI) ဖြင့်။")),
            const SizedBox(height: 16),
            Text(
                tr(context,
                    "✘ CANNOT detect (needs an external SDR receiver)",
                    "✘ မဖမ်းနိုင် (SDR receiver အပို လိုသည်)"),
                style: const TextStyle(
                    color: Color(0xFFE23B54), fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            line(Icons.videocam_off, const Color(0xFFE23B54),
                tr(context,
                    "DJI OcuSync (O2/O3/O4) — Avata, Mavic, Mini 3/4, DJI FPV. Proprietary hopping link, not Wi-Fi/BLE.",
                    "DJI OcuSync (O2/O3/O4) — Avata၊ Mavic၊ Mini 3/4၊ DJI FPV။ သီးသန့် hopping link၊ Wi-Fi/BLE မဟုတ်။")),
            line(Icons.settings_remote, const Color(0xFFE23B54),
                tr(context,
                    "RC links — ExpressLRS (ELRS), TBS Crossfire/Tracer, FrSky, Spektrum, Flysky. FHSS on 900 MHz / 2.4 GHz a phone can't tune.",
                    "RC link — ExpressLRS (ELRS)၊ TBS Crossfire/Tracer၊ FrSky၊ Spektrum၊ Flysky။ ၉၀၀MHz/၂.၄GHz FHSS၊ ဖုန်းက မဖမ်းနိုင်။")),
            line(Icons.blur_on, const Color(0xFFE23B54),
                tr(context,
                    "Analog / digital FPV video (5.8 GHz) and any Remote-ID-off or custom-firmware drone.",
                    "Analog/digital FPV ဗီဒီယို (၅.၈GHz) နဲ့ Remote-ID ပိတ်/custom firmware ဒရုန်း။")),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.05),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.white12),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.usb, color: Color(0xFF44C8FF), size: 18),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      tr(context,
                          "To catch OcuSync / ELRS / Crossfire / FrSky you need an external USB SDR (RTL-SDR / HackRF) or a dedicated RF detector. That hardware integration is on our roadmap.",
                          "OcuSync / ELRS / Crossfire / FrSky ဖမ်းချင်ရင် USB SDR (RTL-SDR / HackRF) (သို့) သီးသန့် RF detector လိုသည်။ ဒီ hardware ချိတ်ဆက်မှုကို ရှေ့ဆက်ထည့်ပါမယ်။"),
                      style: const TextStyle(
                          color: Colors.white70, fontSize: 12.5),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () {
                  Navigator.pop(context);
                  Navigator.of(context).push(MaterialPageRoute(
                      builder: (_) => const DroneLibraryScreen()));
                },
                icon: const Icon(Icons.menu_book_outlined,
                    color: Colors.white70),
                label: Text(
                    tr(context, "Open the Signal library",
                        "Signal စာကြည့်တိုက် ဖွင့်ရန်"),
                    style: const TextStyle(color: Colors.white)),
                style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: Colors.white24),
                    padding: const EdgeInsets.symmetric(vertical: 12)),
              ),
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
              "Detects Remote-ID (BLE/Wi-Fi) drones + Wi-Fi drones/controllers within ~100–300 m. DJI OcuSync, ELRS, Crossfire, FrSky & analog FPV need an external SDR — tap ⓘ. A safety aid, not a guarantee.",
              "Remote-ID (BLE/Wi-Fi) ဒရုန်း + Wi-Fi ဒရုန်း/ကွန်ထရိုလာ (~၁၀၀–၃၀၀m) ကို ဖမ်းသည်။ DJI OcuSync၊ ELRS၊ Crossfire၊ FrSky၊ analog FPV အတွက် SDR အပို လိုသည် — ⓘ ကိုနှိပ်ပါ။ အာမခံချက် မဟုတ်ပါ။"),
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
      final near = h.confirmed && h.distanceM <= 200;
      final color = h.confirmed
          ? const Color(0xFFE23B54)
          : (h.source == "WiFi"
              ? const Color(0xFF44C8FF)
              : const Color(0xFFF0B429));
      canvas.drawCircle(p, near ? 7 : 5, Paint()..color = color);
    }

    canvas.drawCircle(center, 5, Paint()..color = Colors.white);
  }

  @override
  bool shouldRepaint(covariant _RadarPainter old) => true;
}
