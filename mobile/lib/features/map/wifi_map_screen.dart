import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';
import 'package:wifi_scan/wifi_scan.dart';

import '../../core/app_state.dart';
import '../../core/config.dart';
import '../../core/i18n.dart';
import '../../core/theme.dart';
import '../../widgets/signal_meter.dart';
import 'offline_tiles.dart';

/// WiGLE-style crowdsourced WiFi map. Scanning nearby access points at your GPS
/// location contributes them to a shared map everyone can browse — the more
/// people scan, the richer the coverage.
class WifiMapScreen extends StatefulWidget {
  const WifiMapScreen({super.key});

  @override
  State<WifiMapScreen> createState() => _WifiMapScreenState();
}

class _WifiMapScreenState extends State<WifiMapScreen> {
  static const LatLng _fallback = LatLng(16.8, 96.15); // Yangon
  final MapController _map = MapController();

  LatLng? _me;
  List<Map<String, dynamic>> _points = [];
  bool _scanning = false;
  bool _autoScan = false;
  Timer? _autoTimer;
  int _contributed = 0;
  String? _status;
  // The last local scan's access points, strongest first — shown live with
  // signal strength so the scan visibly does something, not just a counter.
  List<WiFiAccessPoint> _scanned = [];
  bool _showList = true;

  @override
  void initState() {
    super.initState();
    _locate().then((_) => _loadNearby());
  }

  @override
  void dispose() {
    _autoTimer?.cancel();
    super.dispose();
  }

