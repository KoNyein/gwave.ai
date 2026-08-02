import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api_client.dart';
import '../../core/app_state.dart';
import '../../core/i18n.dart';
import '../../core/repository.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';
import '../map/offline_tiles.dart';

/// The community cannabis map — dispensaries, farms and clinics.
///
/// It was the web board in a webview, which put the site's own header inside
/// the app. Native now, over the same RLS-sealed API: any signed-in adult adds
/// or corrects a listing, anyone reports a bad one, an admin removes it.
///
/// A listing is only accepted **complete** — name, kind, address, phone, exact
/// coordinates and at least one photo — because half-filled pins are what make
/// community maps useless. The editor enforces that before the upload rather
/// than letting the server reject it afterwards.
class CannabisPlacesScreen extends StatefulWidget {
  const CannabisPlacesScreen({super.key});

  @override
  State<CannabisPlacesScreen> createState() => _CannabisPlacesScreenState();
}

class CannabisPlace {
  CannabisPlace(Map<String, dynamic> j)
      : id = (j["id"] ?? "").toString(),
        kind = (j["kind"] ?? "shop").toString(),
        name = (j["name"] ?? "").toString(),
        address = (j["address"] ?? "").toString(),
        phone = (j["phone"] ?? "").toString(),
        latitude = (j["latitude"] as num?)?.toDouble() ?? 0,
        longitude = (j["longitude"] as num?)?.toDouble() ?? 0,
        photos = ((j["photos"] as List?) ?? const [])
            .map((p) => p.toString())
            .where((p) => p.isNotEmpty)
            .toList(),
        description = j["description"]?.toString(),
        hours = j["hours"]?.toString(),
        website = j["website"]?.toString(),
        tags = j["tags"]?.toString(),
        city = j["city"]?.toString(),
        reportCount = (j["report_count"] as num?)?.toInt() ?? 0;

  final String id;
  final String kind;
  final String name;
  final String address;
  final String phone;
  final double latitude;
  final double longitude;
  final List<String> photos;
  final String? description;
  final String? hours;
  final String? website;
  final String? tags;
  final String? city;
  final int reportCount;

  LatLng get point => LatLng(latitude, longitude);
}

const _kinds = ["shop", "farm", "clinic"];

String _kindEmoji(String kind) =>
    kind == "farm" ? "🌱" : kind == "clinic" ? "🏥" : "🏪";

Color _kindColor(String kind) => kind == "farm"
    ? const Color(0xFF16A34A)
    : kind == "clinic"
        ? const Color(0xFF2563EB)
        : const Color(0xFF7C3AED);

String _kindLabel(BuildContext context, String kind) {
  switch (kind) {
    case "farm":
      return tr3(context, "Farms", "စိုက်ခင်း", "ฟาร์ม");
    case "clinic":
      return tr3(context, "Clinics", "ကလင်းနစ်", "คลินิก");
    default:
      return tr3(context, "Shops", "ဆိုင်", "ร้าน");
  }
}

class _CannabisPlacesScreenState extends State<CannabisPlacesScreen> {
  final _mapCtl = MapController();
  final _searchCtl = TextEditingController();

  List<CannabisPlace> _all = [];
  bool _loading = true;
  String? _error;
  String _kind = "all";
  String _q = "";
  bool _mapView = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _searchCtl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final rows = await context.read<AppState>().api.cannabisPlaces();
      if (!mounted) return;
      setState(() => _all = rows.map(CannabisPlace.new).toList());
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<CannabisPlace> get _shown {
    final needle = _q.trim().toLowerCase();
    return _all.where((p) {
      if (_kind != "all" && p.kind != _kind) return false;
      if (needle.isEmpty) return true;
      return p.name.toLowerCase().contains(needle) ||
          p.address.toLowerCase().contains(needle) ||
          (p.city ?? "").toLowerCase().contains(needle) ||
          (p.tags ?? "").toLowerCase().contains(needle);
    }).toList();
  }

