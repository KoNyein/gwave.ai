import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;
import 'package:latlong2/latlong.dart';
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Travel tools behind the GPS map: named waypoints (fuel stop, camp, mine
/// adit…), trip recording with distance/speed stats, GPX export, and in-app
/// road routing. All storage is on-device (SharedPreferences JSON) — these
/// are personal field notes, not server data.

// ---- Waypoints --------------------------------------------------------------

class Waypoint {
  Waypoint({
    required this.id,
    required this.name,
    required this.icon,
    required this.lat,
    required this.lng,
    this.note = "",
    DateTime? createdAt,
  }) : createdAt = createdAt ?? DateTime.now();

  final String id;
  String name;
  String icon; // an emoji — renders at any size with zero assets
  final double lat;
  final double lng;
  String note;
  final DateTime createdAt;

  LatLng get point => LatLng(lat, lng);

  Map<String, dynamic> toJson() => {
        "id": id,
        "name": name,
        "icon": icon,
        "lat": lat,
        "lng": lng,
        "note": note,
        "at": createdAt.toIso8601String(),
      };

  static Waypoint fromJson(Map<String, dynamic> j) => Waypoint(
        id: j["id"] as String,
        name: j["name"] as String? ?? "",
        icon: j["icon"] as String? ?? "📍",
        lat: (j["lat"] as num).toDouble(),
        lng: (j["lng"] as num).toDouble(),
        note: j["note"] as String? ?? "",
        createdAt:
            DateTime.tryParse(j["at"] as String? ?? "") ?? DateTime.now(),
      );
}

/// Quick-pick categories a traveller actually marks. (emoji, en, my)
const kWaypointKinds = <(String, String, String)>[
  ("⛽", "Fuel", "စက်ဆီဆိုင်"),
  ("🏕", "Camp", "စခန်း"),
  ("🍜", "Food", "စားသောက်ဆိုင်"),
  ("🏠", "Lodging", "တည်းခိုရန်"),
  ("💧", "Water", "ရေ"),
  ("🔧", "Repair", "ပြင်ဆင်ရေး"),
  ("⛏", "Mine site", "သတ္တုတွင်း"),
  ("⚠️", "Danger", "အန္တရာယ်"),
  ("📍", "Other", "အခြား"),
];

class WaypointStore {
  static const _key = "gw_map_waypoints";

  static Future<List<Waypoint>> load() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_key);
      if (raw == null) return [];
      final list = jsonDecode(raw) as List<dynamic>;
      return [
        for (final e in list) Waypoint.fromJson(e as Map<String, dynamic>)
      ];
    } catch (_) {
      return [];
    }
  }

  static Future<void> save(List<Waypoint> points) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      // Hard cap keeps prefs sane; oldest fall off first.
      final keep = points.length > 300
          ? points.sublist(points.length - 300)
          : points;
      await prefs.setString(
          _key, jsonEncode([for (final w in keep) w.toJson()]));
    } catch (_) {}
  }
}

// ---- Trip recording ---------------------------------------------------------

class TripPoint {
  TripPoint(this.lat, this.lng, this.at, {this.speedMs = 0});
  final double lat;
  final double lng;
  final DateTime at;
  final double speedMs;

  LatLng get point => LatLng(lat, lng);

  List<dynamic> toJson() =>
      [lat, lng, at.millisecondsSinceEpoch, (speedMs * 10).round()];

  static TripPoint fromJson(List<dynamic> j) => TripPoint(
        (j[0] as num).toDouble(),
        (j[1] as num).toDouble(),
        DateTime.fromMillisecondsSinceEpoch(j[2] as int),
        speedMs: ((j.length > 3 ? j[3] as num : 0).toDouble()) / 10,
      );
}

class Trip {
  Trip({required this.id, required this.name, required this.points});
  final String id;
  String name;
  final List<TripPoint> points;

  DateTime get startedAt => points.isEmpty ? DateTime.now() : points.first.at;
  DateTime get endedAt => points.isEmpty ? DateTime.now() : points.last.at;
  Duration get duration => endedAt.difference(startedAt);

  double get distanceM {
    var d = 0.0;
    for (var i = 1; i < points.length; i++) {
      d += Geolocator.distanceBetween(points[i - 1].lat, points[i - 1].lng,
          points[i].lat, points[i].lng);
    }
    return d;
  }

  double get avgSpeedKmh {
    final s = duration.inSeconds;
    return s == 0 ? 0 : distanceM / s * 3.6;
  }

  double get maxSpeedKmh {
    var m = 0.0;
    for (final p in points) {
      if (p.speedMs > m) m = p.speedMs;
    }
    return m * 3.6;
  }

  Map<String, dynamic> toJson() => {
        "id": id,
        "name": name,
        "pts": [for (final p in points) p.toJson()],
      };

  static Trip fromJson(Map<String, dynamic> j) => Trip(
        id: j["id"] as String,
        name: j["name"] as String? ?? "",
        points: [
          for (final p in (j["pts"] as List<dynamic>))
            TripPoint.fromJson(p as List<dynamic>)
        ],
      );

