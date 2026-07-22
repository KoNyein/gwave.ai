import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_state.dart';
import '../../core/i18n.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';
import 'lesson_screen.dart';

const _kindIcons = <String, IconData>{
  "reading": Icons.menu_book_outlined,
  "quiz": Icons.quiz_outlined,
  "code": Icons.code,
  "python": Icons.terminal,
  "sql": Icons.storage_outlined,
  "scratch": Icons.extension_outlined,
  "game": Icons.sports_esports_outlined,
  "video": Icons.play_circle_outline,
};

/// Native track page — the app twin of `/learn/<slug>`: the full lesson list
/// (from /api/mobile/learn/tracks) with the member's ✓ progress, a resume
/// banner, and each lesson opening in the web learn player.
class TrackScreen extends StatefulWidget {
  const TrackScreen({
    super.key,
    required this.slug,
    required this.title,
    required this.emoji,
    required this.color,
  });

  final String slug;
  final String title;
  final String emoji;
  final Color color;

  @override
  State<TrackScreen> createState() => _TrackScreenState();
}

class _TrackScreenState extends State<TrackScreen> {
  List<Map<String, dynamic>> _lessons = [];
  Set<String> _done = {};
  String? _description;
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
      final results = await Future.wait([
        state.api.learnTracks(),
        state.repo.completedLessons(widget.slug),
      ]);
      final tracks = results[0] as List<Map<String, dynamic>>;
      final done = results[1] as Set<String>;
      Map<String, dynamic>? track;
      for (final t in tracks) {
        if (t["slug"] == widget.slug) {
          track = t;
          break;
        }
      }
      if (mounted) {
        setState(() {
          _lessons = track?["lessons"] is List
              ? (track!["lessons"] as List).cast<Map<String, dynamic>>()
              : [];
          _description = track?["description"]?.toString();
          _done = done;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// Open the fully native lesson reader; refresh the ✓ marks on return.
  Future<void> _openLesson(String lessonSlug) async {
    await Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => LessonScreen(
        trackSlug: widget.slug,
        lessonSlug: lessonSlug,
        color: widget.color,
        completed: _done.contains(lessonSlug),
      ),
    ));
    _load();
  }

  /// First not-yet-completed lesson — where "Continue" jumps to.
  Map<String, dynamic>? get _next {
    for (final l in _lessons) {
      if (!_done.contains(l["slug"]?.toString())) return l;
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final doneCount =
        _lessons.where((l) => _done.contains(l["slug"]?.toString())).length;
    final pct =
        _lessons.isEmpty ? 0.0 : (doneCount / _lessons.length).clamp(0.0, 1.0);
    final next = _next;

    return Scaffold(
      appBar: AppBar(title: Text(widget.title)),
      body: RefreshIndicator(
        color: GwColors.primary,
        onRefresh: _load,
        child: _loading && _lessons.isEmpty
            ? const Center(
                child: CircularProgressIndicator(color: GwColors.primary))
            : _error != null && _lessons.isEmpty
                ? ListView(children: [
                    const SizedBox(height: 100),
                    GwEmpty(
                        icon: Icons.cloud_off,
                        title: tr(context, "Couldn't load the course",
                            "သင်တန်း မဖွင့်နိုင်ပါ"),
                        subtitle: _error),
                  ])
                : ListView(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 40),
                    children: [
                      // Course header + progress
                      Container(
                        padding: const EdgeInsets.all(18),
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                            colors: [
                              widget.color,
                              Color.lerp(widget.color, Colors.black, 0.25)!,
                            ],
                          ),
                          borderRadius: BorderRadius.circular(GwRadius.lg),
                          boxShadow: GwShadow.card,
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Text(widget.emoji,
                                    style: const TextStyle(fontSize: 34)),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Text(widget.title,
                                      style: const TextStyle(
                                          color: Colors.white,
                                          fontSize: 20,
                                          fontWeight: FontWeight.w900)),
                                ),
                              ],
                            ),
                            if (_description != null &&
                                _description!.isNotEmpty) ...[
                              const SizedBox(height: 6),
                              Text(_description!,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                      color:
                                          Colors.white.withValues(alpha: 0.85),
                                      fontSize: 13)),
                            ],
                            const SizedBox(height: 14),
                            ClipRRect(
                              borderRadius: BorderRadius.circular(6),
                              child: LinearProgressIndicator(
                                value: pct,
                                minHeight: 8,
                                backgroundColor:
                                    Colors.white.withValues(alpha: 0.25),
                                valueColor: const AlwaysStoppedAnimation(
                                    Colors.white),
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              "$doneCount / ${_lessons.length} ${tr(context, "lessons completed", "သင်ခန်းစာ ပြီးပြီ")}",
                              style: const TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 12.5),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 12),

                      // Continue banner
                      if (next != null)
                        InkWell(
                          borderRadius: BorderRadius.circular(GwRadius.lg),
                          onTap: () =>
                              _openLesson(next["slug"].toString()),
                          child: Container(
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: GwColors.surface,
                              borderRadius:
                                  BorderRadius.circular(GwRadius.lg),
                              border: Border.all(
                                  color: widget.color.withValues(alpha: 0.4)),
                              boxShadow: GwShadow.card,
                            ),
                            child: Row(
                              children: [
                                Container(
                                  width: 40,
                                  height: 40,
                                  decoration: BoxDecoration(
                                    color:
                                        widget.color.withValues(alpha: 0.14),
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: Icon(Icons.play_arrow,
                                      color: widget.color, size: 24),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                          tr(context, "Continue learning",
                                              "ဆက်လက် သင်ယူရန်"),
                                          style: TextStyle(
                                              color: widget.color,
                                              fontWeight: FontWeight.w800,
                                              fontSize: 12.5)),
                                      Text(
                                        next["title"]?.toString() ?? "",
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(
                                            fontWeight: FontWeight.w700,
                                            fontSize: 14.5),
                                      ),
                                    ],
                                  ),
                                ),
                                const Icon(Icons.chevron_right,
                                    color: GwColors.inkSoft),
                              ],
                            ),
                          ),
                        ),
                      const SizedBox(height: 14),
                      Text(tr(context, "Lessons", "သင်ခန်းစာများ"),
                          style: const TextStyle(
                              fontSize: 16, fontWeight: FontWeight.w900)),
                      const SizedBox(height: 8),
                      for (var i = 0; i < _lessons.length; i++)
                        _lessonRow(i, _lessons[i]),
                    ],
                  ),
      ),
    );
  }

  Widget _lessonRow(int index, Map<String, dynamic> l) {
    final slug = l["slug"]?.toString() ?? "";
    final done = _done.contains(slug);
    final kind = l["kind"]?.toString() ?? "reading";
    final minutes = l["minutes"];
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: InkWell(
        borderRadius: BorderRadius.circular(GwRadius.md),
        onTap: () => _openLesson(slug),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: GwColors.surface,
            borderRadius: BorderRadius.circular(GwRadius.md),
            boxShadow: GwShadow.card,
          ),
          child: Row(
            children: [
              Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  color: done
                      ? GwColors.primary
                      : widget.color.withValues(alpha: 0.12),
                  shape: BoxShape.circle,
                ),
                child: done
                    ? const Icon(Icons.check, color: Colors.white, size: 18)
                    : Center(
                        child: Text("${index + 1}",
                            style: TextStyle(
                                color: widget.color,
                                fontWeight: FontWeight.w800,
                                fontSize: 13)),
                      ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      l["title"]?.toString() ?? slug,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 14,
                        color: done ? GwColors.inkSoft : GwColors.ink,
                      ),
                    ),
                    Row(
                      children: [
                        Icon(_kindIcons[kind] ?? Icons.menu_book_outlined,
                            size: 13, color: GwColors.inkSoft),
                        const SizedBox(width: 4),
                        Text(
                          minutes != null ? "$minutes min" : kind,
                          style: const TextStyle(
                              color: GwColors.inkSoft, fontSize: 11.5),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right,
                  color: GwColors.inkSoft, size: 20),
            ],
          ),
        ),
      ),
    );
  }
}