  Future<void> _locate() async {
    try {
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
      }
      if (perm == LocationPermission.denied ||
          perm == LocationPermission.deniedForever) {
        return;
      }
      final pos = await Geolocator.getCurrentPosition(
        locationSettings:
            const LocationSettings(accuracy: LocationAccuracy.high),
      ).timeout(const Duration(seconds: 12));
      if (!mounted) return;
      setState(() => _me = LatLng(pos.latitude, pos.longitude));
      _map.move(_me!, 16);
    } catch (_) {
      // Keep the fallback centre.
    }
  }

  Future<void> _loadNearby() async {
    final at = _me ?? _fallback;
    try {
      final pts = await context
          .read<AppState>()
          .api
          .wifiNearby(at.latitude, at.longitude, radiusKm: 5);
      if (mounted) setState(() => _points = pts);
    } catch (_) {
      // Non-fatal — the map just shows nothing new.
    }
  }

  /// Scan once: read nearby APs, tag them with the current GPS fix, upload.
  Future<void> _scanOnce() async {
    if (_scanning) return;
    setState(() {
      _scanning = true;
      _status = tr(context, "Scanning…", "စကန်ဖတ်နေသည်…");
    });
    try {
      final can = await WiFiScan.instance.canStartScan();
      if (can != CanStartScan.yes) {
        setState(() => _status = tr(
            context,
            "WiFi scan needs Location on + permission.",
            "WiFi scan အတွက် Location ဖွင့် + ခွင့်ပြုချက် လိုပါတယ်။"));
        return;
      }
      await WiFiScan.instance.startScan();
      // Give the OS a moment to populate results.
      await Future.delayed(const Duration(seconds: 2));
      final results = await WiFiScan.instance.getScannedResults();
      // Show every AP found, strongest signal first — the live scan panel.
      if (mounted) {
        setState(() => _scanned = results.toList()
          ..sort((a, b) => b.level.compareTo(a.level)));
      }

      // Refresh the GPS fix so the upload is tagged where we actually are.
      await _locate();
      final at = _me;
      if (at == null) {
        setState(() => _status = tr(context, "No GPS fix yet.",
            "GPS မရသေးပါ။"));
        return;
      }
      final networks = results
          .where((a) => a.bssid.isNotEmpty)
          .map((a) => {
                "bssid": a.bssid,
                "ssid": a.ssid,
                "signal": a.level,
                "security": _security(a.capabilities),
                // Radio detail: the server derives band/channel from this and
                // parses the raw capability string for the exact encryption.
                "frequency": a.frequency,
                "capabilities": a.capabilities,
              })
          .toList();
      if (networks.isEmpty) {
        setState(() => _status =
            tr(context, "No WiFi found here.", "ဒီနားမှာ WiFi မတွေ့ပါ။"));
        return;
      }
      await context.read<AppState>().api.wifiObserve(
            latitude: at.latitude,
            longitude: at.longitude,
            networks: networks,
            client: {
              "platform": Platform.isAndroid ? "android" : "ios",
              "osVersion": Platform.operatingSystemVersion,
              "appBuild": "${AppConfig.appBuild}",
            },
          );
      _contributed += networks.length;
      await _loadNearby();
      if (mounted) {
        setState(() => _status = tr(
            context,
            "Added ${networks.length} networks. Thanks!",
            "WiFi ${networks.length} ခု ထည့်ပြီး။ ကျေးဇူးတင်ပါတယ်!"));
      }
    } catch (e) {
      if (mounted) setState(() => _status = e.toString());
    } finally {
      if (mounted) setState(() => _scanning = false);
    }
  }

  String _security(String caps) {
    final c = caps.toUpperCase();
    if (c.contains("WPA3")) return "WPA3";
    if (c.contains("WPA2")) return "WPA2";
    if (c.contains("WPA")) return "WPA";
    if (c.contains("WEP")) return "WEP";
    return "OPEN";
  }

  void _toggleAuto() {
    setState(() => _autoScan = !_autoScan);
    _autoTimer?.cancel();
    if (_autoScan) {
      _scanOnce();
      _autoTimer = Timer.periodic(const Duration(seconds: 20), (_) {
        if (!_scanning) _scanOnce();
      });
    }
  }

  List<Marker> _markers() {
    final markers = <Marker>[];
    if (_me != null) {
      markers.add(Marker(
        point: _me!,
        width: 22,
        height: 22,
        child: Container(
          decoration: BoxDecoration(
            color: Colors.blue,
            shape: BoxShape.circle,
            border: Border.all(color: Colors.white, width: 3),
          ),
        ),
      ));
    }
    for (final p in _points) {
      final lat = (p["latitude"] as num?)?.toDouble();
      final lng = (p["longitude"] as num?)?.toDouble();
      if (lat == null || lng == null) continue;
      final open = (p["security"] ?? "").toString().toUpperCase() == "OPEN";
      markers.add(Marker(
        point: LatLng(lat, lng),
        width: 26,
        height: 26,
        child: GestureDetector(
          onTap: () => _showPoint(p),
          child: Icon(Icons.wifi,
              size: 20, color: open ? GwColors.gold : GwColors.primary),
        ),
      ));
    }
    return markers;
  }

  String _band(int mhz) {
    if (mhz >= 5925) return "6 GHz";
    if (mhz >= 4900) return "5 GHz";
    if (mhz >= 2400) return "2.4 GHz";
    return "$mhz MHz";
  }

  /// The live scan panel: a collapsible card listing every access point the
  /// last scan saw, sorted by signal, each with a strength bar.
  Widget _scanPanel() {
    return Material(
      elevation: 4,
      borderRadius: BorderRadius.circular(GwRadius.lg),
      color: GwColors.surfaceOf(context),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          InkWell(
            onTap: () => setState(() => _showList = !_showList),
            borderRadius: BorderRadius.circular(GwRadius.lg),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(14, 10, 10, 10),
              child: Row(
                children: [
                  const Icon(Icons.wifi, size: 18, color: GwColors.primary),
                  const SizedBox(width: 8),
                  Text(
                    "${tr(context, "Signals found", "တွေ့ရှိ signal")}: ${_scanned.length}",
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                  const Spacer(),
                  Icon(_showList ? Icons.expand_more : Icons.expand_less,
                      color: GwColors.inkSoftOf(context)),
                ],
              ),
            ),
          ),
          if (_showList)
            ConstrainedBox(
              constraints: BoxConstraints(
                  maxHeight: MediaQuery.of(context).size.height * 0.34),
              child: ListView.separated(
                shrinkWrap: true,
                padding: const EdgeInsets.fromLTRB(14, 0, 14, 12),
                itemCount: _scanned.length,
                separatorBuilder: (_, __) => Divider(
                    height: 12, color: GwColors.line.withValues(alpha: 0.5)),
                itemBuilder: (_, i) {
                  final a = _scanned[i];
                  final open = _security(a.capabilities) == "OPEN";
                  return Row(
                    children: [
                      SignalBars(rssi: a.level, size: 20),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              a.ssid.isEmpty
                                  ? tr(context, "(hidden)", "(ဖုံးထား)")
                                  : a.ssid,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                  fontWeight: FontWeight.w700, fontSize: 13.5),
                            ),
                            Text(
                              "${_band(a.frequency)} · ${_security(a.capabilities)}"
                              "${open ? " ⚠" : ""} · ${a.level} dBm",
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                  fontSize: 11,
                                  color: GwColors.inkSoftOf(context)),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        "${(signalQuality(a.level) * 100).round()}%",
                        style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                            color: signalColor(
                                signalQuality(a.level), context)),
                      ),
                    ],
                  );
                },
              ),
            ),
        ],
      ),
    );
  }

  void _showPoint(Map<String, dynamic> p) {
    showModalBottomSheet(
      context: context,
      builder: (_) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text((p["ssid"] ?? "(hidden network)").toString(),
                style: const TextStyle(
                    fontWeight: FontWeight.w800, fontSize: 17)),
            const SizedBox(height: 6),
            Text("BSSID: ${p["bssid"]}",
                style: const TextStyle(color: GwColors.inkSoft, fontSize: 13)),
            Text(
                "${tr(context, "Security", "လုံခြုံရေး")}: ${p["security"] ?? "?"}  ·  "
                "${p["observations"] ?? 1} ${tr(context, "reports", "စစ်ချက်")}",
                style: const TextStyle(color: GwColors.inkSoft, fontSize: 13)),
            if ((p["best_signal"] as num?) != null) ...[
              const SizedBox(height: 10),
              Text(
                  tr(context, "Best signal reported", "အကောင်းဆုံး signal မှတ်တမ်း"),
                  style: TextStyle(
                      fontSize: 11.5, color: GwColors.inkSoftOf(context))),
              const SizedBox(height: 4),
              SignalStrengthBar(rssi: (p["best_signal"] as num).round()),
            ],
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(tr(context, "WiFi map", "WiFi မြေပုံ")),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: Center(
              child: Text("📡 ${_points.length}",
                  style: const TextStyle(fontWeight: FontWeight.w700)),
            ),
          ),
        ],
      ),
      body: Stack(
        children: [
          FlutterMap(
            mapController: _map,
            options: MapOptions(
              initialCenter: _me ?? _fallback,
              initialZoom: _me != null ? 16 : 6,
              minZoom: 2,
              maxZoom: 18,
            ),
            children: [
              TileLayer(
                urlTemplate: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
                userAgentPackageName: "ai.gwave.app",
                maxZoom: 19,
                tileProvider:
                    CachingTileProvider(layerKey: "osm", userAgent: "ai.gwave.app"),
              ),
              MarkerLayer(markers: _markers()),
            ],
          ),
          if (_status != null)
            Positioned(
              left: 12,
              right: 12,
              top: 12,
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.75),
                  borderRadius: BorderRadius.circular(GwRadius.md),
                ),
                child: Text(_status!,
                    style: const TextStyle(color: Colors.white, fontSize: 13)),
              ),
            ),
          // Live scan panel — every AP found this scan, strongest first,
          // each with a signal-strength bar and band/security.
          if (_scanned.isNotEmpty)
            Positioned(
              left: 12,
              right: 12,
              bottom: 76,
              child: _scanPanel(),
            ),
          Positioned(
            left: 12,
            right: 12,
            bottom: 16,
            child: Row(
              children: [
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: _scanning ? null : _scanOnce,
                    icon: _scanning
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(
                                strokeWidth: 2, color: Colors.white))
                        : const Icon(Icons.wifi_find),
                    label: Text(tr(context, "Scan here", "ဒီနေရာ scan")),
                  ),
                ),
                const SizedBox(width: 10),
                Material(
                  color: _autoScan ? GwColors.live : GwColors.surface,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(GwRadius.md),
                      side: const BorderSide(color: GwColors.line)),
                  child: InkWell(
                    onTap: _toggleAuto,
                    borderRadius: BorderRadius.circular(GwRadius.md),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 12),
                      child: Row(
                        children: [
                          Icon(Icons.autorenew,
                              size: 18,
                              color:
                                  _autoScan ? Colors.white : GwColors.inkSoft),
                          const SizedBox(width: 6),
                          Text(tr(context, "Auto", "အလို"),
                              style: TextStyle(
                                  fontWeight: FontWeight.w700,
                                  color: _autoScan
                                      ? Colors.white
                                      : GwColors.inkSoft)),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
