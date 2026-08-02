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
import 'mine_metals.dart';

/// The community mine-site map, native.
///
/// The metal board tells a trader what tin is worth; this tells them where it
/// is dug. Every pin is user-contributed: anyone signed in can add a site or
/// correct one, anyone can report a bad pin, and an admin removes it. The same
/// rows back gwave.cc/minerals/mines, so a pin dropped in the field shows up in
/// the browser.
///
/// The screen is deliberately two views over one list — a map for "what is
/// around me" and a list for "show me everything" — because on a phone a map
/// alone hides the detail and a list alone hides the geography.
class MineSitesScreen extends StatefulWidget {
  const MineSitesScreen({super.key});

  @override
  State<MineSitesScreen> createState() => _MineSitesScreenState();
}

/// One pin, parsed once so the widgets don't index a raw JSON map.
class MineSite {
  MineSite(Map<String, dynamic> j)
      : id = (j["id"] ?? "").toString(),
        metal = (j["metal"] ?? "other").toString(),
        name = (j["name"] ?? "").toString(),
        region = (j["region"] ?? "").toString(),
        township = (j["township"] ?? "").toString(),
        latitude = (j["latitude"] as num?)?.toDouble() ?? 0,
        longitude = (j["longitude"] as num?)?.toDouble() ?? 0,
        photos = ((j["photos"] as List?) ?? const [])
            .map((p) => p.toString())
            .where((p) => p.isNotEmpty)
            .toList(),
        scale = (j["scale"] ?? "unknown").toString(),
        status = (j["status"] ?? "unknown").toString(),
        operator = j["operator"]?.toString(),
        description = j["description"]?.toString(),
        access = j["access"]?.toString(),
        hazard = j["hazard"]?.toString(),
        tags = j["tags"]?.toString(),
        reportCount = (j["report_count"] as num?)?.toInt() ?? 0;

  final String id;
  final String metal;
  final String name;
  final String region;
  final String township;
  final double latitude;
  final double longitude;
  final List<String> photos;
  final String scale;
  final String status;
  final String? operator;
  final String? description;
  final String? access;
  final String? hazard;
  final String? tags;
  final int reportCount;

  LatLng get point => LatLng(latitude, longitude);
}

class _MineSitesScreenState extends State<MineSitesScreen> {
  final _mapCtl = MapController();
  final _searchCtl = TextEditingController();

  List<MineSite> _all = [];
  bool _loading = true;
  String? _error;
  String _metal = "all";
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
      final rows = await context.read<AppState>().api.mineSites();
      if (!mounted) return;
      setState(() => _all = rows.map(MineSite.new).toList());
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<MineSite> get _shown {
    final needle = _q.trim().toLowerCase();
    return _all.where((s) {
      if (_metal != "all" && s.metal != _metal) return false;
      if (needle.isEmpty) return true;
      return s.name.toLowerCase().contains(needle) ||
          s.township.toLowerCase().contains(needle) ||
          s.region.toLowerCase().contains(needle) ||
          (s.operator ?? "").toLowerCase().contains(needle) ||
          (s.tags ?? "").toLowerCase().contains(needle);
    }).toList();
  }

  /// Only offer a chip for a mineral that actually has a pin (plus whichever is
  /// selected), so the filter row isn't sixteen empty categories.
  List<MineMetal> get _chips {
    final counts = <String, int>{};
    for (final s in _all) {
      counts[s.metal] = (counts[s.metal] ?? 0) + 1;
    }
    return kMineMetals
        .where((m) => counts.containsKey(m.key) || m.key == _metal)
        .toList();
  }

  int _countFor(String key) => _all.where((s) => s.metal == key).length;