  Future<void> _openEditor([CannabisPlace? editing]) async {
    final saved = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => CannabisPlaceEditor(editing: editing)),
    );
    if (saved == true) _load();
  }

  void _openPlace(CannabisPlace place) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _PlaceSheet(
        place: place,
        onEdit: () {
          Navigator.of(context).pop();
          _openEditor(place);
        },
        onChanged: _load,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final shown = _shown;
    // The API answers 403 for a non-adult; saying that plainly beats an empty
    // map the user would read as "no shops near me".
    final blocked = _error != null && _error!.contains("18+");
    return Scaffold(
      backgroundColor: GwColors.bgOf(context),
      appBar: AppBar(
        title: Text(tr3(context, "Cannabis map", "ဆေးခြောက် မြေပုံ",
            "แผนที่กัญชา")),
        actions: [
          IconButton(
            tooltip: tr3(context, "Language", "ဘာသာစကား", "ภาษา"),
            onPressed: () {
              final lang = context.read<GwLang>();
              lang.setCode(lang.code == "my"
                  ? "en"
                  : lang.code == "en"
                      ? "th"
                      : "my");
            },
            icon: const Icon(Icons.translate),
          ),
          IconButton(
            tooltip: tr3(context, "Refresh", "ပြန်ဆွဲ", "รีเฟรช"),
            onPressed: _loading ? null : _load,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      floatingActionButton: blocked
          ? null
          : FloatingActionButton.extended(
              onPressed: () => _openEditor(),
              icon: const Icon(Icons.add_location_alt_outlined),
              label: Text(tr3(context, "Add place", "နေရာထည့်", "เพิ่มสถานที่")),
            ),
      body: blocked
          ? GwEmpty(
              icon: Icons.lock_outline,
              title: tr3(context, "18+ only", "၁၈+ သီးသန့်", "18+ เท่านั้น"),
              subtitle: tr3(
                context,
                "Add your date of birth in Settings to view this map.",
                "ဤမြေပုံကို ကြည့်ရန် Settings တွင် မွေးသက္ကရာဇ် ဖြည့်ပါ။",
                "กรอกวันเกิดในการตั้งค่าเพื่อดูแผนที่นี้",
              ),
            )
          : Column(
              children: [
                _filters(),
                Expanded(
                  child: _loading
                      ? const Padding(
                          padding: EdgeInsets.only(top: GwSpace.md),
                          child: GwSkeletonList(count: 6),
                        )
                      : _error != null && _all.isEmpty
                          ? GwEmpty(
                              icon: Icons.cloud_off,
                              title: tr3(context, "Couldn't load the map",
                                  "မြေပုံ ဆွဲမရပါ", "โหลดแผนที่ไม่ได้"),
                              subtitle: _error,
                              actionLabel: tr3(context, "Try again",
                                  "ထပ်ကြိုးစား", "ลองอีกครั้ง"),
                              onAction: _load,
                            )
                          : _mapView
                              ? _mapBody(shown)
                              : _listBody(shown),
                ),
              ],
            ),
    );
  }

  Widget _filters() {
    final accent = GwColors.accentOf(context);
    return Container(
      color: GwColors.surfaceOf(context),
      padding: const EdgeInsets.fromLTRB(GwSpace.lg, GwSpace.sm, GwSpace.lg, 0),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: SizedBox(
                  height: 42,
                  child: TextField(
                    controller: _searchCtl,
                    onChanged: (v) => setState(() => _q = v),
                    textInputAction: TextInputAction.search,
                    decoration: InputDecoration(
                      isDense: true,
                      filled: true,
                      fillColor: GwColors.surfaceMutedOf(context),
                      prefixIcon: const Icon(Icons.search, size: 20),
                      suffixIcon: _q.isEmpty
                          ? null
                          : IconButton(
                              icon: const Icon(Icons.close, size: 18),
                              onPressed: () {
                                _searchCtl.clear();
                                setState(() => _q = "");
                              },
                            ),
                      hintText: tr3(context, "Name, address or city",
                          "အမည် / လိပ်စာ / မြို့", "ชื่อ ที่อยู่ หรือเมือง"),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(GwRadius.xl),
                        borderSide: BorderSide.none,
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: GwSpace.sm),
              Container(
                decoration: BoxDecoration(
                  color: GwColors.surfaceMutedOf(context),
                  borderRadius: BorderRadius.circular(GwRadius.xl),
                ),
                child: Row(
                  children: [
                    _viewToggle(Icons.map_outlined, true, accent),
                    _viewToggle(Icons.view_list_outlined, false, accent),
                  ],
                ),
              ),
            ],
          ),
          SizedBox(
            height: 46,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(vertical: GwSpace.sm),
              children: [
                _kindChip(null, tr3(context, "All", "အားလုံး", "ทั้งหมด"),
                    _all.length, accent),
                for (final k in _kinds)
                  _kindChip(k, "${_kindEmoji(k)} ${_kindLabel(context, k)}",
                      _all.where((p) => p.kind == k).length, _kindColor(k)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _viewToggle(IconData icon, bool wantsMap, Color accent) {
    final on = _mapView == wantsMap;
    return GestureDetector(
      onTap: () => setState(() => _mapView = wantsMap),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
        decoration: BoxDecoration(
          color: on ? accent : Colors.transparent,
          borderRadius: BorderRadius.circular(GwRadius.xl),
        ),
        child: Icon(icon,
            size: 20,
            color: on ? Colors.white : GwColors.inkSoftOf(context)),
      ),
    );
  }

  Widget _kindChip(String? kind, String label, int count, Color color) {
    final key = kind ?? "all";
    final on = _kind == key;
    return Padding(
      padding: const EdgeInsets.only(right: GwSpace.sm),
      child: GestureDetector(
        onTap: () => setState(() => _kind = key),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: on ? color : color.withValues(alpha: 0.10),
            borderRadius: BorderRadius.circular(GwRadius.xl),
            border:
                Border.all(color: on ? color : color.withValues(alpha: 0.35)),
          ),
          child: Text(
            "$label  $count",
            style: TextStyle(
              fontSize: 12.5,
              fontWeight: FontWeight.w700,
              color: on ? Colors.white : color,
            ),
          ),
        ),
      ),
    );
  }

  Widget _mapBody(List<CannabisPlace> shown) {
    return Stack(
      children: [
        FlutterMap(
          mapController: _mapCtl,
          options: MapOptions(
            // Bangkok-ish: most of the listings are in Thailand.
            initialCenter:
                shown.isEmpty ? const LatLng(13.75, 100.5) : shown.first.point,
            initialZoom: shown.length == 1 ? 14 : 5.6,
            minZoom: 3,
            maxZoom: 18,
          ),
          children: [
            TileLayer(
              urlTemplate: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
              userAgentPackageName: "ai.gwave.app",
              maxZoom: 19,
              tileProvider: CachingTileProvider(
                layerKey: "osm",
                userAgent: "ai.gwave.app",
              ),
            ),
            MarkerLayer(
              markers: [
                for (final p in shown)
                  Marker(
                    point: p.point,
                    width: 40,
                    height: 44,
                    alignment: Alignment.topCenter,
                    child: GestureDetector(
                      onTap: () => _openPlace(p),
                      child: _PlacePin(kind: p.kind),
                    ),
                  ),
              ],
            ),
          ],
        ),
        if (shown.isNotEmpty)
          Positioned(
            left: GwSpace.lg,
            right: GwSpace.lg,
            bottom: GwSpace.lg,
            child: SizedBox(
              height: 96,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: shown.length,
                separatorBuilder: (_, __) => const SizedBox(width: GwSpace.sm),
                itemBuilder: (_, i) => _MiniPlaceCard(
                  place: shown[i],
                  onTap: () {
                    _mapCtl.move(shown[i].point, 15);
                    _openPlace(shown[i]);
                  },
                ),
              ),
            ),
          ),
      ],
    );
  }

  Widget _listBody(List<CannabisPlace> shown) {
    if (shown.isEmpty) {
      return GwEmpty(
        icon: Icons.storefront_outlined,
        title: tr3(context, "No places yet", "နေရာ မရှိသေးပါ",
            "ยังไม่มีสถานที่"),
        subtitle: tr3(
          context,
          "Be the first. A listing needs photos, the full address, a phone number and an exact location.",
          "ပထမဆုံး ထည့်သူ ဖြစ်လိုက်ပါ။ ဓာတ်ပုံ၊ လိပ်စာအပြည့်အစုံ၊ ဖုန်းနံပါတ်နှင့် တည်နေရာ အတိအကျ လိုအပ်သည်။",
          "เป็นคนแรกเลย ต้องมีรูป ที่อยู่เต็ม เบอร์โทร และพิกัดที่แน่นอน",
        ),
        actionLabel: tr3(context, "Add a place", "နေရာထည့်", "เพิ่มสถานที่"),
        onAction: () => _openEditor(),
      );
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.builder(
        padding:
            const EdgeInsets.fromLTRB(GwSpace.lg, GwSpace.md, GwSpace.lg, 96),
        itemCount: shown.length + 1,
        itemBuilder: (_, i) {
          if (i == shown.length) {
            return Padding(
              padding: const EdgeInsets.only(top: GwSpace.sm),
              child: Text(
                tr3(
                  context,
                  "Anything wrong? Any user can fix a listing. Report fake or wrong entries and an admin will remove them.",
                  "အချက်အလက် မှားနေရင် user တိုင်း ပြင်ခွင့်ရှိသည်။ မှားတဲ့/အတုအယောင် နေရာများကို တိုင်ကြားပါ — admin ဖျက်ပါလိမ့်မယ်။",
                  "ข้อมูลผิด? ผู้ใช้ทุกคนแก้ไขได้ รายงานรายการปลอมหรือผิด ผู้ดูแลจะลบให้",
                ),
                style: TextStyle(
                    fontSize: 11.5,
                    height: 1.5,
                    color: GwColors.inkSoftOf(context)),
              ),
            );
          }
          return Padding(
            padding: const EdgeInsets.only(bottom: GwSpace.md),
            child: _PlaceCard(
              place: shown[i],
              onTap: () => _openPlace(shown[i]),
            ),
          );
        },
      ),
    );
  }
}

class _PlacePin extends StatelessWidget {
  const _PlacePin({required this.kind});
  final String kind;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 32,
          height: 32,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: _kindColor(kind),
            shape: BoxShape.circle,
            border: Border.all(color: Colors.white, width: 2),
            boxShadow: const [
              BoxShadow(
                  color: Color(0x66000000),
                  blurRadius: 4,
                  offset: Offset(0, 2)),
            ],
          ),
          child: Text(_kindEmoji(kind), style: const TextStyle(fontSize: 14)),
        ),
        Container(width: 2, height: 8, color: Colors.white),
      ],
    );
  }
}

