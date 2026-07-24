import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/app_state.dart';
import '../../core/config.dart';
import '../../core/i18n.dart';
import '../../core/theme.dart';
import '../web/web_screen.dart';
import 'languages_screen.dart';
import 'live_classes_screen.dart';
import 'track_screen.dart';

/// Presentation metadata for a known track slug (emoji, accent color and the
/// category section it lives under). Slugs mirror src/lib/learn's TRACKS; a
/// slug the app doesn't know yet still renders from the catalog with default
/// styling, so adding a course on the web never hides it here.
class _Meta {
  const _Meta(this.emoji, this.color, this.category);
  final String emoji;
  final Color color;
  final String category;
}

const _coding = "coding";
const _tech = "tech";
const _science = "science";
const _kids = "kids";
const _other = "other";

const _meta = <String, _Meta>{
  "python": _Meta("🐍", Color(0xFF2E7DB1), _coding),
  "javascript": _Meta("🟨", Color(0xFFCB6D1E), _coding),
  "html": _Meta("🌐", Color(0xFFE2574C), _coding),
  "css": _Meta("🎨", Color(0xFF7A4DD6), _coding),
  "sql": _Meta("🗄️", Color(0xFF139C9C), _coding),
  "advanced-js": _Meta("🚀", Color(0xFFB1382E), _coding),
  "game-dev": _Meta("🕹️", Color(0xFF5A31C2), _coding),
  "advanced-canvas": _Meta("🎞️", Color(0xFF206A8C), _coding),
  "ai": _Meta("🤖", Color(0xFF3B6D11), _tech),
  "electronics-iot": _Meta("⚡", Color(0xFFB98A12), _tech),
  "robotics": _Meta("🦾", Color(0xFF5B6650), _tech),
  "stem": _Meta("🔬", Color(0xFF2E7DB1), _science),
  "agri": _Meta("🌱", Color(0xFF2E9E5B), _science),
  "scratch": _Meta("🧩", Color(0xFFCB6D1E), _kids),
  "pseudocode": _Meta("📝", Color(0xFF5B6650), _kids),
};

/// Section order + bilingual headers.
const _categories = <(String, String, String)>[
  (_coding, "💻 Coding", "💻 Coding"),
  (_tech, "🤖 AI · Electronics · Robotics", "🤖 AI · အီလက်ထရွန်းနစ် · စက်ရုပ်"),
  (_science, "🔬 Science & Farming", "🔬 သိပ္ပံနှင့် စိုက်ပျိုးရေး"),
  (_kids, "🧒 For kids", "🧒 ကလေးများအတွက်"),
  (_other, "📚 More courses", "📚 အခြား သင်တန်းများ"),
];

class _TrackInfo {
  _TrackInfo({
    required this.slug,
    required this.title,
    required this.description,
    required this.total,
    required this.meta,
  });
  final String slug;
  final String title;
  final String description;
  final int total;
  final _Meta meta;
}

/// Native Learn hub — the live course catalog (real lesson counts from
/// /api/mobile/learn/tracks) grouped by category, with the member's actual
/// progress, a Continue-learning card, and a Code Playground shortcut.
/// Lesson content itself opens in the web player from the track screen.
class LearnScreen extends StatefulWidget {
  const LearnScreen({super.key});

  @override
  State<LearnScreen> createState() => _LearnScreenState();
}