  Future<void> _openEditor([MineSite? editing]) async {
    final saved = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => MineEditorScreen(editing: editing)),
    );
    if (saved == true) _load();
  }

  void _openSite(MineSite site) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _MineDetailSheet(
        site: site,
        onEdit: () {
          Navigator.of(context).pop();
          _openEditor(site);
        },
        onChanged: _load,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final accent = GwColors.accentOf(context);
    final shown = _shown;
    return Scaffold(
      backgroundColor: GwColors.bgOf(context),
      appBar: AppBar(
        title: Text(tr3(context, "Mine sites", "မိုင်းနေရာများ", "แหล่งเหมือง")),
        actions: [
          IconButton(
            tooltip: tr3(context, "Language", "ဘာသာစကား", "ภาษา"),
            onPressed: _cycleLanguage,
            icon: const Icon(Icons.translate),
          ),
          IconButton(
            tooltip: tr3(context, "Help", "အကူအညီ", "ช่วยเหลือ"),
            onPressed: _openGuide,
            icon: const Icon(Icons.help_outline),
          ),
          IconButton(
            tooltip: tr3(context, "Refresh", "ပြန်ဆွဲ", "รีเฟรช"),
            onPressed: _loading ? null : _load,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _openEditor(),
        icon: const Icon(Icons.add_location_alt_outlined),
        label: Text(tr3(context, "Add site", "နေရာထည့်", "เพิ่มแหล่ง")),
      ),
      body: Column(
        children: [
          _searchAndFilters(accent),
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
                        actionLabel: tr3(context, "Try again", "ထပ်ကြိုးစား",
                            "ลองอีกครั้ง"),
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

  Future<void> _cycleLanguage() async {
    final lang = context.read<GwLang>();
    final next = lang.code == "my"
        ? "en"
        : lang.code == "en"
            ? "th"
            : "my";
    await lang.setCode(next);
  }

  Widget _searchAndFilters(Color accent) {
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
                      hintText: tr3(
                        context,
                        "Mine, township or state",
                        "မိုင်း / မြို့နယ် / ပြည်နယ်",
                        "เหมือง อำเภอ หรือรัฐ",
                      ),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(GwRadius.xl),
                        borderSide: BorderSide.none,
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: GwSpace.sm),
              // Map / list is the same data seen two ways; a segmented toggle
              // says that better than two separate tabs would.
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
                _metalChip(
                  null,
                  tr3(context, "All", "အားလုံး", "ทั้งหมด"),
                  _all.length,
                  accent,
                ),
                for (final m in _chips)
                  _metalChip(
                    m,
                    tr3(context, m.en, m.my, m.th),
                    _countFor(m.key),
                    m.color,
                  ),
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
        child: Icon(
          icon,
          size: 20,
          color: on ? Colors.white : GwColors.inkSoftOf(context),
        ),
      ),
    );
  }

  Widget _metalChip(MineMetal? metal, String label, int count, Color color) {
    final key = metal?.key ?? "all";
    final on = _metal == key;
    return Padding(
      padding: const EdgeInsets.only(right: GwSpace.sm),
      child: GestureDetector(
        onTap: () => setState(() => _metal = key),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: on ? color : color.withValues(alpha: 0.10),
            borderRadius: BorderRadius.circular(GwRadius.xl),
            border: Border.all(
              color: on ? color : color.withValues(alpha: 0.35),
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (metal != null) ...[
                Text(metal.emoji, style: const TextStyle(fontSize: 13)),
                const SizedBox(width: 5),
              ],
              Text(
                label,
                style: TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w700,
                  color: on ? Colors.white : color,
                ),
              ),
              const SizedBox(width: 5),
              Text(
                "$count",
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  color: on
                      ? Colors.white.withValues(alpha: 0.85)
                      : color.withValues(alpha: 0.75),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _mapBody(List<MineSite> shown) {
    // Country view when nothing is picked; the pins themselves carry the
    // geography, so there is no auto-fit fighting the user's panning.
    return Stack(
      children: [
        FlutterMap(
          mapController: _mapCtl,
          options: MapOptions(
            initialCenter: shown.isEmpty
                ? const LatLng(21.0, 96.5)
                : shown.first.point,
            initialZoom: shown.length == 1 ? 12 : 5.4,
            minZoom: 3,
            maxZoom: 18,
          ),
          children: [
            TileLayer(
              urlTemplate:
                  "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
              userAgentPackageName: "ai.gwave.app",
              maxZoom: 19,
              tileProvider: CachingTileProvider(
                layerKey: "osm",
                userAgent: "ai.gwave.app",
              ),
            ),
            MarkerLayer(
              markers: [
                for (final s in shown)
                  Marker(
                    point: s.point,
                    width: 40,
                    height: 44,
                    alignment: Alignment.topCenter,
                    child: GestureDetector(
                      onTap: () => _openSite(s),
                      child: _MinePin(metal: metalOf(s.metal)),
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
                itemBuilder: (_, i) => _MiniSiteCard(
                  site: shown[i],
                  onTap: () {
                    _mapCtl.move(shown[i].point, 13);
                    _openSite(shown[i]);
                  },
                ),
              ),
            ),
          ),
        if (shown.isEmpty)
          Positioned(
            left: GwSpace.lg,
            right: GwSpace.lg,
            bottom: GwSpace.xxl,
            child: GwCard(
              child: Text(
                tr3(
                  context,
                  "No pins match. Add the first site for this mineral.",
                  "ကိုက်ညီသော နေရာ မရှိပါ — ဒီသတ္တုအတွက် ပထမဆုံး နေရာ ထည့်ပါ။",
                  "ไม่พบหมุดที่ตรงกัน — เพิ่มแห่งแรกของแร่นี้",
                ),
                style: TextStyle(color: GwColors.inkSoftOf(context)),
              ),
            ),
          ),
      ],
    );
  }

  Widget _listBody(List<MineSite> shown) {
    if (shown.isEmpty) {
      return GwEmpty(
        icon: Icons.terrain_outlined,
        title: tr3(context, "No mine sites yet", "မိုင်းနေရာ မရှိသေးပါ",
            "ยังไม่มีแหล่งเหมือง"),
        subtitle: tr3(
          context,
          "Be the first. A pin needs photos, the township and an exact location.",
          "ပထမဆုံး ထည့်သူ ဖြစ်လိုက်ပါ။ ဓာတ်ပုံ၊ မြို့နယ်နှင့် တည်နေရာ အတိအကျ လိုအပ်သည်။",
          "เป็นคนแรกเลย ต้องมีรูป อำเภอ และพิกัดที่แน่นอน",
        ),
        actionLabel: tr3(context, "Add a site", "နေရာထည့်", "เพิ่มแหล่ง"),
        onAction: () => _openEditor(),
      );
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(
            GwSpace.lg, GwSpace.md, GwSpace.lg, 96),
        itemCount: shown.length + 1,
        itemBuilder: (_, i) {
          if (i == shown.length) return _disclaimer();
          final s = shown[i];
          return Padding(
            padding: const EdgeInsets.only(bottom: GwSpace.md),
            child: _SiteCard(site: s, onTap: () => _openSite(s)),
          );
        },
      ),
    );
  }

  Widget _disclaimer() {
    return Container(
      margin: const EdgeInsets.only(top: GwSpace.sm),
      padding: const EdgeInsets.all(GwSpace.md),
      decoration: BoxDecoration(
        color: const Color(0xFFF59E0B).withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(GwRadius.lg),
        border: Border.all(color: const Color(0xFFF59E0B).withValues(alpha: 0.4)),
      ),
      child: Text(
        tr3(
          context,
          "⚠ User-submitted information, not an official record. Verify access "
              "routes and hazards yourself before travelling. Mining without a "
              "licence is illegal.",
          "⚠ ဤအချက်အလက်များသည် user များ တင်ပြထားသည်သာ — တရားဝင် အတည်ပြုချက် "
              "မဟုတ်ပါ။ လမ်းကြောင်းနှင့် အန္တရာယ်များကို ကိုယ်တိုင် ထပ်မံစစ်ဆေးပါ။ "
              "ခွင့်ပြုချက်မရှိဘဲ သတ္တုတူးဖော်ခြင်း တရားမဝင်ပါ။",
          "⚠ เป็นข้อมูลที่ผู้ใช้ส่งเข้ามา ไม่ใช่ข้อมูลทางการ โปรดตรวจสอบเส้นทาง"
              "และอันตรายด้วยตนเองก่อนเดินทาง การทำเหมืองโดยไม่มีใบอนุญาตผิดกฎหมาย",
        ),
        style: const TextStyle(fontSize: 11.5, height: 1.5),
      ),
    );
  }

  void _openGuide() {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (_) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.6,
        maxChildSize: 0.92,
        builder: (_, controller) => ListView(
          controller: controller,
          padding: const EdgeInsets.fromLTRB(
              GwSpace.xl, GwSpace.md, GwSpace.xl, GwSpace.xxl),
          children: [
            Text(
              tr3(context, "How the mine map works", "မိုင်းမြေပုံ အသုံးပြုနည်း",
                  "วิธีใช้แผนที่เหมือง"),
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: GwSpace.md),
            for (final step in _guideSteps(context))
              Padding(
                padding: const EdgeInsets.only(bottom: GwSpace.md),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(step.$1,
                        size: 20, color: GwColors.accentOf(context)),
                    const SizedBox(width: GwSpace.md),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(step.$2,
                              style: const TextStyle(
                                  fontWeight: FontWeight.w800, fontSize: 14)),
                          const SizedBox(height: 2),
                          Text(
                            step.$3,
                            style: TextStyle(
                              fontSize: 12.5,
                              height: 1.5,
                              color: GwColors.inkSoftOf(context),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            _disclaimer(),
          ],
        ),
      ),
    );
  }

  List<(IconData, String, String)> _guideSteps(BuildContext context) => [
        (
          Icons.filter_alt_outlined,
          tr3(context, "Filter by mineral", "သတ္တုအလိုက် စစ်ထုတ်",
              "กรองตามชนิดแร่"),
          tr3(
            context,
            "Each mineral has its own pin colour, so a region reads at a glance.",
            "သတ္တုတစ်မျိုးစီမှာ အရောင် သီးသန့်ရှိသဖြင့် ဒေသတစ်ခုကို တစ်ချက်ကြည့်ရုံဖြင့် သိနိုင်သည်။",
            "แต่ละแร่มีสีหมุดของตัวเอง ทำให้ดูภาพรวมได้ในพริบตา",
          ),
        ),
        (
          Icons.place_outlined,
          tr3(context, "Tap a pin", "အမှတ်အသား နှိပ်ပါ", "แตะที่หมุด"),
          tr3(
            context,
            "Photos, township, coordinates, operator, access notes and hazards.",
            "ဓာတ်ပုံ၊ မြို့နယ်၊ ကိုသြဒိနိတ်၊ လုပ်ကိုင်သူ၊ လမ်းကြောင်းနှင့် အန္တရာယ် အချက်အလက်များ။",
            "รูป อำเภอ พิกัด ผู้ดำเนินการ เส้นทาง และอันตราย",
          ),
        ),
        (
          Icons.add_location_alt_outlined,
          tr3(context, "Add a site", "နေရာအသစ် ထည့်", "เพิ่มแหล่งใหม่"),
          tr3(
            context,
            "A pin is only accepted complete: mineral, name, state, township, "
                "an exact point and at least one photo.",
            "အချက်အလက် ပြည့်စုံမှသာ လက်ခံသည် — သတ္တု၊ အမည်၊ ပြည်နယ်၊ မြို့နယ်၊ "
                "တည်နေရာ အတိအကျနှင့် ဓာတ်ပုံ ၁ ပုံ အနည်းဆုံး။",
            "ต้องกรอกครบ: ชนิดแร่ ชื่อ รัฐ อำเภอ พิกัด และรูปอย่างน้อย 1 รูป",
          ),
        ),
        (
          Icons.flag_outlined,
          tr3(context, "Fix or report", "ပြင် / တိုင်ကြား", "แก้ไขหรือรายงาน"),
          tr3(
            context,
            "Any user can correct a listing. Report fakes and an admin removes them.",
            "user တိုင်း ပြင်ခွင့်ရှိသည်။ အတုအယောင်များကို တိုင်ကြားပါ — admin ဖျက်ပါလိမ့်မယ်။",
            "ผู้ใช้ทุกคนแก้ไขได้ รายงานรายการปลอม ผู้ดูแลจะลบให้",
          ),
        ),
      ];
}

/// A teardrop pin tinted by mineral — the same shape the web map draws.
class _MinePin extends StatelessWidget {
  const _MinePin({required this.metal});
  final MineMetal metal;

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
            color: metal.color,
            shape: BoxShape.circle,
            border: Border.all(color: Colors.white, width: 2),
            boxShadow: const [
              BoxShadow(color: Color(0x66000000), blurRadius: 4, offset: Offset(0, 2)),
            ],
          ),
          child: Text(metal.emoji, style: const TextStyle(fontSize: 14)),
        ),
        // The stem is what makes the circle point at a place rather than float
        // over one.
        Container(width: 2, height: 8, color: Colors.white),
      ],
    );
  }
}

/// The card that rides along the bottom of the map view.
class _MiniSiteCard extends StatelessWidget {
  const _MiniSiteCard({required this.site, required this.onTap});
  final MineSite site;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final metal = metalOf(site.metal);
    final photo = resolveMedia(site.photos.isEmpty ? null : site.photos.first,
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
                      color: metal.color.withValues(alpha: 0.15),
                      alignment: Alignment.center,
                      child: Text(metal.emoji,
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
                  Text(
                    site.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontWeight: FontWeight.w800, fontSize: 14),
                  ),
                  Text(
                    "${metal.emoji} ${tr3(context, metal.en, metal.my, metal.th)}",
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 12, color: metal.color),
                  ),
                  Text(
                    "${site.township}, ${site.region}",
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                        fontSize: 11.5, color: GwColors.inkSoftOf(context)),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The full-width card used by the list view.
class _SiteCard extends StatelessWidget {
  const _SiteCard({required this.site, required this.onTap});
  final MineSite site;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final metal = metalOf(site.metal);
    final photo = resolveMedia(site.photos.isEmpty ? null : site.photos.first,
        bucket: "media");
    final sColor = statusColor(site.status);
    return GwCard(
      onTap: onTap,
      accent: metal.color,
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
              child: Stack(
                children: [
                  Image.network(
                    photo,
                    height: 150,
                    width: double.infinity,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => Container(
                      height: 150,
                      color: metal.color.withValues(alpha: 0.12),
                      alignment: Alignment.center,
                      child: Text(metal.emoji,
                          style: const TextStyle(fontSize: 36)),
                    ),
                  ),
                  if (site.photos.length > 1)
                    Positioned(
                      right: GwSpace.sm,
                      top: GwSpace.sm,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: 0.55),
                          borderRadius: BorderRadius.circular(GwRadius.sm),
                        ),
                        child: Text(
                          "📷 ${site.photos.length}",
                          style: const TextStyle(
                              color: Colors.white,
                              fontSize: 11,
                              fontWeight: FontWeight.w700),
                        ),
                      ),
                    ),
                ],
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
                      child: Text(
                        site.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            fontWeight: FontWeight.w800, fontSize: 15.5),
                      ),
                    ),
                    if (site.reportCount > 0)
                      GwPill(
                        label: "⚠ ${site.reportCount}",
                        color: const Color(0xFFD97706),
                      ),
                  ],
                ),
                const SizedBox(height: GwSpace.xs),
                Wrap(
                  spacing: GwSpace.sm,
                  runSpacing: GwSpace.xs,
                  children: [
                    GwPill(
                      label:
                          "${metal.emoji} ${tr3(context, metal.en, metal.my, metal.th)}",
                      color: metal.color,
                    ),
                    GwPill(
                      label: _localized(context, kMineStatuses[site.status]),
                      color: sColor,
                    ),
                    GwPill(
                      label: _localized(context, kMineScales[site.scale]),
                      color: GwColors.inkSoftOf(context),
                    ),
                  ],
                ),
                const SizedBox(height: GwSpace.sm),
                Row(
                  children: [
                    Icon(Icons.place_outlined,
                        size: 15, color: GwColors.inkSoftOf(context)),
                    const SizedBox(width: 4),
                    Expanded(
                      child: Text(
                        "${site.township}, ${site.region}",
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                            fontSize: 12.5,
                            color: GwColors.inkSoftOf(context)),
                      ),
                    ),
                  ],
                ),
                if (site.hazard != null && site.hazard!.isNotEmpty) ...[
                  const SizedBox(height: GwSpace.xs),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(Icons.warning_amber_rounded,
                          size: 15, color: Color(0xFFDC2626)),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          site.hazard!,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                              fontSize: 12, color: Color(0xFFDC2626)),
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Pick the active language out of one of the `[en, my, th]` tables.
String _localized(BuildContext context, List<String>? row) {
  if (row == null || row.isEmpty) return "";
  return tr3(context, row[0], row.length > 1 ? row[1] : row[0],
      row.length > 2 ? row[2] : row[0]);
}

