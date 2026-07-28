import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';
import 'package:record/record.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:wifi_scan/wifi_scan.dart';

import '../../core/app_state.dart';
import '../../core/i18n.dart';
import '../../core/models.dart';
import '../../core/repository.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';
import '../drone/drone_scanner_screen.dart';
import 'offline_tiles.dart';
import 'offline_area_sheet.dart';
import '../live/go_live_screen.dart';
import '../messenger/chat_screen.dart';
import 'wifi_map_screen.dart';

/// Base-map choices for the AlpineQuest-style layer picker.
enum _MapBase { streets, topo, satellite }

/// Native GPS Map — one screen. A real map (OpenStreetMap tiles, so it works on
/// phones without Google Play Services), the user's own location, the live SOS
/// board and family markers, plus the emergency SOS action — all native, no
/// embedded web page.
class MapScreen extends StatefulWidget {
  const MapScreen({
    super.key,
    this.focusLat,
    this.focusLng,
    this.focusLabel,
  });

  /// When set, the map opens centred on this tagged place (a post/reel/live
  /// check-in) with a labelled pin, instead of jumping to the viewer's GPS.
  final double? focusLat;
  final double? focusLng;
  final String? focusLabel;

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  final MapController _map = MapController();

  LatLng? _me;
  List<Map<String, dynamic>> _sos = [];
  List<Map<String, dynamic>> _family = [];
  bool _loading = true;
  bool _busySos = false;
  bool _myAlertOpen = false;
  // AlpineQuest-style layering: a base map + optional overlays. All tiles go
  // through CachingTileProvider, so every layer is offline-capable once seen.
  _MapBase _base = _MapBase.streets;
  bool _geology = false; // Macrostrat global geologic map overlay
  bool _hillshade = false; // Esri world hillshade (terrain relief) overlay
  bool _minerals = false; // USGS MRDS — known gold/mineral occurrences (WMS)
  bool _goldHeat = false; // density heatmap built from MRDS points
  List<LatLng> _heatPoints = [];
  Timer? _heatDebounce;
  double _geologyOpacity = 0.55;
  // AlpineQuest-style "add online map": any XYZ tile URL stacks as an overlay.
  String? _customUrl; // e.g. a gold/geology favourability {z}/{x}/{y} tileset
  double _customOpacity = 0.7;
  final _customCtrl = TextEditingController();
  String? _locError;

  String get _baseUrl => switch (_base) {
        _MapBase.streets => "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        _MapBase.topo => "https://tile.opentopomap.org/{z}/{x}/{y}.png",
        _MapBase.satellite =>
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      };
  String get _baseKey => switch (_base) {
        _MapBase.streets => "osm",
        _MapBase.topo => "topo",
        _MapBase.satellite => "sat",
      };
  // OpenTopoMap tops out lower than the others.
  double get _baseMaxZoom => _base == _MapBase.topo ? 17 : 19;

  static const _geologyUrl =
      "https://tiles.macrostrat.org/carto/{z}/{x}/{y}.png";
  static const _hillshadeUrl =
      "https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}";

  // A sensible default view (mainland SE Asia) until we have a fix.
  static const LatLng _fallback = LatLng(16.8, 96.15);

  @override
  void initState() {
    super.initState();
    _init();
  }

  @override
  void dispose() {
    _heatDebounce?.cancel();
    _customCtrl.dispose();
    super.dispose();
  }

  LatLng? get _focus => widget.focusLat != null && widget.focusLng != null
      ? LatLng(widget.focusLat!, widget.focusLng!)
      : null;

  Future<void> _init() async {
    // When opened from a location tag, stay on that place; the viewer's own
    // GPS is still fetched for the blue dot but doesn't steal the camera.
    await _locate(recenter: _focus == null);
    if (_focus != null && mounted) _map.move(_focus!, 15);
    await _load();
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _locate({bool recenter = false}) async {
    try {
      if (!await Geolocator.isLocationServiceEnabled()) {
        if (mounted) {
          setState(() => _locError = tr(context, "Turn on location on your phone.",
              "ဖုန်းရဲ့ location ကို ဖွင့်ပါ။"));
        }
        return;
      }
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
      }
      if (perm == LocationPermission.denied ||
          perm == LocationPermission.deniedForever) {
        if (mounted) {
          setState(() => _locError = tr(context, "Location permission is off.",
              "Location ခွင့်ပြုချက် ပိတ်ထားသည်။"));
        }
        return;
      }
      final pos = await Geolocator.getCurrentPosition(
        locationSettings:
            const LocationSettings(accuracy: LocationAccuracy.high),
      ).timeout(const Duration(seconds: 12));
      final me = LatLng(pos.latitude, pos.longitude);
      if (!mounted) return;
      setState(() {
        _me = me;
        _locError = null;
      });
      if (recenter) _map.move(me, 15);
      // Share my live location for family circles (best-effort).
      unawaited(context
          .read<AppState>()
          .repo
          .shareMyLocation(me.latitude, me.longitude));
    } catch (_) {
      if (mounted) {
        setState(() => _locError =
            tr(context, "Couldn't get your location.", "တည်နေရာ မရရှိပါ။"));
      }
    }
  }

  Future<void> _load() async {
    final repo = context.read<AppState>().repo;
    try {
      final results = await Future.wait([
        repo.activeSosAlerts(),
        repo.familyLocations(),
      ]);
      if (!mounted) return;
      final me = context.read<AppState>().api.session?.profileId;
      setState(() {
        _sos = results[0];
        _family = results[1];
        _myAlertOpen = _sos.any((a) => a["user_id"]?.toString() == me);
      });
    } catch (_) {
      // Non-fatal — the map still shows.
    }
  }