class _LearnScreenState extends State<LearnScreen> {
  List<_TrackInfo> _tracks = [];
  Map<String, int> _completed = {};
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final state = context.read<AppState>();
      final results = await Future.wait<Object>([
        state.api.learnTracks(),
        state.repo.learnCompletedByTrack(),
      ]);
      final catalog = results[0] as List<Map<String, dynamic>>;
      final completed = results[1] as Map<String, int>;
      final tracks = <_TrackInfo>[];
      for (final t in catalog) {
        final slug = t["slug"]?.toString() ?? "";
        if (slug.isEmpty) continue;
        final lessons = t["lessons"];
        tracks.add(_TrackInfo(
          slug: slug,
          title: (t["title"] ?? slug).toString(),
          description: (t["description"] ?? "").toString(),
          total: lessons is List ? lessons.length : 0,
          meta: _meta[slug] ??
              const _Meta("📘", GwColors.primary, _other),
        ));
      }
      if (mounted) {
        setState(() {
          _tracks = tracks;
          _completed = completed;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// Web features open in the signed-in in-app browser — never the external
  /// browser, where no session exists.
  Future<void> _openWeb(String path) => openWeb(context, path);

  void _openTrack(_TrackInfo t) {
    Navigator.of(context)
        .push(
          MaterialPageRoute(
            builder: (_) => TrackScreen(
              slug: t.slug,
              title: t.title,
              emoji: t.meta.emoji,
              color: t.meta.color,
            ),
          ),
        )
        .then((_) => _load());
  }

  int _done(String slug) => _completed[slug] ?? 0;

  /// The most advanced in-progress track (started but unfinished) — powers
  /// the Continue-learning card.
  _TrackInfo? get _continueTrack {
    _TrackInfo? best;
    var bestDone = 0;
    for (final t in _tracks) {
      final d = _done(t.slug);
      if (d > 0 && (t.total == 0 || d < t.total) && d >= bestDone) {
        best = t;
        bestDone = d;
      }
    }
    return best;
  }

  @override
  Widget build(BuildContext context) {
    final totalDone = _completed.values.fold<int>(0, (a, b) => a + b);
    final started = _tracks.where((t) => _done(t.slug) > 0).length;
    final finished =
        _tracks.where((t) => t.total > 0 && _done(t.slug) >= t.total).length;
    final cont = _continueTrack;

    return Scaffold(
      appBar: AppBar(
        title: const Text("Learn"),
        actions: [
          TextButton.icon(
            onPressed: () => _openWeb("/leaderboard"),
            icon: const Icon(Icons.emoji_events_outlined, size: 18),
            label: Text(tr(context, "Leaderboard", "အဆင့်ဇယား")),
          ),
        ],
      ),
      body: RefreshIndicator(
        color: GwColors.primary,
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 40),
          children: [
            // Hero: totals + stat chips
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                gradient: GwColors.primaryGradient,
                borderRadius: BorderRadius.circular(GwRadius.lg),
                boxShadow: GwShadow.card,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Text("🎓", style: TextStyle(fontSize: 34)),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              _loading && _tracks.isEmpty
                                  ? tr(context, "Loading…", "ဖွင့်နေသည်…")
                                  : "$totalDone ${tr(context, "lessons completed", "သင်ခန်းစာ ပြီးမြောက်ပြီး")}",
                              style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 16,
                                  fontWeight: FontWeight.w900),
                            ),
                            const SizedBox(height: 2),
                            Text(
                                tr(context, "Free courses for growers",
                                    "အခမဲ့ သင်တန်းများ"),
                                style: const TextStyle(
                                    color: Colors.white70, fontSize: 13)),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      _statChip(
                          "📖 $started ${tr(context, "started", "စတင်ထား")}"),
                      const SizedBox(width: 8),
                      _statChip(
                          "🏁 $finished ${tr(context, "finished", "ပြီးဆုံး")}"),
                      const SizedBox(width: 8),
                      _statChip("📚 ${_tracks.length} ${tr(context, "courses", "ခု")}"),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),

            // Continue learning
            if (cont != null) ...[
              InkWell(
                borderRadius: BorderRadius.circular(GwRadius.lg),
                onTap: () => _openTrack(cont),
                child: Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: GwColors.surfaceOf(context),
                    borderRadius: BorderRadius.circular(GwRadius.lg),
                    border: Border.all(
                        color: cont.meta.color.withValues(alpha: 0.45),
                        width: 1.4),
                    boxShadow: GwShadow.card,
                  ),
                  child: Row(
                    children: [
                      _emojiTile(cont.meta, 46),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                                tr(context, "Continue learning",
                                    "ဆက်လက် သင်ယူရန်"),
                                style: TextStyle(
                                    color: cont.meta.color,
                                    fontWeight: FontWeight.w800,
                                    fontSize: 12)),
                            Text(cont.title,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                    fontWeight: FontWeight.w800,
                                    fontSize: 15)),
                            const SizedBox(height: 6),
                            _progressBar(cont, height: 5),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        width: 38,
                        height: 38,
                        decoration: BoxDecoration(
                          color: cont.meta.color,
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.play_arrow,
                            color: Colors.white, size: 22),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),
            ],

            // Languages + teacher-led live classes — fully native.
            Row(
              children: [
                Expanded(
                  child: _featureCard(
                    "🌏",
                    tr(context, "Languages", "ဘာသာစကား"),
                    tr(context, "English · ไทย · 中文 · 日本語 · 한국어",
                        "အင်္ဂလိပ် · ထိုင်း · တရုတ် · ဂျပန် · ကိုရီးယား"),
                    () => Navigator.of(context).push(MaterialPageRoute(
                        builder: (_) => const LanguagesScreen())),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _featureCard(
                    "🎓",
                    tr(context, "Live Classes", "Live အတန်းများ"),
                    tr(context, "Learn with a teacher", "ဆရာနှင့် သင်ယူမယ်"),
                    () => Navigator.of(context).push(MaterialPageRoute(
                        builder: (_) => const LiveClassesScreen())),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Playground shortcut
            InkWell(
              borderRadius: BorderRadius.circular(GwRadius.lg),
              onTap: () => _openWeb("/learn/playground"),
              child: Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: GwColors.surfaceOf(context),
                  borderRadius: BorderRadius.circular(GwRadius.lg),
                  boxShadow: GwShadow.card,
                ),
                child: Row(
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: GwColors.inkOf(context),
                        borderRadius: BorderRadius.circular(13),
                      ),
                      child: const Icon(Icons.code,
                          color: GwColors.primaryBright, size: 24),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text("Code Playground",
                              style: TextStyle(
                                  fontWeight: FontWeight.w800, fontSize: 15)),
                          Text(
                              tr(
                                  context,
                                  "Write and run HTML / JS / Python live",
                                  "HTML / JS / Python ကို တိုက်ရိုက် ရေးစမ်း"),
                              style: TextStyle(
                                  color: GwColors.inkSoftOf(context), fontSize: 12.5)),
                        ],
                      ),
                    ),
                    Icon(Icons.open_in_new,
                        color: GwColors.inkSoftOf(context), size: 18),
                  ],
                ),
              ),
            ),

