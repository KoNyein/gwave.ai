import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_state.dart';
import '../../core/models.dart';
import '../../core/repository.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';
import '../create/upload_flow.dart';
import '../live/live_now_rail.dart';
import 'story_viewer.dart';

/// The feed's single compact highlights rail: the "create story" tile, then
/// every CURRENT live broadcast (LIVE badge + autoplay preview), then story
/// groups — one strip instead of two stacked blocks, Facebook-style. Live
/// cards refresh on a timer so new broadcasts appear and ended ones drop off.
class StoriesBar extends StatefulWidget {
  const StoriesBar({super.key});

  @override
  State<StoriesBar> createState() => _StoriesBarState();
}

class _StoriesBarState extends State<StoriesBar> {
  List<Story> _stories = [];
  List<LiveStream> _live = [];
  Timer? _refresh;

  // Per-stream throttle for the media-plane verify below, so a genuinely
  // live broadcast isn't re-checked on every 25s refresh.
  final Map<String, DateTime> _verifiedAt = {};

  @override
  void initState() {
    super.initState();
    _load();
    _refresh = Timer.periodic(const Duration(seconds: 25), (_) => _loadLive());
  }

  @override
  void dispose() {
    _refresh?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    _loadLive();
    try {
      final s = await context.read<AppState>().repo.stories();
      if (mounted) setState(() => _stories = s);
    } catch (_) {
      // Non-fatal — the bar still shows the "your story" create tile.
    }
  }

  Future<void> _loadLive() async {
    try {
      final state = context.read<AppState>();
      var s = await state.repo.liveStreams(onlyLive: true);
      // Self-heal: a broadcast that died without calling the end API stays
      // "live" forever and its card never leaves this rail. Ask the server to
      // check the real media plane (LiveKit room / IVS channel) for
      // stale-looking lives — that also links the saved replay — then
      // re-fetch so dead cards drop off. Throttled per stream.
      final now = DateTime.now();
      final stale = s
          .where((x) =>
              x.isLive &&
              x.createdAt != null &&
              now.difference(x.createdAt!).inMinutes >= 4 &&
              now
                      .difference(
                          _verifiedAt[x.id] ?? DateTime.fromMillisecondsSinceEpoch(0))
                      .inMinutes >=
                  3)
          .toList();
      if (stale.isNotEmpty) {
        for (final x in stale) {
          _verifiedAt[x.id] = now;
        }
        await Future.wait(stale.map(
            (x) => state.api.liveVerify(x.id).then((_) {}).catchError((_) {})));
        s = await state.repo.liveStreams(onlyLive: true);
      }
      if (mounted) setState(() => _live = s.where((e) => e.isLive).toList());
    } catch (_) {
      // Non-fatal — live cards just stay unchanged.
    }
  }

  /// Group stories by author, preserving recency order.
  List<List<Story>> get _byAuthor {
    final map = <String, List<Story>>{};
    final order = <String>[];
    for (final s in _stories) {
      (map[s.authorId] ??= []).add(s);
      if (!order.contains(s.authorId)) order.add(s.authorId);
    }
    return order.map((id) => map[id]!).toList();
  }

