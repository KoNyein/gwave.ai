import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_state.dart';
import '../../core/i18n.dart';
import '../../core/models.dart';
import '../../core/repository.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';
import '../books/books_screen.dart';
import '../cctv/cctv_screen.dart';
import '../dating/dating_screen.dart';
import '../farm/farm_screen.dart';
import '../games/games_screen.dart';
import '../gpay/gpay_screen.dart';
import '../health/health_hub_screen.dart';
import '../jobs/jobs_screen.dart';
import '../learn/learn_screen.dart';
import '../market/market_screen.dart';
import '../metaverse/metaverse_screen.dart';
import '../ride/ride_screen.dart';
import '../settings/settings_screen.dart';
import '../tools/tools_screen.dart';
import '../web/web_screen.dart';
import '../wellness/wellness_hub_screen.dart';

/// System-wide search, Facebook-style: one box that finds **features**
/// (every Gwave module, matched in English or Burmese), **people** and
/// **posts**. People/posts query PostgREST directly with the same fields
/// the web navbar search uses; features are a local registry so they match
/// instantly and offline.
class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key});

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _FeatureHit {
  const _FeatureHit(this.emoji, this.en, this.my, this.keywords, this.open);
  final String emoji;
  final String en;
  final String my;
  final String keywords; // extra match words, both languages
  final void Function(BuildContext) open;
}

class _SearchScreenState extends State<SearchScreen> {
  final _controller = TextEditingController();
  Timer? _debounce;
  String _query = "";
  bool _busy = false;
  List<Profile> _people = [];
  List<Post> _posts = [];

  static void _pushScreen(BuildContext context, Widget screen) {
    Navigator.of(context)
        .push(MaterialPageRoute(builder: (_) => screen));
  }

  /// Every reachable module. Keep names + keywords bilingual so either
  /// language finds them.
  static final List<_FeatureHit> _features = [
    _FeatureHit("🎮", "Games", "ဂိမ်းများ", "game play",
        (c) => _pushScreen(c, const GamesScreen())),
    _FeatureHit("🌐", "Metaverse", "3D လောက", "metaverse world avatar",
        (c) => openMetaverse(c)),
    _FeatureHit("🎬", "GWAVE STUDIO", "ဂိမ်းတည်ဆောက်ရန်",
        "studio world maker creator engine",
        (c) => openWeb(c, "/engine/studio.html")),
    _FeatureHit("🚁", "GWAVE DRONE", "ဒရုန်းဂိမ်း", "drone fpv",
        (c) => openWeb(c, "/drone/index.html")),
    _FeatureHit("🔫", "GWAVE STRIKE", "ပစ်ခတ်ဂိမ်း", "strike fps shooter",
        (c) => openWeb(c, "/strike/")),
    _FeatureHit("🧬", "3D Avatar", "မျက်နှာ scan", "avatar scan face",
        (c) => openWeb(c, "/profile/avatar")),
    _FeatureHit("📹", "CCTV", "ကင်မရာ", "camera security bridge",
        (c) => _pushScreen(c, const CctvScreen())),
    _FeatureHit("🏠", "Gwave Home / IoT", "အိမ်သုံးစက်များ", "iot smart home esp32",
        (c) => openWeb(c, "/iot")),
    _FeatureHit("💸", "GPay", "ငွေလွှဲ", "pay wallet money transfer",
        (c) => _pushScreen(c, const GpayScreen())),
    _FeatureHit("🌾", "Farm", "စိုက်ပျိုးရေး", "farm garden grow",
        (c) => _pushScreen(c, const FarmScreen())),
    _FeatureHit("🛒", "Market", "ဈေး", "market buy sell shop",
        (c) => _pushScreen(c, const MarketScreen())),
    _FeatureHit("💼", "Jobs", "အလုပ်များ", "job work hire",
        (c) => _pushScreen(c, const JobsScreen())),
    _FeatureHit("📚", "Learn", "သင်ခန်းစာများ", "learn study stem",
        (c) => _pushScreen(c, const LearnScreen())),
    _FeatureHit("📖", "Books", "စာအုပ်များ", "book read",
        (c) => _pushScreen(c, const BooksScreen())),
    _FeatureHit("🏥", "Health", "ကျန်းမာရေး", "health doctor",
        (c) => _pushScreen(c, const HealthHubScreen())),
    _FeatureHit("🧘", "Wellness", "စိတ်ကျန်းမာရေး", "wellness breath meditate",
        (c) => _pushScreen(c, const WellnessHubScreen())),
    _FeatureHit("💚", "Dating", "အချစ်ရှာ", "dating match",
        (c) => _pushScreen(c, const DatingScreen())),
    _FeatureHit("🚗", "Ride", "ကားခေါ်", "ride taxi car",
        (c) => _pushScreen(c, const RideScreen())),
    _FeatureHit("🧰", "Tools", "ကိရိယာများ", "tool utility",
        (c) => _pushScreen(c, const ToolsScreen())),
    _FeatureHit("⚙️", "Settings", "ဆက်တင်", "setting language theme",
        (c) => _pushScreen(c, const SettingsScreen())),
  ];

