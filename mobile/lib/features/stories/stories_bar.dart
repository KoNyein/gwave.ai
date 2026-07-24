import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_state.dart';
import '../../core/models.dart';
import '../../core/repository.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';
import '../create/upload_flow.dart';
import 'story_viewer.dart';

/// Horizontal stories rail at the top of the feed. Grouped by author; tapping an
/// author opens their stories in the full-screen viewer.
class StoriesBar extends StatefulWidget {
  const StoriesBar({super.key});

  @override
  State<StoriesBar> createState() => _StoriesBarState();
}

class _StoriesBarState extends State<StoriesBar> {
  List<Story> _stories = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final s = await context.read<AppState>().repo.stories();
      if (mounted) setState(() => _stories = s);
    } catch (_) {
      // Non-fatal — the bar still shows the "your story" create tile.
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
      height: 176,
      color: GwColors.surface,
      margin: const EdgeInsets.only(bottom: 6),
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        // Index 0 is always the "create story" card; groups follow.
        itemCount: 1 + groups.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (_, index) {
          if (index == 0) return _createCard();
          final i = index - 1;
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
          border: Border.all(color: GwColors.line),
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
                              color: GwColors.surfaceMuted,
                              child: const Icon(Icons.person,
                                  size: 44, color: GwColors.inkSoft),
                            ),
                    ),
                  ),
                  Container(
                    width: double.infinity,
                    color: GwColors.surface,
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