/// The detail sheet: everything the contributor filled in, plus the three
/// things a reader wants to do — navigate there, correct it, or flag it.
class _MineDetailSheet extends StatelessWidget {
  const _MineDetailSheet({
    required this.site,
    required this.onEdit,
    required this.onChanged,
  });

  final MineSite site;
  final VoidCallback onEdit;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    final metal = metalOf(site.metal);
    final photos = site.photos
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
                    color: metal.color.withValues(alpha: 0.12),
                    alignment: Alignment.center,
                    child:
                        Text(metal.emoji, style: const TextStyle(fontSize: 44)),
                  ),
                ),
              ),
            ),
          Padding(
            padding: const EdgeInsets.all(GwSpace.lg),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  site.name,
                  style: const TextStyle(
                      fontSize: 20, fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: GwSpace.sm),
                Wrap(
                  spacing: GwSpace.sm,
                  runSpacing: GwSpace.xs,
                  children: [
                    GwPill(
                      label:
                          "${metal.emoji} ${tr3(context, metal.en, metal.my, metal.th)}",
                      color: metal.color,
                      filled: true,
                    ),
                    GwPill(
                      label: _localized(context, kMineStatuses[site.status]),
                      color: statusColor(site.status),
                    ),
                    GwPill(
                      label: _localized(context, kMineScales[site.scale]),
                      color: GwColors.inkSoftOf(context),
                    ),
                    if (site.reportCount > 0)
                      GwPill(
                        label:
                            "⚠ ${site.reportCount} ${tr3(context, "reports", "တိုင်ကြားချက်", "รายงาน")}",
                        color: const Color(0xFFD97706),
                      ),
                  ],
                ),
                const SizedBox(height: GwSpace.lg),
                _row(context, Icons.place_outlined,
                    "${site.township}, ${site.region}"),
                _row(
                  context,
                  Icons.my_location,
                  "${site.latitude.toStringAsFixed(5)}, ${site.longitude.toStringAsFixed(5)}",
                ),
                if (site.operator != null && site.operator!.isNotEmpty)
                  _row(context, Icons.engineering_outlined, site.operator!),
                if (site.tags != null && site.tags!.isNotEmpty)
                  _row(context, Icons.sell_outlined, site.tags!),
                if (site.description != null && site.description!.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: GwSpace.md),
                    child: Text(site.description!,
                        style: const TextStyle(height: 1.5)),
                  ),
                if (site.access != null && site.access!.isNotEmpty)
                  _note(
                    context,
                    Icons.route_outlined,
                    tr3(context, "How to get there", "သွားရောက်ရန် လမ်းကြောင်း",
                        "เส้นทางเข้าถึง"),
                    site.access!,
                    GwColors.accentOf(context),
                  ),
                if (site.hazard != null && site.hazard!.isNotEmpty)
                  _note(
                    context,
                    Icons.warning_amber_rounded,
                    tr3(context, "Hazards (user-reported)",
                        "အန္တရာယ် (user တင်ပြချက်)", "อันตราย (ผู้ใช้รายงาน)"),
                    site.hazard!,
                    const Color(0xFFDC2626),
                  ),
                const SizedBox(height: GwSpace.lg),
                Row(
                  children: [
                    Expanded(
                      child: FilledButton.icon(
                        onPressed: () => _navigate(site),
                        icon: const Icon(Icons.directions, size: 18),
                        label: Text(tr3(context, "Directions", "လမ်းညွှန်",
                            "เส้นทาง")),
                      ),
                    ),
                    const SizedBox(width: GwSpace.sm),
                    OutlinedButton.icon(
                      onPressed: onEdit,
                      icon: const Icon(Icons.edit_outlined, size: 18),
                      label: Text(tr3(context, "Edit", "ပြင်", "แก้ไข")),
                    ),
                  ],
                ),
                const SizedBox(height: GwSpace.sm),
                TextButton.icon(
                  onPressed: () => _report(context),
                  icon: const Icon(Icons.flag_outlined,
                      size: 18, color: Color(0xFFD97706)),
                  label: Text(
                    tr3(context, "Report this pin", "ဤနေရာကို တိုင်ကြားမည်",
                        "รายงานหมุดนี้"),
                    style: const TextStyle(color: Color(0xFFD97706)),
                  ),
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

  Widget _note(BuildContext context, IconData icon, String title, String body,
      Color color) {
    return Container(
      margin: const EdgeInsets.only(top: GwSpace.md),
      padding: const EdgeInsets.all(GwSpace.md),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(GwRadius.md),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 16, color: color),
              const SizedBox(width: 6),
              Text(title,
                  style: TextStyle(
                      fontWeight: FontWeight.w800, fontSize: 12.5, color: color)),
            ],
          ),
          const SizedBox(height: 4),
          Text(body, style: const TextStyle(fontSize: 12.5, height: 1.5)),
        ],
      ),
    );
  }

  Future<void> _navigate(MineSite site) async {
    // geo: hands the point to whatever map app the phone has; the Google Maps
    // web URL is the fallback for phones without one.
    final geo = Uri.parse("geo:${site.latitude},${site.longitude}?q="
        "${site.latitude},${site.longitude}(${Uri.encodeComponent(site.name)})");
    if (await canLaunchUrl(geo)) {
      await launchUrl(geo, mode: LaunchMode.externalApplication);
      return;
    }
    await launchUrl(
      Uri.parse("https://www.google.com/maps/dir/?api=1&destination="
          "${site.latitude},${site.longitude}"),
      mode: LaunchMode.externalApplication,
    );
  }

  Future<void> _report(BuildContext context) async {
    final ctl = TextEditingController();
    final reason = await showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(tr3(dialogContext, "Report this pin", "တိုင်ကြားမည်",
            "รายงานหมุดนี้")),
        content: TextField(
          controller: ctl,
          autofocus: true,
          maxLines: 3,
          decoration: InputDecoration(
            hintText: tr3(
              dialogContext,
              "Wrong location / closed / fake",
              "နေရာမှား / ပိတ်သွားပြီ / အတုအယောင်",
              "พิกัดผิด / ปิดแล้ว / ปลอม",
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
    final label = tr3(context, "Reported — an admin will review it.",
        "တိုင်ကြားပြီးပါပြီ — admin စစ်ဆေးပါလိမ့်မယ်။",
        "รายงานแล้ว — ผู้ดูแลจะตรวจสอบ");
    try {
      await context.read<AppState>().api.mineSiteReport(site.id, reason);
      messenger.showSnackBar(SnackBar(content: Text(label)));
      onChanged();
    } on ApiException catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.message)));
    }
  }
}