  List<_FeatureHit> get _featureHits {
    final q = _query.trim().toLowerCase();
    if (q.length < 2) return [];
    return _features
        .where((f) =>
            f.en.toLowerCase().contains(q) ||
            f.my.contains(q) ||
            f.keywords.contains(q))
        .take(6)
        .toList();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _onChanged(String v) {
    setState(() => _query = v);
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), _run);
  }

  Future<void> _run() async {
    final q = _query.trim();
    if (q.length < 2) {
      setState(() {
        _people = [];
        _posts = [];
      });
      return;
    }
    setState(() => _busy = true);
    final repo = context.read<AppState>().repo;
    try {
      final results = await Future.wait([
        repo.searchProfiles(q),
        repo.searchPosts(q),
      ]);
      if (!mounted || _query.trim() != q) return;
      setState(() {
        _people = results[0] as List<Profile>;
        _posts = results[1] as List<Post>;
      });
    } catch (_) {
      // Feature hits still render; network results just stay empty.
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final features = _featureHits;
    final hasQuery = _query.trim().length >= 2;
    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: Container(
          margin: const EdgeInsets.only(right: 14),
          padding: const EdgeInsets.symmetric(horizontal: 14),
          decoration: BoxDecoration(
            color: GwColors.surfaceMutedOf(context),
            borderRadius: BorderRadius.circular(22),
          ),
          child: Row(
            children: [
              Icon(Icons.search, size: 20, color: GwColors.inkSoftOf(context)),
              const SizedBox(width: 8),
              Expanded(
                child: TextField(
                  controller: _controller,
                  autofocus: true,
                  onChanged: _onChanged,
                  decoration: InputDecoration(
                    hintText: tr(context, "Search Gwave", "Gwave ထဲ ရှာရန်"),
                    hintStyle: TextStyle(color: GwColors.inkSoftOf(context)),
                    border: InputBorder.none,
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                ),
              ),
              if (_query.isNotEmpty)
                GestureDetector(
                  onTap: () {
                    _controller.clear();
                    _onChanged("");
                  },
                  child: Icon(Icons.close,
                      size: 18, color: GwColors.inkSoftOf(context)),
                ),
            ],
          ),
        ),
      ),
      body: !hasQuery
          ? ListView(
              padding: const EdgeInsets.fromLTRB(16, 20, 16, 30),
              children: [
                Text(tr(context, "Search everything", "အားလုံးကို ရှာနိုင်ပါတယ်"),
                    style: const TextStyle(
                        fontSize: 17, fontWeight: FontWeight.w900)),
                const SizedBox(height: 6),
                Text(
                  tr(
                      context,
                      "People, posts and every Gwave feature — games, pay, farm, CCTV…",
                      "လူများ · ပို့စ်များ · Gwave feature အားလုံး — ဂိမ်း၊ ငွေလွှဲ၊ စိုက်ပျိုးရေး၊ ကင်မရာ…"),
                  style: TextStyle(
                      color: GwColors.inkSoftOf(context), fontSize: 13),
                ),
              ],
            )
          : ListView(
              padding: const EdgeInsets.only(bottom: 40),
              children: [
                if (_busy) const LinearProgressIndicator(minHeight: 2),
                if (features.isNotEmpty) ...[
                  _header(context, tr(context, "Features", "Feature များ")),
                  ...features.map(_featureTile),
                ],
                if (_people.isNotEmpty) ...[
                  _header(context, tr(context, "People", "လူများ")),
                  ..._people.map(_personTile),
                ],
                if (_posts.isNotEmpty) ...[
                  _header(context, tr(context, "Posts", "ပို့စ်များ")),
                  ..._posts.map(_postTile),
                ],
                if (!_busy &&
                    features.isEmpty &&
                    _people.isEmpty &&
                    _posts.isEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 90),
                    child: GwEmpty(
                        icon: Icons.search_off,
                        title: tr(context, "No results", "ရှာမတွေ့ပါ"),
                        subtitle: tr(context, "Try a different keyword",
                            "စကားလုံး ပြောင်းရှာကြည့်ပါ")),
                  ),
              ],
            ),
    );
  }

  Widget _header(BuildContext context, String label) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 6),
      child: Text(label,
          style: const TextStyle(
              fontSize: 17, fontWeight: FontWeight.w900, letterSpacing: -0.3)),
    );
  }

  Widget _featureTile(_FeatureHit f) {
    return ListTile(
      leading: Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          color: GwColors.primary.withValues(alpha: 0.1),
          shape: BoxShape.circle,
        ),
        alignment: Alignment.center,
        child: Text(f.emoji, style: const TextStyle(fontSize: 20)),
      ),
      title: Text(f.en,
          style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
      subtitle: Text(f.my,
          style: TextStyle(color: GwColors.inkSoftOf(context), fontSize: 12.5)),
      trailing: Icon(Icons.chevron_right, color: GwColors.inkSoftOf(context)),
      onTap: () => f.open(context),
    );
  }

  Widget _personTile(Profile p) {
    return ListTile(
      leading: GwAvatar(
          url: resolveMedia(p.avatarUrl), name: p.displayName, size: 44),
      title: Text(p.displayName,
          style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
      subtitle: p.username == null
          ? null
          : Text("@${p.username}",
              style:
                  TextStyle(color: GwColors.inkSoftOf(context), fontSize: 12.5)),
      onTap: () {
        final u = p.username;
        if (u != null && u.isNotEmpty) openWeb(context, "/u/$u");
      },
    );
  }

  Widget _postTile(Post p) {
    final text = p.content.trim();
    return ListTile(
      leading: GwAvatar(
          url: resolveMedia(p.author?.avatarUrl),
          name: p.author?.displayName ?? "Gwave user",
          size: 44),
      title: Text(
        text.isEmpty ? tr(context, "(photo post)", "(ဓာတ်ပုံပို့စ်)") : text,
        maxLines: 2,
        overflow: TextOverflow.ellipsis,
        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
      ),
      subtitle: Text(
        "${p.author?.displayName ?? "Gwave user"} · ${timeAgo(p.createdAt)}",
        style: TextStyle(color: GwColors.inkSoftOf(context), fontSize: 12),
      ),
      onTap: () => openWeb(context, "/p/${p.id}"),
    );
  }
}