  Future<void> _sendSos() async {
    if (_busySos) return;
    // Ask what's wrong first — responders need the why, a callback number,
    // and (when possible) a photo or video of the situation.
    final details = await showModalBottomSheet<_SosDetails>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const _SosSheet(),
    );
    if (details == null || !mounted) return;
    setState(() => _busySos = true);
    try {
      if (_me == null) await _locate(recenter: true);
      final me = _me;
      if (me == null) {
        _toast(tr(context, "Need your location to send SOS.",
            "SOS ပို့ရန် တည်နေရာ လိုအပ်သည်။"));
        return;
      }
      final api = context.read<AppState>().api;
      String? mediaPath;
      String? mediaKind;
      final media = details.media;
      if (media != null) {
        final bytes = await media.readAsBytes();
        mediaPath = await api.uploadBytes(
          bytes,
          ext: details.isVideo ? "mp4" : "jpg",
          contentType: details.isVideo ? "video/mp4" : "image/jpeg",
          bucket: "chat-media",
        );
        mediaKind = details.isVideo ? "video" : "photo";
      } else if (details.audioPath != null) {
        final bytes = await File(details.audioPath!).readAsBytes();
        mediaPath = await api.uploadBytes(
          bytes,
          ext: "m4a",
          contentType: "audio/mp4",
          bucket: "chat-media",
        );
        mediaKind = "audio";
      }
      // Advanced rescue: scan nearby WiFi so responders can pinpoint the person
      // indoors (where GPS is weak) by cross-referencing the WiFi map, and
      // enrich that shared map with this SOS point. Best-effort — never blocks
      // the SOS from going out.
      String rescueNote = details.note ?? "";
      try {
        if (await WiFiScan.instance.canStartScan() == CanStartScan.yes) {
          await WiFiScan.instance.startScan();
          await Future.delayed(const Duration(seconds: 2));
          final aps = (await WiFiScan.instance.getScannedResults())
              .where((a) => a.bssid.isNotEmpty)
              .toList()
            ..sort((a, b) => b.level.compareTo(a.level));
          final top = aps.take(6).toList();
          if (top.isNotEmpty) {
            api
                .wifiObserve(
                  latitude: me.latitude,
                  longitude: me.longitude,
                  networks: top
                      .map((a) => {
                            "bssid": a.bssid,
                            "ssid": a.ssid,
                            "signal": a.level,
                            "security": a.capabilities.toUpperCase().contains("WPA")
                                ? "WPA"
                                : "OPEN",
                          })
                      .toList(),
                )
                .catchError((_) {});
            final list = top
                .take(3)
                .map((a) =>
                    "${a.ssid.isEmpty ? a.bssid : a.ssid} (${a.level}dBm)")
                .join(", ");
            rescueNote =
                "${rescueNote.isEmpty ? "" : "$rescueNote\n"}📡 Nearby WiFi: $list";
          }
        }
      } catch (_) {
        // No WiFi scan — the SOS still carries GPS + everything else.
      }
      if (!mounted) return;
      await context.read<AppState>().repo.sendSos(
            me.latitude,
            me.longitude,
            reason: details.reason,
            phone: details.phone,
            message: rescueNote,
            mediaPath: mediaPath,
            mediaKind: mediaKind,
          );
      await _load();
      _toast(tr(context, "🆘 SOS sent with your location.",
          "🆘 SOS ကို သင့်တည်နေရာနှင့်အတူ ပို့လိုက်ပါပြီ။"));
      if (details.goLive && mounted) {
        // Straight into a live broadcast so helpers can see the situation.
        await Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => const GoLiveScreen()),
        );
      }
    } catch (e) {
      // No internet? SOS still has to get out — offer SMS with a GPS link,
      // which needs only the phone network.
      if (mounted) await _offerSmsSos(details, error: "$e");
    } finally {
      if (mounted) setState(() => _busySos = false);
    }
  }

  /// Offline fallback: compose an SMS carrying the reason, note and a Google
  /// Maps link to the sender's GPS position. Works with zero mobile data.
  Future<void> _offerSmsSos(_SosDetails details, {String? error}) async {
    final me = _me;
    final send = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text("အင်တာနက်နဲ့ ပို့မရပါ"),
        content: const Text(
            "ဖုန်းလိုင်းသာ ရှိရင် SMS နဲ့ တည်နေရာပါ ပို့လို့ရပါတယ်။ SMS နဲ့ ပို့မလား?"),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text("မပို့တော့ပါ"),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text("📩 SMS နဲ့ ပို့မည်"),
          ),
        ],
      ),
    );
    if (send != true || !mounted) return;
    final reason = _reasonLabels[details.reason] ?? "🆘 SOS";
    final body = [
      "🆘 SOS! $reason",
      if (details.note != null && details.note!.isNotEmpty) details.note!,
      if (me != null)
        "တည်နေရာ: https://maps.google.com/?q=${me.latitude},${me.longitude}",
      if (details.phone != null && details.phone!.isNotEmpty)
        "ဖုန်း: ${details.phone}",
      "— Gwave SOS",
    ].join("\n");
    await launchUrl(
      Uri(scheme: "sms", queryParameters: {"body": body}),
      mode: LaunchMode.externalApplication,
    );
  }

  /// Close out my SOS: "safe" keeps it on the map with a green "Marked safe"
  /// label; "resolved" removes it entirely.
  Future<void> _closeSos(String status) async {
    try {
      await context.read<AppState>().repo.setMySosStatus(status);
      await _load();
      if (status == "resolved" && _myAlertOpen) {
        // The PATCH matched nothing my login owns — e.g. an alert raised
        // under an older session/profile. Say so instead of failing silently.
        _toast(tr(
            context,
            "That alert wasn't raised by this login, so it can't be closed here.",
            "ဒီ alert က လက်ရှိ login နှင့် မတင်ခဲ့သဖြင့် ဒီကနေ ပိတ်၍မရပါ။"));
        return;
      }
      _toast(status == "safe"
          ? tr(context, "Marked safe — glad you're okay!",
              "ဘေးကင်းကြောင်း မှတ်သားလိုက်ပါပြီ။")
          : tr(context, "Your SOS was closed.", "သင့် SOS ကို ပိတ်လိုက်ပါပြီ။"));
    } catch (e) {
      _toast("Couldn't update SOS — $e");
    }
  }

  Future<void> _respond(Map<String, dynamic> alert) async {
    try {
      await context.read<AppState>().repo.respondToSos(alert["id"].toString());
      _toast(tr(context, "You're on the way — they've been notified.",
          "သင် ကူညီရန်လာနေကြောင်း အသိပေးပြီးပါပြီ။"));
    } catch (e) {
      _toast("Couldn't respond — $e");
    }
  }

  Future<void> _chat(Map<String, dynamic> personJson) async {
    try {
      final person = Profile.fromJson(personJson);
      final convo =
          await context.read<AppState>().repo.openConversationWith(person);
      if (!mounted) return;
      Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => ChatScreen(conversation: convo)),
      );
    } catch (e) {
      _toast("Couldn't open chat — $e");
    }
  }

  void _toast(String msg) {
    if (mounted) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(msg)));
    }
  }

  double? _distanceTo(Map<String, dynamic> a) {
    final me = _me;
    final lat = (a["latitude"] as num?)?.toDouble();
    final lng = (a["longitude"] as num?)?.toDouble();
    if (me == null || lat == null || lng == null) return null;
    return Geolocator.distanceBetween(me.latitude, me.longitude, lat, lng);
  }

  String _fmtDist(double? m) {
    if (m == null) return "";
    if (m < 1000) return "${m.round()} m";
    return "${(m / 1000).toStringAsFixed(1)} km";
  }

  /// Download the currently-visible area for offline use.
  void _openOfflineSheet() {
    final cam = _map.camera;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (_) => OfflineAreaSheet(
        bounds: cam.visibleBounds,
        centerZoom: cam.zoom,
        layerKey: _baseKey,
        urlTemplate: _baseUrl,
        userAgent: "ai.gwave.app",
      ),
    );
  }

  /// Debounced reload of the gold heatmap points for the current viewport.
  void _scheduleHeatFetch() {
    _heatDebounce?.cancel();
    _heatDebounce =
        Timer(const Duration(milliseconds: 600), _fetchHeatPoints);
  }

  /// Pull every known MRDS deposit inside the current map bounds and keep them
  /// as heatmap points. Free USGS WFS (GeoJSON). Best-effort: on any failure
  /// the heatmap just stays as-is (or empty) — never disrupts the map.
  Future<void> _fetchHeatPoints() async {
    try {
      final b = _map.camera.visibleBounds;
      // Guard against a whole-world request (too many features): only fetch
      // once zoomed in a bit.
      if (_map.camera.zoom < 5) {
        if (mounted) setState(() => _heatPoints = []);
        return;
      }
      final bbox =
          "${b.west},${b.south},${b.east},${b.north}";
      final url = Uri.parse(
          "https://mrdata.usgs.gov/wfs/mrds?service=WFS&version=1.1.0&request=GetFeature"
          "&typeName=mrds&outputFormat=application/json&srsName=EPSG:4326"
          "&maxFeatures=1500&bbox=$bbox,EPSG:4326");
      final res = await http.get(url).timeout(const Duration(seconds: 15));
      if (res.statusCode != 200) return;
      final j = jsonDecode(res.body);
      final feats = j?["features"];
      if (feats is! List) return;
      final pts = <LatLng>[];
      for (final f in feats) {
        final g = f?["geometry"];
        final c = g?["coordinates"];
        if (c is List && c.length >= 2) {
          final lng = (c[0] as num).toDouble();
          final lat = (c[1] as num).toDouble();
          pts.add(LatLng(lat, lng));
        }
      }
      if (mounted) setState(() => _heatPoints = pts);
    } catch (_) {
      // Offline / endpoint hiccup — leave the current points.
    }
  }

  /// Tap-to-identify geology: ask Macrostrat what rock unit sits at [p] and
  /// show the details (unit name, age, lithology, description) in a sheet.
  /// This is the "more detail than the tiles" path — the point query returns
  /// the full unit record at any zoom level.
  Future<void> _identifyGeology(LatLng p) async {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => FutureBuilder<List<Map<String, dynamic>>>(
        future: _fetchGeology(p),
        builder: (ctx, snap) {
          Widget body;
          if (snap.connectionState != ConnectionState.done) {
            body = const Padding(
              padding: EdgeInsets.all(30),
              child: Center(child: CircularProgressIndicator()),
            );
          } else if (snap.hasError ||
              snap.data == null ||
              snap.data!.isEmpty) {
            body = Padding(
              padding: const EdgeInsets.all(24),
              child: Text(tr(
                  ctx,
                  "No geologic data here (or offline).",
                  "ဒီနေရာအတွက် ဘူမိဗေဒ အချက်အလက် မရှိပါ (သို့) လိုင်းမရှိပါ။")),
            );
          } else {
            body = ListView(
              shrinkWrap: true,
              padding: const EdgeInsets.fromLTRB(18, 8, 18, 20),
              children: [
                Text(
                  "🪨 ${tr(ctx, "Geology here", "ဒီနေရာက ဘူမိဗေဒ")}"
                  "  (${p.latitude.toStringAsFixed(4)}, ${p.longitude.toStringAsFixed(4)})",
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 8),
                for (final u in snap.data!) ...[
                  const Divider(height: 18),
                  if ((u["name"] ?? "").toString().isNotEmpty)
                    Text(u["name"].toString(),
                        style:
                            const TextStyle(fontWeight: FontWeight.w700)),
                  if ((u["age"] ?? "").toString().isNotEmpty)
                    _geoRow(ctx, tr(ctx, "Age", "သက်တမ်း"),
                        "${u["age"]}  (${u["b_age"]}–${u["t_age"]} Ma)"),
                  if ((u["lith"] ?? "").toString().isNotEmpty)
                    _geoRow(ctx, tr(ctx, "Rock types", "ကျောက်အမျိုးအစား"),
                        u["lith"].toString()),
                  if ((u["descrip"] ?? "").toString().isNotEmpty)
                    _geoRow(ctx, tr(ctx, "Description", "ဖော်ပြချက်"),
                        u["descrip"].toString()),
                  if ((u["comments"] ?? "").toString().isNotEmpty)
                    _geoRow(ctx, tr(ctx, "Notes", "မှတ်ချက်"),
                        u["comments"].toString()),
                ],
                const SizedBox(height: 8),
                Text("Source: Macrostrat",
                    style: TextStyle(
                        fontSize: 10.5, color: GwColors.inkSoftOf(ctx))),
              ],
            );
          }
          return SafeArea(child: body);
        },
      ),
    );
  }

  Widget _geoRow(BuildContext ctx, String k, String v) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
                width: 110,
                child: Text(k,
                    style: TextStyle(
                        fontSize: 12.5, color: GwColors.inkSoftOf(ctx)))),
            Expanded(child: Text(v, style: const TextStyle(fontSize: 13))),
          ],
        ),
      );

  Future<List<Map<String, dynamic>>> _fetchGeology(LatLng p) async {
    final res = await http
        .get(Uri.parse(
            "https://macrostrat.org/api/v2/geologic_units/map?lat=${p.latitude}&lng=${p.longitude}"))
        .timeout(const Duration(seconds: 12));
    if (res.statusCode != 200) return [];
    final j = jsonDecode(res.body);
    final data = j?["success"]?["data"];
    if (data is! List) return [];
    return data
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }

  /// AlpineQuest-style layer picker: choose the base map and stack the
  /// geology / hillshade overlays with adjustable geology opacity.
  void _openLayersSheet() {
    showModalBottomSheet(
      context: context,
      builder: (_) => StatefulBuilder(
        builder: (ctx, setSheet) {
          void apply(VoidCallback fn) {
            setSheet(fn);
            setState(() {});
          }

          return SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(tr(ctx, "Base map", "အခြေခံ မြေပုံ"),
                      style: const TextStyle(fontWeight: FontWeight.w800)),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    children: [
                      for (final (b, en, my) in [
                        (_MapBase.streets, "Streets", "လမ်းမြေပုံ"),
                        (_MapBase.topo, "Topo", "တောင်ကုန်း/contour"),
                        (_MapBase.satellite, "Satellite", "ဂြိုဟ်တုပုံ"),
                      ])
                        ChoiceChip(
                          selected: _base == b,
                          onSelected: (_) => apply(() => _base = b),
                          label: Text(tr(ctx, en, my)),
                        ),
                    ],
                  ),
                  const Divider(height: 22),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    dense: true,
                    title: Text(tr(ctx, "Geology overlay (Macrostrat)",
                        "ဘူမိဗေဒ မြေပုံလွှာ (Macrostrat)")),
                    subtitle: Text(tr(
                        ctx,
                        "Rock units & ages as coloured areas",
                        "ကျောက်လွှာ/သက်တမ်းအလိုက် အရောင်ပြ")),
                    value: _geology,
                    onChanged: (v) => apply(() => _geology = v),
                  ),
                  if (_geology)
                    Row(
                      children: [
                        Text(tr(ctx, "Opacity", "အလင်းပိတ်နှုန်း"),
                            style: const TextStyle(fontSize: 12.5)),
                        Expanded(
                          child: Slider(
                            value: _geologyOpacity,
                            min: 0.2,
                            max: 0.9,
                            onChanged: (v) =>
                                apply(() => _geologyOpacity = v),
                          ),
                        ),
                      ],
                    ),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    dense: true,
                    title: Text(tr(ctx, "Hillshade (terrain relief)",
                        "တောင်ရိပ် (မြေမျက်နှာသွင်ပြင်)")),
                    value: _hillshade,
                    onChanged: (v) => apply(() => _hillshade = v),
                  ),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    dense: true,
                    title: Text(tr(ctx, "Gold & minerals (USGS)",
                        "ရွှေ & သတ္တုတွင်း (USGS)")),
                    subtitle: Text(tr(
                        ctx,
                        "Known deposits & occurrences worldwide",
                        "ကမ္ဘာတစ်ဝန်း သိထားပြီး တွင်း/တည်နေရာများ")),
                    value: _minerals,
                    onChanged: (v) => apply(() => _minerals = v),
                  ),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    dense: true,
                    title: Text(tr(ctx, "Gold heatmap",
                        "ရွှေ heatmap")),
                    subtitle: Text(tr(
                        ctx,
                        "Deposit density glow — hotter where more gold is recorded",
                        "တွင်း သိပ်သည်းရာ တောက်ပ — ရွှေ များရာ ပိုနီ")),
                    value: _goldHeat,
                    onChanged: (v) => apply(() {
                      _goldHeat = v;
                      if (v) {
                        _fetchHeatPoints();
                      } else {
                        _heatPoints = [];
                      }
                    }),
                  ),
                  const Divider(height: 22),
                  // AlpineQuest-style "add online map": paste any XYZ tile URL
                  // (e.g. a gold / mineral favourability heatmap tileset) and
                  // it stacks over the base map with adjustable opacity.
                  Text(tr(ctx, "Custom overlay (online map URL)",
                      "Custom overlay (online map URL)"),
                      style: const TextStyle(fontWeight: FontWeight.w800)),
                  const SizedBox(height: 6),
                  TextField(
                    controller: _customCtrl,
                    style: const TextStyle(fontSize: 12.5),
                    decoration: InputDecoration(
                      isDense: true,
                      border: const OutlineInputBorder(),
                      hintText: "https://…/{z}/{x}/{y}.png",
                      hintStyle: const TextStyle(fontSize: 12),
                      suffixIcon: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          IconButton(
                            tooltip: tr(ctx, "Apply", "သုံးမည်"),
                            icon: const Icon(Icons.check, size: 20),
                            onPressed: () => apply(() =>
                                _customUrl = _customCtrl.text.trim().isEmpty
                                    ? null
                                    : _customCtrl.text.trim()),
                          ),
                          IconButton(
                            tooltip: tr(ctx, "Clear", "ဖျက်မည်"),
                            icon: const Icon(Icons.close, size: 20),
                            onPressed: () => apply(() {
                              _customCtrl.clear();
                              _customUrl = null;
                            }),
                          ),
                        ],
                      ),
                    ),
                  ),
                  if (_customUrl != null && _customUrl!.isNotEmpty)
                    Row(
                      children: [
                        Text(tr(ctx, "Opacity", "အလင်းပိတ်နှုန်း"),
                            style: const TextStyle(fontSize: 12.5)),
                        Expanded(
                          child: Slider(
                            value: _customOpacity,
                            min: 0.2,
                            max: 1.0,
                            onChanged: (v) => apply(() => _customOpacity = v),
                          ),
                        ),
                      ],
                    ),
                  Text(
                    tr(
                        ctx,
                        "Paste any {z}/{x}/{y} tile link — a geology / gold-favourability heatmap, a country topo map, etc. — to overlay it like AlpineQuest.",
                        "{z}/{x}/{y} tile link တစ်ခုခု (ဘူမိဗေဒ/ရွှေ heatmap၊ topo မြေပုံ စသဖြင့်) ကူးထည့်ရင် AlpineQuest လိုမျိုး ထပ်တင်လို့ရသည်။"),
                    style: TextStyle(
                        fontSize: 11, color: GwColors.inkSoftOf(ctx)),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    "© OpenStreetMap · OpenTopoMap (CC-BY-SA) · Esri · Macrostrat · USGS MRDS",
                    style: TextStyle(
                        fontSize: 10.5,
                        color: GwColors.inkSoftOf(ctx)),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    tr(
                        ctx,
                        "Tiles you view are cached on-device and keep working offline.",
                        "ကြည့်ပြီးသား မြေပုံကွက်တွေ ဖုန်းထဲ သိမ်းထားပြီး offline မှာလည်း ဆက်သုံးလို့ရသည်။"),
                    style: TextStyle(
                        fontSize: 11, color: GwColors.inkSoftOf(ctx)),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text("GPS Map"),
        actions: [
          IconButton(
            tooltip: tr(context, "Drone radar", "ဒရုန်း ရေဒါ"),
            icon: const Icon(Icons.radar),
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const DroneScannerScreen()),
            ),
          ),
          IconButton(
            tooltip: tr(context, "WiFi map", "WiFi မြေပုံ"),
            icon: const Icon(Icons.wifi_find),
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const WifiMapScreen()),
            ),
          ),
          IconButton(
            tooltip: tr(context, "Refresh", "ပြန်ဆွဲ"),
            icon: const Icon(Icons.refresh),
            onPressed: () {
              _locate();
              _load();
            },
          ),
        ],
      ),
      body: Stack(
        children: [
          FlutterMap(
            mapController: _map,
            options: MapOptions(
              initialCenter: _focus ?? _me ?? _fallback,
              initialZoom: _focus != null || _me != null ? 15 : 6,
              minZoom: 2,
              maxZoom: 18,
              // Geology detail on demand: with the overlay on, a long-press
              // asks Macrostrat what rock unit is under the finger — far more
              // detail than the z≤14 tiles can draw.
              onLongPress: (_, latlng) {
                if (_geology) _identifyGeology(latlng);
              },
              // Reload the gold heatmap for the new viewport as the user pans.
              onPositionChanged: (_, __) {
                if (_goldHeat) _scheduleHeatFetch();
              },
            ),
            children: [
              TileLayer(
                urlTemplate: _baseUrl,
                userAgentPackageName: "ai.gwave.app",
                maxZoom: _baseMaxZoom,
                // Offline-first: every tile is cached to disk, then served from
                // disk (works with no connection). Namespaced per layer.
                tileProvider: CachingTileProvider(
                  layerKey: _baseKey,
                  userAgent: "ai.gwave.app",
                ),
              ),
              // Terrain relief under the geology colours, AlpineQuest-style.
              if (_hillshade)
                Opacity(
                  opacity: 0.45,
                  child: TileLayer(
                    urlTemplate: _hillshadeUrl,
                    userAgentPackageName: "ai.gwave.app",
                    maxZoom: 16,
                    tileProvider: CachingTileProvider(
                      layerKey: "hill",
                      userAgent: "ai.gwave.app",
                    ),
                  ),
                ),
              // Macrostrat global geologic map — rock units as coloured
              // polygons; opacity is user-adjustable so the base shows through.
              if (_geology)
                Opacity(
                  opacity: _geologyOpacity,
                  child: TileLayer(
                    urlTemplate: _geologyUrl,
                    userAgentPackageName: "ai.gwave.app",
                    // Macrostrat serves up to z14; overzoom (upscale) those
                    // tiles beyond it so the overlay never vanishes while
                    // zooming in close — AlpineQuest behaves the same way.
                    maxNativeZoom: 14,
                    maxZoom: 18,
                    tileProvider: CachingTileProvider(
                      layerKey: "geo",
                      userAgent: "ai.gwave.app",
                    ),
                  ),
                ),
              // Gold density heatmap — overlapping translucent orange/red
              // discs at every known MRDS deposit; clusters glow hotter,
              // giving the AlpineQuest-style favourability look from real data.
              if (_goldHeat && _heatPoints.isNotEmpty) ...[
                CircleLayer(
                  circles: [
                    for (final p in _heatPoints)
                      CircleMarker(
                        point: p,
                        radius: 22,
                        color: const Color(0x33FFB300), // amber glow
                      ),
                  ],
                ),
                CircleLayer(
                  circles: [
                    for (final p in _heatPoints)
                      CircleMarker(
                        point: p,
                        radius: 9,
                        color: const Color(0x55FF3D00), // hot red core
                      ),
                  ],
                ),
              ],
              // USGS MRDS — every KNOWN gold & mineral occurrence worldwide
              // (free WMS). Point data, not a predictive favourability
              // heatmap, but it shows where deposits are actually recorded.
              if (_minerals)
                Opacity(
                  opacity: 0.9,
                  child: TileLayer(
                    wmsOptions: WMSTileLayerOptions(
                      baseUrl: "https://mrdata.usgs.gov/services/mrds?",
                      layers: const ["mrds"],
                      format: "image/png",
                      transparent: true,
                    ),
                    userAgentPackageName: "ai.gwave.app",
                    tileProvider: NetworkTileProvider(),
                    errorTileCallback: (_, __, ___) {},
                  ),
                ),
              // Custom user overlay (AlpineQuest "online map" URL) — any XYZ
              // raster, e.g. a gold/mineral favourability heatmap, stacked
              // over the base with its own opacity.
              if (_customUrl != null && _customUrl!.isNotEmpty)
                Opacity(
                  opacity: _customOpacity,
                  child: TileLayer(
                    urlTemplate: _customUrl,
                    userAgentPackageName: "ai.gwave.app",
                    maxNativeZoom: 17,
                    maxZoom: 19,
                    tileProvider: CachingTileProvider(
                      layerKey: "custom",
                      userAgent: "ai.gwave.app",
                    ),
                    errorTileCallback: (_, __, ___) {},
                  ),
                ),
              MarkerLayer(markers: _markers()),
            ],
          ),

          // Top: emergency actions.
          Positioned(top: 10, left: 12, right: 12, child: _topControls()),

          // Offline area download.
          Positioned(
            right: 16,
            bottom: 372,
            child: FloatingActionButton.small(
              heroTag: "offline",
              backgroundColor: Colors.white,
              foregroundColor: GwColors.primary,
              onPressed: _openOfflineSheet,
              child: const Icon(Icons.download_for_offline_outlined),
            ),
          ),

          // Layer picker: base map + geology/hillshade overlays.
          Positioned(
            right: 16,
            bottom: 316,
            child: FloatingActionButton.small(
              heroTag: "layers",
              backgroundColor: Colors.white,
              foregroundColor: (_geology ||
                      _hillshade ||
                      _minerals ||
                      _customUrl != null ||
                      _base != _MapBase.streets)
                  ? GwColors.primary
                  : GwColors.inkSoftOf(context),
              onPressed: _openLayersSheet,
              child: const Icon(Icons.layers_outlined),
            ),
          ),

          // Recenter on me.
          Positioned(
            right: 16,
            bottom: 260,
            child: FloatingActionButton.small(
              heroTag: "recenter",
              backgroundColor: Colors.white,
              foregroundColor: GwColors.primary,
              onPressed: () => _locate(recenter: true),
              child: const Icon(Icons.my_location),
            ),
          ),

          // The live help board.
          _helpSheet(),
        ],
      ),
    );
  }

  /// Turn-by-turn directions in the Google Maps app (falls back to the
  /// browser when Maps isn't installed).
  Future<void> _directions(double lat, double lng) async {
    final uri = Uri.parse(
        "https://www.google.com/maps/dir/?api=1&destination=$lat,$lng");
    try {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {}
  }

  List<Marker> _markers() {
    final markers = <Marker>[];
    // The tagged place this map was opened for (post/reel/live check-in).
    if (_focus != null) {
      markers.add(Marker(
        point: _focus!,
        width: 160,
        height: 64,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (widget.focusLabel != null && widget.focusLabel!.isNotEmpty)
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(10),
                  boxShadow: GwShadow.card,
                ),
                child: Text(
                  widget.focusLabel!,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                      fontSize: 11.5, fontWeight: FontWeight.w700),
                ),
              ),
            const Icon(Icons.place, color: GwColors.live, size: 34),
          ],
        ),
      ));
    }
    if (_me != null) {
      markers.add(Marker(
        point: _me!,
        width: 26,
        height: 26,
        child: Container(
          decoration: BoxDecoration(
            color: const Color(0xFF2E7DF1),
            shape: BoxShape.circle,
            border: Border.all(color: Colors.white, width: 3),
            boxShadow: [
              BoxShadow(
                  color: Colors.black.withValues(alpha: 0.3), blurRadius: 6)
            ],
          ),
        ),
      ));
    }
    for (final f in _family) {
      final lat = (f["latitude"] as num?)?.toDouble();
      final lng = (f["longitude"] as num?)?.toDouble();
      if (lat == null || lng == null) continue;
      final person = f["person"];
      final name = person is Map
          ? (person["full_name"] ?? person["username"] ?? "").toString()
          : "";
      markers.add(Marker(
        point: LatLng(lat, lng),
        width: 44,
        height: 44,
        child: GwAvatar(
          url: person is Map
              ? resolveMedia(person["avatar_url"]?.toString())
              : null,
          name: name.isEmpty ? "?" : name,
          size: 40,
        ),
      ));
    }
    for (final a in _sos) {
      final lat = (a["latitude"] as num?)?.toDouble();
      final lng = (a["longitude"] as num?)?.toDouble();
      if (lat == null || lng == null) continue;
      markers.add(Marker(
        point: LatLng(lat, lng),
        width: 40,
        height: 40,
        child: Container(
          decoration: BoxDecoration(
            color: GwColors.live,
            shape: BoxShape.circle,
            border: Border.all(color: Colors.white, width: 2.5),
            boxShadow: [
              BoxShadow(
                  color: GwColors.live.withValues(alpha: 0.5), blurRadius: 8)
            ],
          ),
          child: const Icon(Icons.sos, color: Colors.white, size: 20),
        ),
      ));
    }
    return markers;
  }

  Widget _topControls() {
    return Column(
      children: [
        if (_locError != null)
          Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(GwRadius.sm),
              boxShadow: GwShadow.card,
            ),
            child: Row(
              children: [
                const Icon(Icons.location_off, color: GwColors.live, size: 18),
                const SizedBox(width: 8),
                Expanded(
                    child: Text(_locError!,
                        style: const TextStyle(fontSize: 12.5))),
                TextButton(
                  onPressed: () => _locate(recenter: true),
                  child: Text(tr(context, "Retry", "ထပ်စမ်း")),
                ),
              ],
            ),
          ),
        _dangerBanner(),
        Row(
          children: [
            Expanded(
              child: SizedBox(
                height: 52,
                child: ElevatedButton.icon(
                  onPressed: _busySos ? null : _sendSos,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: GwColors.live,
                    foregroundColor: Colors.white,
                  ),
                  icon: _busySos
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                              strokeWidth: 2.4,
                              valueColor:
                                  AlwaysStoppedAnimation(Colors.white)),
                        )
                      : const Icon(Icons.sos),
                  label: Text(
                    tr(context, "Emergency SOS", "အရေးပေါ် SOS"),
                    style: const TextStyle(
                        fontWeight: FontWeight.w900, fontSize: 15),
                  ),
                ),
              ),
            ),
            if (_myAlertOpen) ...[
              const SizedBox(width: 8),
              SizedBox(
                height: 52,
                child: ElevatedButton(
                  onPressed: () => _closeSos("safe"),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.white,
                    foregroundColor: GwColors.primary,
                  ),
                  child: Text(tr(context, "I'm safe", "အန္တရာယ်ကင်း")),
                ),
              ),
              const SizedBox(width: 8),
              SizedBox(
                height: 52,
                child: ElevatedButton(
                  onPressed: () => _closeSos("resolved"),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.white,
                    foregroundColor: GwColors.inkOf(context),
                  ),
                  child: Text(tr(context, "Close", "ပိတ်မယ်")),
                ),
              ),
            ],
          ],
        ),
      ],
    );
  }

  /// Red warning strip whenever someone nearby has an active SOS.
  Widget _dangerBanner() {
    final me = context.read<AppState>().api.session?.profileId;
    final active = _sos
        .where((a) =>
            a["status"]?.toString() == "active" &&
            a["user_id"]?.toString() != me)
        .length;
    if (active == 0) return const SizedBox.shrink();
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFB71C1C),
        borderRadius: BorderRadius.circular(GwRadius.sm),
        boxShadow: GwShadow.card,
      ),
      child: Row(
        children: [
          const Icon(Icons.warning_amber_rounded,
              color: Colors.white, size: 20),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              tr(
                  context,
                  "Danger alert — $active nearby needs help. Check the list below.",
                  "⚠️ အန္တရာယ်သတိပေးချက် — အနီးအနားတွင် အကူအညီလိုသူ $active ဦး ရှိနေသည်။"),
              style: const TextStyle(
                  color: Colors.white,
                  fontSize: 12.5,
                  fontWeight: FontWeight.w800),
            ),
          ),
        ],
      ),
    );
  }

  Widget _helpSheet() {
    return DraggableScrollableSheet(
      initialChildSize: 0.30,
      minChildSize: 0.14,
      maxChildSize: 0.82,
      builder: (context, controller) {
        return Container(
          decoration: BoxDecoration(
            color: GwColors.surfaceOf(context),
            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
            boxShadow: [BoxShadow(color: Colors.black26, blurRadius: 16)],
          ),
          child: Column(
            children: [
              const SizedBox(height: 10),
              Container(
                width: 42,
                height: 5,
                decoration: BoxDecoration(
                  color: GwColors.lineOf(context),
                  borderRadius: BorderRadius.circular(3),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 6),
                child: Row(
                  children: [
                    const Icon(Icons.emergency_share,
                        color: GwColors.live, size: 20),
                    const SizedBox(width: 8),
                    Text(
                      "${tr(context, "People needing help", "အကူအညီ လိုအပ်သူများ")} (${_sos.length})",
                      style: const TextStyle(
                          fontWeight: FontWeight.w800, fontSize: 15),
                    ),
                  ],
                ),
              ),
              const Divider(height: 1),
              Expanded(
                child: _loading
                    ? const Center(
                        child:
                            CircularProgressIndicator(color: GwColors.primary))
                    : _sos.isEmpty
                        ? ListView(controller: controller, children: [
                            const SizedBox(height: 40),
                            GwEmpty(
                              icon: Icons.verified_user_outlined,
                              title: tr(context, "All clear",
                                  "အားလုံး ဘေးကင်းပါသည်"),
                              subtitle: tr(
                                  context,
                                  "No one nearby has raised an SOS.",
                                  "အနီးအနားတွင် SOS တောင်းထားသူ မရှိပါ။"),
                            ),
                          ])
                        : ListView.separated(
                            controller: controller,
                            padding: const EdgeInsets.only(bottom: 20),
                            itemCount: _sos.length,
                            separatorBuilder: (_, __) => Divider(
                                height: 1, indent: 72, color: GwColors.lineOf(context)),
                            itemBuilder: (_, i) => _sosTile(_sos[i]),
                          ),
              ),
            ],
          ),
        );
      },
    );
  }

  /// Fullscreen view of an SOS photo; videos open in the browser player.
  void _viewSosMedia(String url, String? kind) {
    if (kind == "video" || kind == "audio") {
      launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
      return;
    }
    showDialog<void>(
      context: context,
      builder: (_) => Dialog(
        backgroundColor: Colors.black,
        insetPadding: const EdgeInsets.all(12),
        child: InteractiveViewer(child: Image.network(url)),
      ),
    );
  }

  static const _reasonLabels = {
    "medical": "🚑 ဆေးဘက်အရေးပေါ်",
    "fire": "🔥 မီးဘေး",
    "accident": "🚗 မတော်တဆမှု",
    "danger": "⚠️ အန္တရာယ်",
    "flood": "🌊 ရေဘေး",
    "other": "🆘 အခြား",
  };

  Widget _sosTile(Map<String, dynamic> a) {
    final person = a["person"];
    final isMine = a["user_id"]?.toString() ==
        context.read<AppState>().api.session?.profileId;
    final name = isMine
        ? tr(context, "You", "သင် (ကိုယ်တိုင်)")
        : person is Map
            ? Profile.fromJson(Map<String, dynamic>.from(person)).displayName
            : "Gwave user";
    final avatar =
        person is Map ? resolveMedia(person["avatar_url"]?.toString()) : null;
    final safe = a["status"]?.toString() == "safe";
    final dist = _fmtDist(_distanceTo(a));
    final reason = _reasonLabels[a["reason"]?.toString()];
    final note = a["message"]?.toString().trim() ?? "";
    final phone = a["phone"]?.toString().trim() ?? "";
    final mediaUrl = resolveMedia(a["media_path"]?.toString(),
        bucket: "chat-media");

    return ListTile(
      leading: GwAvatar(url: avatar, name: name, size: 46),
      title: Text(name,
          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5)),
      isThreeLine: reason != null || note.isNotEmpty,
      subtitle: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            [
              safe
                  ? tr(context, "Marked safe", "ဘေးကင်းပြီ")
                  : tr(context, "Needs help", "အကူအညီလို"),
              if (dist.isNotEmpty) dist,
            ].join(" · "),
            style: TextStyle(
                color: safe ? GwColors.primary : GwColors.live,
                fontSize: 12.5),
          ),
          if (reason != null || note.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Text(
                [if (reason != null) reason, if (note.isNotEmpty) note]
                    .join(" — "),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                    color: GwColors.inkOf(context),
                    fontSize: 12.5,
                    fontWeight: FontWeight.w600),
              ),
            ),
          if (phone.isNotEmpty || mediaUrl != null)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (phone.isNotEmpty)
                    OutlinedButton.icon(
                      onPressed: () => launchUrl(Uri.parse("tel:$phone")),
                      icon: const Icon(Icons.call, size: 15),
                      label: Text(phone,
                          style: const TextStyle(fontSize: 12)),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: GwColors.primary,
                        visualDensity: VisualDensity.compact,
                        padding:
                            const EdgeInsets.symmetric(horizontal: 10),
                      ),
                    ),
                  if (phone.isNotEmpty && mediaUrl != null)
                    const SizedBox(width: 8),
                  if (mediaUrl != null)
                    OutlinedButton.icon(
                      onPressed: () => _viewSosMedia(
                          mediaUrl, a["media_kind"]?.toString()),
                      icon: const Icon(Icons.photo_library_outlined,
                          size: 15),
                      label: Text(
                          a["media_kind"]?.toString() == "video"
                              ? tr(context, "Video", "ဗီဒီယို")
                              : a["media_kind"]?.toString() == "audio"
                                  ? tr(context, "Audio", "အသံ")
                                  : tr(context, "Photo", "ဓာတ်ပုံ"),
                          style: const TextStyle(fontSize: 12)),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: GwColors.primary,
                        visualDensity: VisualDensity.compact,
                        padding:
                            const EdgeInsets.symmetric(horizontal: 10),
                      ),
                    ),
                ],
              ),
            ),
        ],
      ),
      // Your own alert has no help/chat actions — the I'm-safe / Close
      // buttons up top manage it.
      trailing: isMine
          ? null
          : Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                IconButton(
                  tooltip: tr(context, "I'll help", "ကူညီမယ်"),
                  icon: const Icon(Icons.volunteer_activism,
                      color: GwColors.primary),
                  onPressed: () => _respond(a),
                ),
                IconButton(
                  tooltip: tr(context, "Directions", "လမ်းညွှန်"),
                  icon: const Icon(Icons.directions, color: GwColors.primary),
                  onPressed: () {
                    final lat = (a["latitude"] as num?)?.toDouble();
                    final lng = (a["longitude"] as num?)?.toDouble();
                    if (lat != null && lng != null) _directions(lat, lng);
                  },
                ),
                if (person is Map)
                  IconButton(
                    tooltip: tr(context, "Chat", "Chat"),
                    icon: Icon(Icons.chat_bubble_outline,
                        color: GwColors.inkSoftOf(context)),
                    onPressed: () => _chat(Map<String, dynamic>.from(person)),
                  ),
              ],
            ),
      onTap: () {
        final lat = (a["latitude"] as num?)?.toDouble();
        final lng = (a["longitude"] as num?)?.toDouble();
        if (lat != null && lng != null) _map.move(LatLng(lat, lng), 16);
      },
    );
  }
}