class _MiniPlaceCard extends StatelessWidget {
  const _MiniPlaceCard({required this.place, required this.onTap});
  final CannabisPlace place;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final photo = resolveMedia(
        place.photos.isEmpty ? null : place.photos.first,
        bucket: "media");
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 250,
        padding: const EdgeInsets.all(GwSpace.sm),
        decoration: BoxDecoration(
          color: GwColors.surfaceOf(context),
          borderRadius: BorderRadius.circular(GwRadius.lg),
          boxShadow: GwShadow.raised,
        ),
        child: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(GwRadius.md),
              child: photo == null
                  ? Container(
                      width: 76,
                      height: 76,
                      color: _kindColor(place.kind).withValues(alpha: 0.15),
                      alignment: Alignment.center,
                      child: Text(_kindEmoji(place.kind),
                          style: const TextStyle(fontSize: 26)),
                    )
                  : Image.network(photo,
                      width: 76, height: 76, fit: BoxFit.cover),
            ),
            const SizedBox(width: GwSpace.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(place.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontWeight: FontWeight.w800, fontSize: 14)),
                  Text(
                    "${_kindEmoji(place.kind)} ${_kindLabel(context, place.kind)}",
                    style: TextStyle(
                        fontSize: 12, color: _kindColor(place.kind)),
                  ),
                  Text(place.city ?? place.address,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                          fontSize: 11.5,
                          color: GwColors.inkSoftOf(context))),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PlaceCard extends StatelessWidget {
  const _PlaceCard({required this.place, required this.onTap});
  final CannabisPlace place;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final photo = resolveMedia(
        place.photos.isEmpty ? null : place.photos.first,
        bucket: "media");
    return GwCard(
      onTap: onTap,
      accent: _kindColor(place.kind),
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (photo != null)
            ClipRRect(
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(GwRadius.lg),
                topRight: Radius.circular(GwRadius.lg),
              ),
              child: Image.network(
                photo,
                height: 150,
                width: double.infinity,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => Container(
                  height: 150,
                  color: _kindColor(place.kind).withValues(alpha: 0.12),
                  alignment: Alignment.center,
                  child: Text(_kindEmoji(place.kind),
                      style: const TextStyle(fontSize: 36)),
                ),
              ),
            ),
          Padding(
            padding: const EdgeInsets.all(GwSpace.md),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(place.name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                              fontWeight: FontWeight.w800, fontSize: 15.5)),
                    ),
                    if (place.reportCount > 0)
                      GwPill(
                        label: "⚠ ${place.reportCount}",
                        color: const Color(0xFFD97706),
                      ),
                  ],
                ),
                const SizedBox(height: GwSpace.xs),
                GwPill(
                  label:
                      "${_kindEmoji(place.kind)} ${_kindLabel(context, place.kind)}",
                  color: _kindColor(place.kind),
                ),
                const SizedBox(height: GwSpace.sm),
                Text(
                  "${place.city != null && place.city!.isNotEmpty ? "${place.city} · " : ""}${place.address}",
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                      fontSize: 12.5, color: GwColors.inkSoftOf(context)),
                ),
                Text("📞 ${place.phone}",
                    style: TextStyle(
                        fontSize: 12, color: GwColors.inkSoftOf(context))),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _PlaceSheet extends StatelessWidget {
  const _PlaceSheet({
    required this.place,
    required this.onEdit,
    required this.onChanged,
  });

  final CannabisPlace place;
  final VoidCallback onEdit;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    final photos = place.photos
        .map((p) => resolveMedia(p, bucket: "media"))
        .whereType<String>()
        .toList();
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.72,
      maxChildSize: 0.95,
      builder: (_, controller) => ListView(
        controller: controller,
        padding: EdgeInsets.zero,
        children: [
          if (photos.isNotEmpty)
            SizedBox(
              height: 220,
              child: PageView.builder(
                itemCount: photos.length,
                itemBuilder: (_, i) => Image.network(
                  photos[i],
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => Container(
                    color: _kindColor(place.kind).withValues(alpha: 0.12),
                    alignment: Alignment.center,
                    child: Text(_kindEmoji(place.kind),
                        style: const TextStyle(fontSize: 44)),
                  ),
                ),
              ),
            ),
          Padding(
            padding: const EdgeInsets.all(GwSpace.lg),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(place.name,
                    style: const TextStyle(
                        fontSize: 20, fontWeight: FontWeight.w900)),
                const SizedBox(height: GwSpace.sm),
                Wrap(
                  spacing: GwSpace.sm,
                  runSpacing: GwSpace.xs,
                  children: [
                    GwPill(
                      label:
                          "${_kindEmoji(place.kind)} ${_kindLabel(context, place.kind)}",
                      color: _kindColor(place.kind),
                      filled: true,
                    ),
                    if (place.reportCount > 0)
                      GwPill(
                        label:
                            "⚠ ${place.reportCount} ${tr3(context, "reports", "တိုင်ကြားချက်", "รายงาน")}",
                        color: const Color(0xFFD97706),
                      ),
                  ],
                ),
                const SizedBox(height: GwSpace.lg),
                _row(context, Icons.place_outlined,
                    "${place.address}${place.city != null && place.city!.isNotEmpty ? ", ${place.city}" : ""}"),
                _row(context, Icons.phone_outlined, place.phone),
                if (place.hours != null && place.hours!.isNotEmpty)
                  _row(context, Icons.schedule_outlined, place.hours!),
                if (place.tags != null && place.tags!.isNotEmpty)
                  _row(context, Icons.sell_outlined, place.tags!),
                if (place.website != null && place.website!.isNotEmpty)
                  _row(context, Icons.link, place.website!),
                if (place.description != null && place.description!.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: GwSpace.md),
                    child: Text(place.description!,
                        style: const TextStyle(height: 1.5)),
                  ),
                const SizedBox(height: GwSpace.lg),
                Row(
                  children: [
                    Expanded(
                      child: FilledButton.icon(
                        onPressed: () => _call(),
                        icon: const Icon(Icons.call, size: 18),
                        label: Text(tr3(context, "Call", "ဖုန်းဆက်", "โทร")),
                      ),
                    ),
                    const SizedBox(width: GwSpace.sm),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => _navigate(),
                        icon: const Icon(Icons.directions, size: 18),
                        label: Text(
                            tr3(context, "Directions", "လမ်းညွှန်", "เส้นทาง")),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: GwSpace.sm),
                Row(
                  children: [
                    Expanded(
                      child: TextButton.icon(
                        onPressed: onEdit,
                        icon: const Icon(Icons.edit_outlined, size: 18),
                        label: Text(tr3(context, "Edit", "ပြင်", "แก้ไข")),
                      ),
                    ),
                    Expanded(
                      child: TextButton.icon(
                        onPressed: () => _report(context),
                        icon: const Icon(Icons.flag_outlined,
                            size: 18, color: Color(0xFFD97706)),
                        label: Text(
                          tr3(context, "Report", "တိုင်ကြား", "รายงาน"),
                          style: const TextStyle(color: Color(0xFFD97706)),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _row(BuildContext context, IconData icon, String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: GwSpace.sm),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 17, color: GwColors.inkSoftOf(context)),
          const SizedBox(width: GwSpace.sm),
          Expanded(child: Text(text, style: const TextStyle(height: 1.4))),
        ],
      ),
    );
  }

  Future<void> _call() async {
    final uri = Uri.parse("tel:${place.phone}");
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  Future<void> _navigate() async {
    final geo = Uri.parse("geo:${place.latitude},${place.longitude}?q="
        "${place.latitude},${place.longitude}(${Uri.encodeComponent(place.name)})");
    if (await canLaunchUrl(geo)) {
      await launchUrl(geo, mode: LaunchMode.externalApplication);
      return;
    }
    await launchUrl(
      Uri.parse("https://www.google.com/maps/dir/?api=1&destination="
          "${place.latitude},${place.longitude}"),
      mode: LaunchMode.externalApplication,
    );
  }

  Future<void> _report(BuildContext context) async {
    final ctl = TextEditingController();
    final reason = await showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(tr3(dialogContext, "Report this listing", "တိုင်ကြားမည်",
            "รายงานรายการนี้")),
        content: TextField(
          controller: ctl,
          autofocus: true,
          maxLines: 3,
          decoration: InputDecoration(
            hintText: tr3(
              dialogContext,
              "Closed down / wrong address / fake",
              "ပိတ်သွားပြီ / လိပ်စာမှား / အတုအယောင်",
              "ปิดกิจการ / ที่อยู่ผิด / ปลอม",
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: Text(tr3(dialogContext, "Cancel", "မလုပ်တော့", "ยกเลิก")),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(ctl.text.trim()),
            child: Text(tr3(dialogContext, "Send", "ပို့မည်", "ส่ง")),
          ),
        ],
      ),
    );
    if (reason == null || reason.length < 3) return;
    if (!context.mounted) return;
    final messenger = ScaffoldMessenger.of(context);
    final done = tr3(context, "Reported — an admin will review it.",
        "တိုင်ကြားပြီးပါပြီ — admin စစ်ဆေးပါလိမ့်မယ်။",
        "รายงานแล้ว — ผู้ดูแลจะตรวจสอบ");
    try {
      await context.read<AppState>().api.cannabisPlaceReport(place.id, reason);
      messenger.showSnackBar(SnackBar(content: Text(done)));
      onChanged();
    } on ApiException catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.message)));
    }
  }
}

