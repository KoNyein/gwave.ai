import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/app_state.dart';
import '../../core/i18n.dart';
import '../../core/models.dart';
import '../../core/repository.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';
import '../messenger/chat_screen.dart';

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
  bool _satellite = false; // OSM streets vs Esri world imagery
  String? _locError;

  // A sensible default view (mainland SE Asia) until we have a fix.
  static const LatLng _fallback = LatLng(16.8, 96.15);

  @override
  void initState() {
    super.initState();
    _init();
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
    setState(() => _busySos = true);
    try {
      if (_me == null) await _locate(recenter: true);
      final me = _me;
      if (me == null) {
        _toast(tr(context, "Need your location to send SOS.",
            "SOS ပို့ရန် တည်နေရာ လိုအပ်သည်။"));
        return;
      }
      await context.read<AppState>().repo.sendSos(me.latitude, me.longitude);
      await _load();
      _toast(tr(context, "🆘 SOS sent with your location.",
          "🆘 SOS ကို သင့်တည်နေရာနှင့်အတူ ပို့လိုက်ပါပြီ။"));
    } catch (e) {
      _toast("Couldn't send SOS — $e");
    } finally {
      if (mounted) setState(() => _busySos = false);
    }
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text("GPS Map"),
        actions: [
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
            ),
            children: [
              TileLayer(
                urlTemplate: _satellite
                    ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                    : "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
                userAgentPackageName: "ai.gwave.app",
                maxZoom: 19,
              ),
              MarkerLayer(markers: _markers()),
            ],
          ),

          // Top: emergency actions.
          Positioned(top: 10, left: 12, right: 12, child: _topControls()),

          // Map / Satellite layer toggle.
          Positioned(
            right: 16,
            bottom: 316,
            child: FloatingActionButton.small(
              heroTag: "layers",
              backgroundColor: Colors.white,
              foregroundColor:
                  _satellite ? GwColors.primary : GwColors.inkSoft,
              onPressed: () => setState(() => _satellite = !_satellite),
              child: Icon(
                  _satellite ? Icons.satellite_alt : Icons.layers_outlined),
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
                    foregroundColor: GwColors.ink,
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

  Widget _helpSheet() {
    return DraggableScrollableSheet(
      initialChildSize: 0.30,
      minChildSize: 0.14,
      maxChildSize: 0.82,
      builder: (context, controller) {
        return Container(
          decoration: const BoxDecoration(
            color: GwColors.surface,
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
                  color: GwColors.line,
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
                            separatorBuilder: (_, __) => const Divider(
                                height: 1, indent: 72, color: GwColors.line),
                            itemBuilder: (_, i) => _sosTile(_sos[i]),
                          ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _sosTile(Map<String, dynamic> a) {
    final person = a["person"];
    final isMine = a["user_id"]?.toString() ==
        context.read<AppState>().api.session?.profileId;
    final name = isMine
        ? tr(context, "You", "သင် (ကိုယ်တိုင်)")
        : person is Map
            ? (person["full_name"] ?? person["username"] ?? "Gwave user")
                .toString()
            : "Gwave user";
    final avatar =
        person is Map ? resolveMedia(person["avatar_url"]?.toString()) : null;
    final safe = a["status"]?.toString() == "safe";
    final dist = _fmtDist(_distanceTo(a));

    return ListTile(
      leading: GwAvatar(url: avatar, name: name, size: 46),
      title: Text(name,
          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5)),
      subtitle: Text(
        [
          safe
              ? tr(context, "Marked safe", "ဘေးကင်းပြီ")
              : tr(context, "Needs help", "အကူအညီလို"),
          if (dist.isNotEmpty) dist,
        ].join(" · "),
        style: TextStyle(
            color: safe ? GwColors.primary : GwColors.live, fontSize: 12.5),
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
                    icon: const Icon(Icons.chat_bubble_outline,
                        color: GwColors.inkSoft),
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