/// What the user filled in before firing the SOS.
class _SosDetails {
  const _SosDetails({
    required this.reason,
    this.phone,
    this.note,
    this.media,
    this.isVideo = false,
    this.audioPath,
    this.goLive = false,
  });
  final String reason;
  final String? phone;
  final String? note;
  final XFile? media;
  final bool isVideo;
  final String? audioPath;
  final bool goLive;
}

/// Emergency details sheet: why, callback phone, note, an optional photo /
/// video / voice recording, and a go-live-right-after toggle.
class _SosSheet extends StatefulWidget {
  const _SosSheet();

  @override
  State<_SosSheet> createState() => _SosSheetState();
}

class _SosSheetState extends State<_SosSheet> {
  static const _reasons = [
    ("medical", "🚑", "ဆေးဘက်"),
    ("fire", "🔥", "မီးဘေး"),
    ("accident", "🚗", "မတော်တဆ"),
    ("danger", "⚠️", "အန္တရာယ်"),
    ("flood", "🌊", "ရေဘေး"),
    ("other", "🆘", "အခြား"),
  ];

  String _reason = "danger";
  final _phone = TextEditingController();
  final _note = TextEditingController();
  XFile? _media;
  bool _isVideo = false;
  String? _audioPath;
  bool _recording = false;
  bool _goLive = false;
  final _recorder = AudioRecorder();

