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
    return Container(
      height: 104,
      margin: const EdgeInsets.only(bottom: 6),
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        // Index 0 is always the "your story" create tile; groups follow.
        itemCount: 1 + groups.length,
        separatorBuilder: (_, __) => const SizedBox(width: 12),
        itemBuilder: (_, index) {
          if (index == 0) return _createTile();
          final i = index - 1;
          final g = groups[i];
          final author = g.first.author?.displayName ?? "Story";
          return GestureDetector(
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => StoryViewer(stories: g),
              ),
            ),
            child: SizedBox(
              width: 66,
              child: Column(
                children: [
                  Container(
                    padding: const EdgeInsets.all(2.5),
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: GwColors.liveGradient,
                    ),
                    child: Container(
                      padding: const EdgeInsets.all(2),
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        color: GwColors.bg,
                      ),
                      child: GwAvatar(
                        url: resolveMedia(g.first.author?.avatarUrl),
                        name: author,
                        size: 56,
                      ),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    author,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 11),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _createTile() {
    final me = context.read<AppState>().me;
    return GestureDetector(
      onTap: _createStory,
      child: SizedBox(
        width: 66,
        child: Column(
          children: [
            Stack(
              children: [
                GwAvatar(
                  url: resolveMedia(me?.avatarUrl),
                  name: me?.displayName ?? "Me",
                  size: 62,
                ),
                Positioned(
                  right: 0,
                  bottom: 0,
                  child: Container(
                    decoration: BoxDecoration(
                      color: GwColors.primary,
                      shape: BoxShape.circle,
                      border: Border.all(color: GwColors.bg, width: 2),
                    ),
                    padding: const EdgeInsets.all(2),
                    child: const Icon(Icons.add, color: Colors.white, size: 15),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),
            const Text(
              "Your Story",
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 11),
            ),
          ],
        ),
      ),
    );
  }
}