/// Add or correct a pin.
///
/// The form refuses to submit until it is complete and says which field is
/// missing, rather than letting the server reject it after the upload — on a
/// field phone connection that difference is a minute of the user's life.
class MineEditorScreen extends StatefulWidget {
  const MineEditorScreen({super.key, this.editing});
  final MineSite? editing;

  @override
  State<MineEditorScreen> createState() => _MineEditorScreenState();
}

class _MineEditorScreenState extends State<MineEditorScreen> {
  final _name = TextEditingController();
  final _region = TextEditingController();
  final _township = TextEditingController();
  final _operator = TextEditingController();
  final _description = TextEditingController();
  final _access = TextEditingController();
  final _hazard = TextEditingController();
  final _tags = TextEditingController();

  String _metal = "tin";
  String _scale = "unknown";
  String _status = "unknown";
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
      _metal = e.metal;
      _scale = e.scale;
      _status = e.status;
      _name.text = e.name;
      _region.text = e.region;
      _township.text = e.township;
      _operator.text = e.operator ?? "";
      _description.text = e.description ?? "";
      _access.text = e.access ?? "";
      _hazard.text = e.hazard ?? "";
      _tags.text = e.tags ?? "";
      _photos.addAll(e.photos);
      _point = e.point;
    }
  }

  @override
  void dispose() {
    _name.dispose();
    _region.dispose();
    _township.dispose();
    _operator.dispose();
    _description.dispose();
    _access.dispose();
    _hazard.dispose();
    _tags.dispose();
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
      final path = await context.read<AppState>().api.uploadBytes(
            bytes,
            ext: "jpg",
            contentType: "image/jpeg",
          );
      if (!mounted) return;
      setState(() => _photos.add(path));
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _useGps() async {
    // Both failure messages are resolved before the first await, so nothing
    // reads the BuildContext once the permission dialogs have been and gone.
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
        _region.text.trim().length < 2 ||
        _township.text.trim().length < 2 ||
        _point == null ||
        _photos.isEmpty) {
      setState(() => _error = tr3(
            context,
            "Required: mineral, name, state/region, township, location and at "
                "least one photo.",
            "ဖြည့်ရန် လိုအပ်သည် — သတ္တု၊ အမည်၊ ပြည်နယ်၊ မြို့နယ်၊ တည်နေရာနှင့် "
                "ဓာတ်ပုံ ၁ ပုံ။",
            "ต้องกรอก: ชนิดแร่ ชื่อ รัฐ อำเภอ พิกัด และรูปอย่างน้อย 1 รูป",
          ));
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    final navigator = Navigator.of(context);
    try {
      await context.read<AppState>().api.mineSiteSave(
        {
          "metal": _metal,
          "name": _name.text.trim(),
          "region": _region.text.trim(),
          "township": _township.text.trim(),
          "latitude": _point!.latitude,
          "longitude": _point!.longitude,
          "photos": _photos,
          "scale": _scale,
          "status": _status,
          if (_operator.text.trim().isNotEmpty) "operator": _operator.text.trim(),
          if (_description.text.trim().isNotEmpty)
            "description": _description.text.trim(),
          if (_access.text.trim().isNotEmpty) "access": _access.text.trim(),
          if (_hazard.text.trim().isNotEmpty) "hazard": _hazard.text.trim(),
          if (_tags.text.trim().isNotEmpty) "tags": _tags.text.trim(),
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
    final editing = widget.editing != null;
    return Scaffold(
      backgroundColor: GwColors.bgOf(context),
      appBar: AppBar(
        title: Text(editing
            ? tr3(context, "Correct this site", "နေရာ ပြင်မည်", "แก้ไขแหล่งนี้")
            : tr3(context, "Add a mine site", "မိုင်းနေရာ ထည့်မည်",
                "เพิ่มแหล่งเหมือง")),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(
            GwSpace.lg, GwSpace.lg, GwSpace.lg, GwSpace.xxl),
        children: [
          _header(tr3(context, "Mineral", "သတ္တုအမျိုးအစား", "ชนิดแร่"),
              icon: Icons.diamond_outlined),
          Wrap(
            spacing: GwSpace.sm,
            runSpacing: GwSpace.sm,
            children: [
              for (final m in kMineMetals)
                GestureDetector(
                  onTap: () => setState(() => _metal = m.key),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 7),
                    decoration: BoxDecoration(
                      color: _metal == m.key
                          ? m.color
                          : m.color.withValues(alpha: 0.10),
                      borderRadius: BorderRadius.circular(GwRadius.xl),
                      border: Border.all(
                          color: m.color.withValues(alpha: 0.45)),
                    ),
                    child: Text(
                      "${m.emoji} ${tr3(context, m.en, m.my, m.th)}",
                      style: TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w700,
                        color: _metal == m.key ? Colors.white : m.color,
                      ),
                    ),
                  ),
                ),
            ],
          ),
          _header(tr3(context, "Where it is", "တည်နေရာ", "ที่ตั้ง"),
              icon: Icons.place_outlined),
          _field(_name, tr3(context, "Mine name *", "မိုင်းအမည် *", "ชื่อเหมือง *")),
          _field(_region,
              tr3(context, "State / Region *", "ပြည်နယ် / တိုင်း *", "รัฐ / ภูมิภาค *")),
          _field(_township, tr3(context, "Township *", "မြို့နယ် *", "อำเภอ *")),
          const SizedBox(height: GwSpace.sm),
          _locationPicker(),
          _header(
            tr3(context, "Photos *", "ဓာတ်ပုံ *", "รูปภาพ *"),
            subtitle: tr3(
              context,
              "At least one, up to eight.",
              "အနည်းဆုံး ၁ ပုံ၊ အများဆုံး ၈ ပုံ။",
              "อย่างน้อย 1 รูป สูงสุด 8 รูป",
            ),
            icon: Icons.photo_camera_outlined,
          ),
          _photoStrip(),
          _header(tr3(context, "Details", "အသေးစိတ်", "รายละเอียด"),
              icon: Icons.notes_outlined),
          _choiceRow(
            tr3(context, "Scale", "လုပ်ငန်းအရွယ်", "ขนาดกิจการ"),
            kMineScales,
            _scale,
            (v) => setState(() => _scale = v),
          ),
          _choiceRow(
            tr3(context, "Status", "အခြေအနေ", "สถานะ"),
            kMineStatuses,
            _status,
            (v) => setState(() => _status = v),
          ),
          _field(_operator,
              tr3(context, "Operator / company", "လုပ်ကိုင်သူ / ကုမ္ပဏီ", "ผู้ดำเนินการ")),
          _field(_tags,
              tr3(context, "Tags (open pit, alluvial…)", "အမှတ်အသား (open pit, alluvial…)", "แท็ก")),
          _field(_description,
              tr3(context, "Description", "အကြောင်းအရာ", "รายละเอียด"),
              lines: 3),
          _field(
            _access,
            tr3(context, "How to get there", "သွားရောက်ရန် လမ်းကြောင်း",
                "เส้นทางเข้าถึง"),
            lines: 2,
          ),
          _field(
            _hazard,
            tr3(context, "Hazard warnings", "အန္တရာယ် သတိပေးချက်",
                "คำเตือนอันตราย"),
            lines: 2,
          ),
          if (_error != null) ...[
            const SizedBox(height: GwSpace.md),
            Text(_error!,
                style: const TextStyle(color: Color(0xFFDC2626), fontSize: 12.5)),
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

  /// A section title without GwSectionHeader's own horizontal padding — this
  /// list already pads its edges, and stacking the two pushed headings 32px in
  /// while the fields sat at 16.
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
                Text(
                  title,
                  style: TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 15.5,
                    color: GwColors.inkOf(context),
                  ),
                ),
                if (subtitle != null)
                  Text(
                    subtitle,
                    style: TextStyle(
                      fontSize: 12,
                      color: GwColors.inkSoftOf(context),
                    ),
                  ),
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

  Widget _choiceRow(
    String label,
    Map<String, List<String>> options,
    String selected,
    ValueChanged<String> onPick,
  ) {
    return Padding(
      padding: const EdgeInsets.only(bottom: GwSpace.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label,
              style: TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w700,
                  color: GwColors.inkSoftOf(context))),
          const SizedBox(height: GwSpace.xs),
          Wrap(
            spacing: GwSpace.sm,
            runSpacing: GwSpace.xs,
            children: [
              for (final entry in options.entries)
                ChoiceChip(
                  label: Text(_localized(context, entry.value)),
                  selected: selected == entry.key,
                  onSelected: (_) => onPick(entry.key),
                ),
            ],
          ),
        ],
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
            border: Border.all(
              color: GwColors.lineOf(context),
              style: BorderStyle.solid,
            ),
          ),
          child: Icon(icon, color: GwColors.inkSoftOf(context)),
        ),
      ),
    );
  }

  /// Tap the map or use GPS. Both write the same point, and the marker is the
  /// confirmation — a pair of numbers alone is easy to get silently wrong.
  Widget _locationPicker() {
    final point = _point;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                tr3(context, "Tap the map to set the exact point *",
                    "မြေပုံပေါ် နှိပ်၍ တည်နေရာ ရွေးပါ *",
                    "แตะแผนที่เพื่อระบุพิกัด *"),
                style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w700,
                    color: GwColors.inkSoftOf(context)),
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
                initialCenter: point ?? const LatLng(21.0, 96.5),
                initialZoom: point == null ? 5.4 : 13,
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
                        child: _MinePin(metal: metalOf(_metal)),
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
              style: TextStyle(
                  fontSize: 11.5, color: GwColors.inkSoftOf(context)),
            ),
          ),
      ],
    );
  }
}