  Future<void> _createStory() async {
    final pick = await showModalBottomSheet<String>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.photo, color: GwColors.primary),
              title: const Text("Photo"),
              onTap: () => Navigator.of(ctx).pop("image"),
            ),
            ListTile(
              leading: const Icon(Icons.videocam, color: GwColors.primary),
              title: const Text("Video"),
              onTap: () => Navigator.of(ctx).pop("video"),
            ),
          ],
        ),
      ),
    );
    if (pick == null || !mounted) return;
    final media = pick == "video"
        ? await pickAndUploadVideo(context)
        : await pickAndUploadImage(context);
    if (media == null || !mounted) return;
    final text = await askCaption(context, title: "Story caption");
    if (!mounted) return;
    try {
      await context
          .read<AppState>()
          .repo
          .createStory(media.path, media.mediaType, textOverlay: text);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text("Story posted 📸")),
        );
        _load();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text("Couldn't post story — $e")),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final groups = _byAuthor;
    // Facebook-style stories: tall rounded cards with the story photo as the
    // card face, the author's ringed avatar in the corner, name at the bottom.
    return Container(
      height: 168,
      color: GwColors.surfaceOf(context),
      margin: const EdgeInsets.only(bottom: 6),
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        // One compact strip: create tile → live broadcasts → story groups.
        itemCount: 1 + _live.length + groups.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (_, index) {
          if (index == 0) return _createCard();
          if (index <= _live.length) {
            return LiveRailCard(stream: _live[index - 1], width: 100);
          }
          final i = index - 1 - _live.length;
          final g = groups[i];
          final author = g.first.author?.displayName ?? "Story";
          final face = g.first.mediaType == "image"
              ? resolveMedia(g.first.mediaPath, bucket: "media")
              : null;
          return GestureDetector(
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => StoryViewer(stories: g),
              ),
            ),
            child: _StoryCard(
              face: face,
              fallbackAvatar: resolveMedia(g.first.author?.avatarUrl),
              author: author,
            ),
          );
        },
      ),
    );
  }

  /// Facebook's "Create story" card: my photo fills the top, a white strip
  /// with the floating + button sits at the bottom.
  Widget _createCard() {
    final me = context.read<AppState>().me;
    final avatar = resolveMedia(me?.avatarUrl);
    return GestureDetector(
      onTap: _createStory,
      child: Container(
        width: 100,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(GwRadius.md),
          border: Border.all(color: GwColors.lineOf(context)),
        ),
        child: Stack(
          clipBehavior: Clip.none,
          alignment: Alignment.center,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(GwRadius.md),
              child: Column(
                children: [
                  Expanded(
                    child: SizedBox(
                      width: double.infinity,
                      child: avatar != null
                          ? Image.network(avatar, fit: BoxFit.cover)
                          : Container(
                              color: GwColors.surfaceMutedOf(context),
                              child: const Icon(Icons.person,
                                  size: 44, color: GwColors.inkSoft),
                            ),
                    ),
                  ),
                  Container(
                    width: double.infinity,
                    color: GwColors.surfaceOf(context),
                    padding: const EdgeInsets.only(top: 20, bottom: 8),
                    child: const Text(
                      "Story ဖန်တီးရန်",
                      textAlign: TextAlign.center,
                      style:
                          TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700),
                    ),
                  ),
                ],
              ),
            ),
            // Floating + button straddling the photo and the label strip.
            Positioned(
              bottom: 26,
              child: Container(
                decoration: BoxDecoration(
                  color: GwColors.primary,
                  shape: BoxShape.circle,
                  border: Border.all(color: GwColors.surface, width: 3),
                ),
                padding: const EdgeInsets.all(5),
                child: const Icon(Icons.add, color: Colors.white, size: 18),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// One Facebook-style story card: photo face, ringed avatar top-left,
/// author name over the bottom gradient.
class _StoryCard extends StatelessWidget {
  const _StoryCard({
    required this.face,
    required this.fallbackAvatar,
    required this.author,
  });
  final String? face;
  final String? fallbackAvatar;
  final String author;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 100,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(GwRadius.md),
        border: Border.all(color: GwColors.line),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(GwRadius.md),
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (face != null)
              Image.network(face!, fit: BoxFit.cover)
            else if (fallbackAvatar != null)
              Image.network(fallbackAvatar!, fit: BoxFit.cover)
            else
              Container(
                decoration:
                    const BoxDecoration(gradient: GwColors.primaryGradient),
              ),
            // Legibility gradient for the name.
            const DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [Colors.transparent, Colors.black54],
                  stops: [0.6, 1],
                ),
              ),
            ),
            Positioned(
              top: 8,
              left: 8,
              child: Container(
                padding: const EdgeInsets.all(2),
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  color: GwColors.primary,
                ),
                child: GwAvatar(url: fallbackAvatar, name: author, size: 32),
              ),
            ),
            Positioned(
              left: 8,
              right: 8,
              bottom: 8,
              child: Text(
                author,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 11.5,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