/// Add or correct a listing. Refuses to submit until it is complete, and names
/// the missing field — on a field connection that beats uploading photos only
/// to have the server reject the whole thing.
class CannabisPlaceEditor extends StatefulWidget {
  const CannabisPlaceEditor({super.key, this.editing});
  final CannabisPlace? editing;

  @override
  State<CannabisPlaceEditor> createState() => _CannabisPlaceEditorState();
}

class _CannabisPlaceEditorState extends State<CannabisPlaceEditor> {
  final _name = TextEditingController();
  final _address = TextEditingController();
  final _phone = TextEditingController();
  final _city = TextEditingController();
  final _hours = TextEditingController();
  final _website = TextEditingController();
  final _tags = TextEditingController();
  final _description = TextEditingController();

  String _kind = "shop";
  final List<String> _photos = [];
  LatLng? _point;
  bool _busy = false;
  bool _locating = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final e = widget.editing;
    if (e != null) {
      _kind = e.kind;
      _name.text = e.name;
      _address.text = e.address;
      _phone.text = e.phone;
      _city.text = e.city ?? "";
      _hours.text = e.hours ?? "";
      _website.text = e.website ?? "";
      _tags.text = e.tags ?? "";
      _description.text = e.description ?? "";
      _photos.addAll(e.photos);
      _point = e.point;
    }
  }

  @override
  void dispose() {
    _name.dispose();
    _address.dispose();
    _phone.dispose();
    _city.dispose();
    _hours.dispose();
    _website.dispose();
    _tags.dispose();
    _description.dispose();
    super.dispose();
  }

  Future<void> _addPhoto(ImageSource source) async {
    if (_photos.length >= 8) return;
    try {
      final file = await ImagePicker()
          .pickImage(source: source, imageQuality: 82, maxWidth: 1600);
      if (file == null) return;
      setState(() => _busy = true);
      final bytes = await File(file.path).readAsBytes();
      if (!mounted) return;
      final path = await context
          .read<AppState>()
          .api
          .uploadBytes(bytes, ext: "jpg", contentType: "image/jpeg");
      if (!mounted) return;
      setState(() => _photos.add(path));
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _useGps() async {
    final offMessage = tr3(context, "Turn on location.", "Location ဖွင့်ပါ။",
        "เปิดตำแหน่งที่ตั้ง");
    final deniedMessage = tr3(context, "Location permission denied.",
        "Location ခွင့်ပြုချက် မရပါ။", "ไม่ได้รับสิทธิ์ตำแหน่ง");
    setState(() => _locating = true);
    try {
      if (!await Geolocator.isLocationServiceEnabled()) {
        throw Exception(offMessage);
      }
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
      }
      if (perm == LocationPermission.denied ||
          perm == LocationPermission.deniedForever) {
        throw Exception(deniedMessage);
      }
      final pos = await Geolocator.getCurrentPosition(
        locationSettings:
            const LocationSettings(accuracy: LocationAccuracy.high),
      ).timeout(const Duration(seconds: 20));
      if (!mounted) return;
      setState(() => _point = LatLng(pos.latitude, pos.longitude));
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _locating = false);
    }
  }

  Future<void> _save() async {
    if (_name.text.trim().length < 2 ||
        _address.text.trim().length < 5 ||
        _phone.text.trim().length < 6 ||
        _point == null ||
        _photos.isEmpty) {
      setState(() => _error = tr3(
            context,
            "Required: name, full address, phone, location and at least one photo.",
            "ဖြည့်ရန် လိုအပ်သည် — အမည်၊ လိပ်စာအပြည့်အစုံ၊ ဖုန်း၊ တည်နေရာနှင့် ဓာတ်ပုံ ၁ ပုံ။",
            "ต้องกรอก: ชื่อ ที่อยู่เต็ม เบอร์โทร พิกัด และรูปอย่างน้อย 1 รูป",
          ));
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    final navigator = Navigator.of(context);
    try {
      await context.read<AppState>().api.cannabisPlaceSave(
        {
          "kind": _kind,
          "name": _name.text.trim(),
          "address": _address.text.trim(),
          "phone": _phone.text.trim(),
          "latitude": _point!.latitude,
          "longitude": _point!.longitude,
          "photos": _photos,
          if (_city.text.trim().isNotEmpty) "city": _city.text.trim(),
          if (_hours.text.trim().isNotEmpty) "hours": _hours.text.trim(),
          if (_website.text.trim().isNotEmpty) "website": _website.text.trim(),
          if (_tags.text.trim().isNotEmpty) "tags": _tags.text.trim(),
          if (_description.text.trim().isNotEmpty)
            "description": _description.text.trim(),
        },
        id: widget.editing?.id,
      );
      navigator.pop(true);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: GwColors.bgOf(context),
      appBar: AppBar(
        title: Text(widget.editing != null
            ? tr3(context, "Correct this listing", "အချက်အလက် ပြင်မည်",
                "แก้ไขรายการนี้")
            : tr3(context, "Add a place", "နေရာ ထည့်မည်", "เพิ่มสถานที่")),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(
            GwSpace.lg, GwSpace.lg, GwSpace.lg, GwSpace.xxl),
        children: [
          _header(tr3(context, "Type", "အမျိုးအစား", "ประเภท"),
              icon: Icons.category_outlined),
          Wrap(
            spacing: GwSpace.sm,
            children: [
              for (final k in _kinds)
                ChoiceChip(
                  label:
                      Text("${_kindEmoji(k)} ${_kindLabel(context, k)}"),
                  selected: _kind == k,
                  onSelected: (_) => setState(() => _kind = k),
                ),
            ],
          ),
          _header(tr3(context, "Details", "အသေးစိတ်", "รายละเอียด"),
              icon: Icons.storefront_outlined),
          _field(_name, tr3(context, "Name *", "အမည် *", "ชื่อ *")),
          _field(_address,
              tr3(context, "Full address *", "လိပ်စာ အတိအကျ *", "ที่อยู่เต็ม *"),
              lines: 2),
          _field(_phone, tr3(context, "Phone *", "ဖုန်းနံပါတ် *", "เบอร์โทร *")),
          _field(_city, tr3(context, "City", "မြို့", "เมือง")),
          _field(_hours,
              tr3(context, "Opening hours", "ဖွင့်ချိန်", "เวลาเปิด")),
          _field(_website, tr3(context, "Website / Facebook", "Website / Facebook",
              "เว็บไซต์ / เฟซบุ๊ก")),
          _field(
              _tags,
              tr3(context, "Tags (delivery, medical, CBD…)",
                  "အမျိုးအစား (delivery, medical, CBD…)", "แท็ก")),
          _field(_description,
              tr3(context, "Description", "အကြောင်းအရာ", "รายละเอียด"),
              lines: 3),
          _header(tr3(context, "Photos *", "ဓာတ်ပုံ *", "รูปภาพ *"),
              subtitle: tr3(context, "At least one, up to eight.",
                  "အနည်းဆုံး ၁ ပုံ၊ အများဆုံး ၈ ပုံ။", "อย่างน้อย 1 รูป สูงสุด 8 รูป"),
              icon: Icons.photo_camera_outlined),
          _photoStrip(),
          _header(
              tr3(context, "Exact location *", "တည်နေရာ အတိအကျ *",
                  "พิกัดที่แน่นอน *"),
              icon: Icons.place_outlined),
          _locationPicker(),
          if (_error != null) ...[
            const SizedBox(height: GwSpace.md),
            Text(_error!,
                style:
                    const TextStyle(color: Color(0xFFDC2626), fontSize: 12.5)),
          ],
          const SizedBox(height: GwSpace.lg),
          FilledButton.icon(
            onPressed: _busy ? null : _save,
            icon: _busy
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white),
                  )
                : const Icon(Icons.check),
            label: Text(_busy
                ? tr3(context, "Saving…", "သိမ်းနေသည်…", "กำลังบันทึก…")
                : tr3(context, "Save", "သိမ်းမည်", "บันทึก")),
          ),
        ],
      ),
    );
  }

  /// The list already pads its edges, so headings use their own row rather
  /// than GwSectionHeader's built-in 16px gutter.
  Widget _header(String title, {String? subtitle, IconData? icon}) {
    return Padding(
      padding: const EdgeInsets.only(top: GwSpace.lg, bottom: GwSpace.sm),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 18, color: GwColors.accentOf(context)),
            const SizedBox(width: GwSpace.sm),
          ],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 15.5,
                        color: GwColors.inkOf(context))),
                if (subtitle != null)
                  Text(subtitle,
                      style: TextStyle(
                          fontSize: 12,
                          color: GwColors.inkSoftOf(context))),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _field(TextEditingController c, String label, {int lines = 1}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: GwSpace.sm),
      child: TextField(
        controller: c,
        maxLines: lines,
        decoration: InputDecoration(
          labelText: label,
          filled: true,
          fillColor: GwColors.surfaceOf(context),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(GwRadius.md),
            borderSide: BorderSide(color: GwColors.lineOf(context)),
          ),
        ),
      ),
    );
  }

  Widget _photoStrip() {
    return SizedBox(
      height: 92,
      child: ListView(
        scrollDirection: Axis.horizontal,
        children: [
          for (final p in _photos)
            Padding(
              padding: const EdgeInsets.only(right: GwSpace.sm),
              child: Stack(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(GwRadius.md),
                    child: Image.network(
                      resolveMedia(p, bucket: "media") ?? "",
                      width: 88,
                      height: 88,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => Container(
                        width: 88,
                        height: 88,
                        color: GwColors.surfaceMutedOf(context),
                        child: const Icon(Icons.broken_image_outlined),
                      ),
                    ),
                  ),
                  Positioned(
                    right: 2,
                    top: 2,
                    child: GestureDetector(
                      onTap: () => setState(() => _photos.remove(p)),
                      child: const CircleAvatar(
                        radius: 11,
                        backgroundColor: Color(0xCCDC2626),
                        child: Icon(Icons.close, size: 13, color: Colors.white),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          if (_photos.length < 8) ...[
            _photoButton(Icons.photo_camera_outlined, ImageSource.camera),
            _photoButton(Icons.photo_library_outlined, ImageSource.gallery),
          ],
        ],
      ),
    );
  }

  Widget _photoButton(IconData icon, ImageSource source) {
    return Padding(
      padding: const EdgeInsets.only(right: GwSpace.sm),
      child: GestureDetector(
        onTap: _busy ? null : () => _addPhoto(source),
        child: Container(
          width: 88,
          height: 88,
          decoration: BoxDecoration(
            color: GwColors.surfaceOf(context),
            borderRadius: BorderRadius.circular(GwRadius.md),
            border: Border.all(color: GwColors.lineOf(context)),
          ),
          child: Icon(icon, color: GwColors.inkSoftOf(context)),
        ),
      ),
    );
  }

  Widget _locationPicker() {
    final point = _point;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                tr3(context, "Tap the map to set the point",
                    "မြေပုံပေါ် နှိပ်၍ ရွေးပါ", "แตะแผนที่เพื่อระบุพิกัด"),
                style: TextStyle(
                    fontSize: 12.5, color: GwColors.inkSoftOf(context)),
              ),
            ),
            TextButton.icon(
              onPressed: _locating ? null : _useGps,
              icon: _locating
                  ? const SizedBox(
                      width: 14,
                      height: 14,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.my_location, size: 16),
              label: Text(tr3(context, "Use GPS", "GPS သုံးမည်", "ใช้ GPS")),
            ),
          ],
        ),
        ClipRRect(
          borderRadius: BorderRadius.circular(GwRadius.md),
          child: SizedBox(
            height: 220,
            child: FlutterMap(
              options: MapOptions(
                initialCenter: point ?? const LatLng(13.75, 100.5),
                initialZoom: point == null ? 5.6 : 15,
                onTap: (_, latlng) => setState(() => _point = latlng),
              ),
              children: [
                TileLayer(
                  urlTemplate: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
                  userAgentPackageName: "ai.gwave.app",
                  maxZoom: 19,
                  tileProvider: CachingTileProvider(
                    layerKey: "osm",
                    userAgent: "ai.gwave.app",
                  ),
                ),
                if (point != null)
                  MarkerLayer(
                    markers: [
                      Marker(
                        point: point,
                        width: 36,
                        height: 40,
                        alignment: Alignment.topCenter,
                        child: _PlacePin(kind: _kind),
                      ),
                    ],
                  ),
              ],
            ),
          ),
        ),
        if (point != null)
          Padding(
            padding: const EdgeInsets.only(top: GwSpace.xs),
            child: Text(
              "📍 ${point.latitude.toStringAsFixed(6)}, ${point.longitude.toStringAsFixed(6)}",
              style:
                  TextStyle(fontSize: 11.5, color: GwColors.inkSoftOf(context)),
            ),
          ),
      ],
    );
  }
}