  /// Standard GPX 1.1 — opens in AlpineQuest, OsmAnd, Google Earth, QGIS.
  String toGpx() {
    final b = StringBuffer()
      ..writeln('<?xml version="1.0" encoding="UTF-8"?>')
      ..writeln('<gpx version="1.1" creator="Gwave" '
          'xmlns="http://www.topografix.com/GPX/1/1">')
      ..writeln('<trk><name>${_xml(name)}</name><trkseg>');
    for (final p in points) {
      b.writeln('<trkpt lat="${p.lat}" lon="${p.lng}">'
          '<time>${p.at.toUtc().toIso8601String()}</time></trkpt>');
    }
    b
      ..writeln('</trkseg></trk>')
      ..writeln('</gpx>');
    return b.toString();
  }

  Future<File> writeGpxFile() async {
    final dir = await getTemporaryDirectory();
    final safe = name.replaceAll(RegExp(r"[^\w\- ]"), "").trim();
    final f = File(
        "${dir.path}/gwave-trip-${safe.isEmpty ? id : safe.replaceAll(" ", "-")}.gpx");
    await f.writeAsString(toGpx());
    return f;
  }

  static String _xml(String s) => s
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
}

class TripStore {
  static const _key = "gw_map_trips";

  static Future<List<Trip>> load() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_key);
      if (raw == null) return [];
      final list = jsonDecode(raw) as List<dynamic>;
      return [for (final e in list) Trip.fromJson(e as Map<String, dynamic>)];
    } catch (_) {
      return [];
    }
  }

  static Future<void> save(List<Trip> trips) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      // 20 trips ≈ plenty; the cap is about prefs size, points are compact.
      final keep = trips.length > 20 ? trips.sublist(trips.length - 20) : trips;
      await prefs.setString(
          _key, jsonEncode([for (final t in keep) t.toJson()]));
    } catch (_) {}
  }
}

/// Records a GPS track while the map is open. Points are appended only when
/// the phone actually moved (distanceFilter), so standing still doesn't
/// inflate the log.
class TripRecorder {
  StreamSubscription<Position>? _sub;
  final List<TripPoint> points = [];
  bool get running => _sub != null;

  Future<bool> start(void Function() onPoint) async {
    if (running) return true;
    try {
      points.clear();
      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
            accuracy: LocationAccuracy.high),
      ).timeout(const Duration(seconds: 12));
      points.add(TripPoint(pos.latitude, pos.longitude, DateTime.now(),
          speedMs: pos.speed));
      _sub = Geolocator.getPositionStream(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          distanceFilter: 8,
        ),
      ).listen((p) {
        points.add(TripPoint(p.latitude, p.longitude, DateTime.now(),
            speedMs: p.speed));
        onPoint();
      });
      return true;
    } catch (_) {
      await stop();
      return false;
    }
  }

  Future<void> stop() async {
    await _sub?.cancel();
    _sub = null;
  }

  void dispose() {
    _sub?.cancel();
    _sub = null;
  }
}

// ---- Routing (OSRM) ---------------------------------------------------------

class RouteResult {
  RouteResult(this.points, this.distanceM, this.durationS);
  final List<LatLng> points;
  final double distanceM;
  final double durationS;
}

/// Road route from the public OSRM demo server. Free, no key, driving
/// profile; fine for the occasional in-app route. Returns null offline —
/// the caller falls back to a straight line + compass bearing.
Future<RouteResult?> fetchOsrmRoute(LatLng from, LatLng to) async {
  try {
    final url = Uri.parse(
        "https://router.project-osrm.org/route/v1/driving/"
        "${from.longitude},${from.latitude};${to.longitude},${to.latitude}"
        "?overview=full&geometries=geojson");
    final res = await http.get(url).timeout(const Duration(seconds: 12));
    if (res.statusCode != 200) return null;
    final data = jsonDecode(res.body) as Map<String, dynamic>;
    final routes = data["routes"] as List<dynamic>?;
    if (routes == null || routes.isEmpty) return null;
    final r = routes.first as Map<String, dynamic>;
    final coords =
        ((r["geometry"] as Map<String, dynamic>)["coordinates"] as List<dynamic>);
    return RouteResult(
      [
        for (final c in coords)
          LatLng((c[1] as num).toDouble(), (c[0] as num).toDouble())
      ],
      (r["distance"] as num).toDouble(),
      (r["duration"] as num).toDouble(),
    );
  } catch (_) {
    return null;
  }
}

String fmtDistance(double m) =>
    m < 1000 ? "${m.round()} m" : "${(m / 1000).toStringAsFixed(1)} km";

String fmtDuration(Duration d) {
  if (d.inHours > 0) return "${d.inHours} h ${d.inMinutes % 60} min";
  if (d.inMinutes > 0) return "${d.inMinutes} min";
  return "${d.inSeconds} s";
}
