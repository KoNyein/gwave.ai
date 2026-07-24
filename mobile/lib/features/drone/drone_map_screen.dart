import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';

import '../../core/i18n.dart';
import '../../core/theme.dart';
import '../map/offline_tiles.dart';
import 'drone_scanner_screen.dart';

/// Plots drone detections on a real map: drones that broadcast their location
/// via Remote ID get an exact pin; ones detected only by signal are placed on a
/// ring at their estimated distance around you. A translucent "coverage" circle
/// shows the phone's realistic detection radius, and a bar reports how much of
/// the detections carry precise GPS ("cover rate").
class DroneMapScreen extends StatefulWidget {
  const DroneMapScreen({super.key, required this.liveHits});

  /// Pulls the scanner's live detections each refresh, so the map stays current
  /// while the underlying scan keeps running — one scan, two views.
  final List<DroneHit> Function() liveHits;

  @override
  State<DroneMapScreen> createState() => _DroneMapScreenState();
}

class _DroneMapScreenState extends State<DroneMapScreen> {
  static const LatLng _fallback = LatLng(16.8, 96.15);
  static const double _coverageM = 300; // realistic phone detection radius

  final MapController _map = MapController();
  LatLng? _me;
  List<DroneHit> _hits = [];
  Timer? _poll;

  @override
  void initState() {
    super.initState();
    _hits = widget.liveHits();
    _locate();
    // Keep the map current from the still-running scan underneath.
    _poll = Timer.periodic(const Duration(seconds: 2), (_) {
      if (mounted) setState(() => _hits = widget.liveHits());
    });
  }

  @override
  void dispose() {
    _poll?.cancel();
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
      _map.move(_me!, 15);
    } catch (_) {
      // keep fallback
    }
  }

  /// Offset a point by [meters] at [bearingDeg] (for signal-only drones placed
  /// on a ring around the user).
  LatLng _offset(LatLng from, double meters, double bearingDeg) {
    const earth = 6378137.0;
    final br = bearingDeg * math.pi / 180;
    final dLat = (meters * math.cos(br)) / earth;
    final dLng = (meters * math.sin(br)) /
        (earth * math.cos(from.latitude * math.pi / 180));
    return LatLng(
      from.latitude + dLat * 180 / math.pi,
      from.longitude + dLng * 180 / math.pi,
    );
  }

  @override
  Widget build(BuildContext context) {
    final center = _me ?? _fallback;
    final withGps = _hits.where((h) => h.lat != null).length;
    final total = _hits.length;
    final coverRate = total == 0 ? 0 : (withGps / total * 100).round();

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
    for (final h in _hits) {
      LatLng? p;
      if (h.lat != null && h.lng != null) {
        p = LatLng(h.lat!, h.lng!);
      } else if (_me != null) {
        // Signal-only: ring position at estimated distance, stable angle.
        final ang = (h.key.hashCode % 360).toDouble();
        p = _offset(_me!, h.distanceM.clamp(10, 600), ang);
      }
      if (p == null) continue;
      final near = h.confirmed && h.distanceM <= 200;
      markers.add(Marker(
        point: p,
        width: 40,
        height: 40,
        child: GestureDetector(
          onTap: () => _showHit(h),
          child: Icon(
            h.lat != null ? Icons.flight : Icons.wifi_tethering,
            color: near ? GwColors.live : GwColors.gold,
            size: h.lat != null ? 30 : 24,
          ),
        ),
      ));
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(tr(context, "Drone map", "ဒရုန်း မြေပုံ")),
      ),
      body: Column(
        children: [
          _coverBar(withGps, total, coverRate),
          Expanded(
            child: FlutterMap(
              mapController: _map,
              options: MapOptions(
                initialCenter: center,
                initialZoom: _me != null ? 15 : 6,
                minZoom: 2,
                maxZoom: 18,
              ),
              children: [
                TileLayer(
                  urlTemplate:
                      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
                  userAgentPackageName: "ai.gwave.app",
                  maxZoom: 19,
                  tileProvider: CachingTileProvider(
                      layerKey: "osm", userAgent: "ai.gwave.app"),
                ),
                if (_me != null)
                  CircleLayer(circles: [
                    CircleMarker(
                      point: _me!,
                      radius: _coverageM,
                      useRadiusInMeter: true,
                      color: GwColors.primary.withValues(alpha: 0.10),
                      borderColor: GwColors.primary.withValues(alpha: 0.5),
                      borderStrokeWidth: 1.5,
                    ),
                  ]),
                MarkerLayer(markers: markers),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _coverBar(int withGps, int total, int rate) {
    return Container(
      color: Colors.black,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      child: Row(
        children: [
          _stat("${total}", tr(context, "Detected", "တွေ့ရှိ")),
          const SizedBox(width: 18),
          _stat("$withGps", tr(context, "With GPS", "GPS ပါ")),
          const SizedBox(width: 18),
          _stat("$rate%", tr(context, "Cover rate", "တိကျမှုနှုန်း")),
          const Spacer(),
          Text("⌖ ${_coverageM.round()} m ${tr(context, "range", "အကွာအဝေး")}",
              style: const TextStyle(color: Colors.white54, fontSize: 12)),
        ],
      ),
    );
  }

  Widget _stat(String v, String label) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(v,
              style: const TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.w900)),
          Text(label,
              style: const TextStyle(color: Colors.white54, fontSize: 11)),
        ],
      );

  void _showHit(DroneHit h) {
    showModalBottomSheet(
      context: context,
      builder: (_) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(h.label,
                style: const TextStyle(
                    fontWeight: FontWeight.w900, fontSize: 17)),
            const SizedBox(height: 6),
            Text(
                "${h.source} · ${h.rssi} dBm · ≈ ${h.distanceM < 1000 ? "${h.distanceM.round()} m" : "${(h.distanceM / 1000).toStringAsFixed(1)} km"}",
                style: TextStyle(color: GwColors.inkSoftOf(context))),
            if (h.remoteId != null)
              Text("ID: ${h.remoteId}",
                  style: TextStyle(color: GwColors.inkSoftOf(context))),
            if (h.lat != null)
              Text(
                  "📍 ${h.lat!.toStringAsFixed(5)}, ${h.lng!.toStringAsFixed(5)}",
                  style: TextStyle(color: GwColors.inkSoftOf(context)))
            else
              Text(
                  tr(context,
                      "No broadcast GPS — shown at estimated distance.",
                      "GPS မထုတ်လွှင့် — ခန့်မှန်း အကွာအဝေးဖြင့် ပြထားသည်။"),
                  style: TextStyle(
                      color: GwColors.inkSoftOf(context), fontSize: 12)),
          ],
        ),
      ),
    );
  }
}