            if (_loading && _tracks.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 60),
                child: Center(
                    child: CircularProgressIndicator(color: GwColors.primary)),
              )
            else if (_error != null && _tracks.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 40),
                child: Column(
                  children: [
                    Icon(Icons.cloud_off,
                        size: 48, color: GwColors.inkSoftOf(context)),
                    const SizedBox(height: 10),
                    Text(
                        tr(context, "Couldn't load the courses",
                            "သင်တန်းများ မဖွင့်နိုင်ပါ"),
                        style:
                            const TextStyle(fontWeight: FontWeight.w700)),
                    const SizedBox(height: 4),
                    Text(_error!,
                        textAlign: TextAlign.center,
                        style: TextStyle(
                            color: GwColors.inkSoftOf(context), fontSize: 12)),
                  ],
                ),
              )
            else
              for (final cat in _categories) ...[
                if (_tracks.any((t) => t.meta.category == cat.$1)) ...[
                  Padding(
                    padding: const EdgeInsets.fromLTRB(2, 20, 2, 10),
                    child: Text(tr(context, cat.$2, cat.$3),
                        style: const TextStyle(
                            fontSize: 15.5, fontWeight: FontWeight.w900)),
                  ),
                  for (final t in _tracks
                      .where((t) => t.meta.category == cat.$1))
                    _trackCard(t),
                ],
              ],
          ],
        ),
      ),
    );
  }

  /// Square feature entry (Languages / Live Classes) shown under the hero.
  Widget _featureCard(
      String emoji, String title, String subtitle, VoidCallback onTap) {
    return InkWell(
      borderRadius: BorderRadius.circular(GwRadius.lg),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(13),
        decoration: BoxDecoration(
          color: GwColors.surfaceOf(context),
          borderRadius: BorderRadius.circular(GwRadius.lg),
          boxShadow: GwShadow.card,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(emoji, style: const TextStyle(fontSize: 26)),
            const SizedBox(height: 6),
            Text(title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                    fontWeight: FontWeight.w800, fontSize: 14.5)),
            const SizedBox(height: 2),
            Text(subtitle,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                    color: GwColors.inkSoftOf(context), fontSize: 11, height: 1.3)),
          ],
        ),
      ),
    );
  }

  Widget _statChip(String text) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.18),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Text(text,
            style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w700,
                fontSize: 11.5)),
      );

  Widget _emojiTile(_Meta m, double size) => Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              m.color.withValues(alpha: 0.2),
              m.color.withValues(alpha: 0.08),
            ],
          ),
          borderRadius: BorderRadius.circular(size * 0.3),
          border: Border.all(color: m.color.withValues(alpha: 0.15)),
        ),
        child: Center(
            child: Text(m.emoji, style: TextStyle(fontSize: size * 0.5))),
      );

  Widget _progressBar(_TrackInfo t, {double height = 6}) {
    final done = _done(t.slug);
    final pct = t.total == 0 ? 0.0 : (done / t.total).clamp(0.0, 1.0);
    return ClipRRect(
      borderRadius: BorderRadius.circular(height),
      child: LinearProgressIndicator(
        value: pct,
        minHeight: height,
        backgroundColor: GwColors.surfaceMutedOf(context),
        valueColor: AlwaysStoppedAnimation(t.meta.color),
      ),
    );
  }

  Widget _trackCard(_TrackInfo t) {
    final done = _done(t.slug);
    final finished = t.total > 0 && done >= t.total;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: InkWell(
        borderRadius: BorderRadius.circular(GwRadius.lg),
        onTap: () => _openTrack(t),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: GwColors.surfaceOf(context),
            borderRadius: BorderRadius.circular(GwRadius.lg),
            boxShadow: GwShadow.card,
          ),
          child: Row(
            children: [
              _emojiTile(t.meta, 48),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(t.title,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                  fontWeight: FontWeight.w800,
                                  fontSize: 15)),
                        ),
                        if (finished)
                          const Icon(Icons.check_circle,
                              color: GwColors.primary, size: 17)
                        else if (done > 0)
                          Text("$done/${t.total}",
                              style: TextStyle(
                                  color: t.meta.color,
                                  fontWeight: FontWeight.w800,
                                  fontSize: 12)),
                      ],
                    ),
                    Text(
                      t.description.isNotEmpty
                          ? t.description
                          : "${t.total} ${tr(context, "lessons", "သင်ခန်းစာ")}",
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                          color: GwColors.inkSoftOf(context), fontSize: 12.5),
                    ),
                    const SizedBox(height: 7),
                    Row(
                      children: [
                        Expanded(child: _progressBar(t)),
                        const SizedBox(width: 8),
                        Text(
                          "${t.total} ${tr(context, "lessons", "ခန်း")}",
                          style: TextStyle(
                              color: GwColors.inkSoftOf(context), fontSize: 10.5),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Icon(Icons.chevron_right, color: GwColors.inkSoftOf(context)),
            ],
          ),
        ),
      ),
    );
  }
}