  @override
  void dispose() {
    _phone.dispose();
    _note.dispose();
    _recorder.dispose();
    super.dispose();
  }

  Future<void> _pick(bool video) async {
    final picker = ImagePicker();
    final f = video
        ? await picker.pickVideo(
            source: ImageSource.camera,
            maxDuration: const Duration(seconds: 30))
        : await picker.pickImage(
            source: ImageSource.camera, imageQuality: 80, maxWidth: 1600);
    if (f != null && mounted) {
      setState(() {
        _media = f;
        _isVideo = video;
        _audioPath = null;
      });
    }
  }

  Future<void> _toggleAudio() async {
    if (_recording) {
      final path = await _recorder.stop();
      if (mounted) {
        setState(() {
          _recording = false;
          _audioPath = path;
          if (path != null) _media = null;
        });
      }
      return;
    }
    if (!await _recorder.hasPermission()) return;
    final dir = Directory.systemTemp;
    await _recorder.start(
      const RecordConfig(encoder: AudioEncoder.aacLc),
      path:
          "${dir.path}/sos-${DateTime.now().millisecondsSinceEpoch}.m4a",
    );
    if (mounted) setState(() => _recording = true);
  }

  @override
  Widget build(BuildContext context) {
    final inset = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.only(bottom: inset),
      child: Container(
        decoration: BoxDecoration(
          color: GwColors.surfaceOf(context),
          borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
        ),
        padding: const EdgeInsets.fromLTRB(18, 14, 18, 22),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 42,
                  height: 5,
                  decoration: BoxDecoration(
                    color: GwColors.lineOf(context),
                    borderRadius: BorderRadius.circular(3),
                  ),
                ),
              ),
              const SizedBox(height: 14),
              const Row(
                children: [
                  Icon(Icons.sos, color: GwColors.live, size: 24),
                  SizedBox(width: 8),
                  Text("အရေးပေါ် SOS",
                      style: TextStyle(
                          fontSize: 18, fontWeight: FontWeight.w900)),
                ],
              ),
              const SizedBox(height: 4),
              Text("ဘာဖြစ်နေလဲ ရွေးပါ — ကူညီမယ့်သူတွေ သိရအောင်",
                  style:
                      TextStyle(color: GwColors.inkSoftOf(context), fontSize: 12.5)),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final r in _reasons)
                    ChoiceChip(
                      label: Text("${r.$2} ${r.$3}",
                          style: const TextStyle(fontSize: 13)),
                      selected: _reason == r.$1,
                      selectedColor:
                          GwColors.live.withValues(alpha: 0.15),
                      onSelected: (_) =>
                          setState(() => _reason = r.$1),
                    ),
                ],
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _phone,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(
                  labelText: "ဆက်သွယ်ရန် ဖုန်းနံပါတ်",
                  prefixIcon: Icon(Icons.call),
                ),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: _note,
                maxLines: 2,
                decoration: const InputDecoration(
                  labelText: "အသေးစိတ် (ဘာဖြစ်နေလဲ ရေးပါ)",
                  prefixIcon: Icon(Icons.notes),
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => _pick(false),
                      icon: const Icon(Icons.photo_camera, size: 17),
                      label: Text(
                          _media != null && !_isVideo ? "ပုံ ✓" : "ဓာတ်ပုံ"),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => _pick(true),
                      icon: const Icon(Icons.videocam, size: 17),
                      label: Text(
                          _media != null && _isVideo ? "ဗီဒီယို ✓" : "ဗီဒီယို"),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _toggleAudio,
                      style: _recording
                          ? OutlinedButton.styleFrom(
                              foregroundColor: GwColors.live)
                          : null,
                      icon: Icon(_recording ? Icons.stop : Icons.mic,
                          size: 17),
                      label: Text(_recording
                          ? "ရပ်ရန်"
                          : _audioPath != null
                              ? "အသံ ✓"
                              : "အသံ"),
                    ),
                  ),
                ],
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                value: _goLive,
                onChanged: (v) => setState(() => _goLive = v),
                title: const Text("SOS ပို့ပြီး Live တန်းလွှင့်မည်",
                    style: TextStyle(
                        fontSize: 13.5, fontWeight: FontWeight.w700)),
                subtitle: const Text(
                    "ကူညီမယ့်သူတွေ အခြေအနေကို တိုက်ရိုက်မြင်ရပါမယ်",
                    style: TextStyle(fontSize: 11.5)),
              ),
              const SizedBox(height: 4),
              SizedBox(
                width: double.infinity,
                height: 52,
                child: ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: GwColors.live,
                    foregroundColor: Colors.white,
                  ),
                  onPressed: () {
                    Navigator.of(context).pop(_SosDetails(
                      reason: _reason,
                      phone: _phone.text.trim().isEmpty
                          ? null
                          : _phone.text.trim(),
                      note: _note.text.trim().isEmpty
                          ? null
                          : _note.text.trim(),
                      media: _media,
                      isVideo: _isVideo,
                      audioPath: _audioPath,
                      goLive: _goLive,
                    ));
                  },
                  icon: const Icon(Icons.sos),
                  label: const Text("🆘 SOS ပို့မည်",
                      style: TextStyle(
                          fontWeight: FontWeight.w900, fontSize: 15.5)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
