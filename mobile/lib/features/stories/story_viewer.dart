import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../core/models.dart';
import '../../core/repository.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';

/// Full-screen story viewer. Tap right = next, tap left = previous. A timed
/// progress bar advances through the list. Image stories only auto-advance;
/// video stories would need a player (a follow-up).
class StoryViewer extends StatefulWidget {
  const StoryViewer({super.key, required this.stories, this.startIndex = 0});
  final List<Story> stories;
  final int startIndex;

  @override
  State<StoryViewer> createState() => _StoryViewerState();
}

class _StoryViewerState extends State<StoryViewer>
    with SingleTickerProviderStateMixin {
  late int _index = widget.startIndex;
  late final AnimationController _progress = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 5),
  )..addStatusListener((s) {
      if (s == AnimationStatus.completed) _next();
    });

  @override
  void initState() {
    super.initState();
    _progress.forward();
  }

  @override
  void dispose() {
    _progress.dispose();
    super.dispose();
  }

  void _next() {
    if (_index < widget.stories.length - 1) {
      setState(() => _index++);
      _progress
        ..reset()
        ..forward();
    } else {
      Navigator.of(context).pop();
    }
  }

  void _prev() {
    if (_index > 0) {
      setState(() => _index--);
      _progress
        ..reset()
        ..forward();
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.stories[_index];
    final name = s.author?.displayName ?? "Story";
    final media = resolveMedia(s.mediaPath, bucket: "media");
    return Scaffold(
      backgroundColor: Colors.black,
      body: GestureDetector(
        onTapUp: (d) {
          final w = MediaQuery.of(context).size.width;
          if (d.globalPosition.dx < w / 3) {
            _prev();
          } else {
            _next();
          }
        },
        // Standard story gesture: drag down to dismiss.
        onVerticalDragEnd: (d) {
          if ((d.primaryVelocity ?? 0) > 300) Navigator.of(context).maybePop();
        },
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (s.mediaType == "image" && media != null)
              CachedNetworkImage(
                imageUrl: media,
                fit: BoxFit.contain,
                filterQuality: FilterQuality.medium,
                errorWidget: (_, __, ___) => const SizedBox(),
              )
            else
              const Center(
                child: Icon(Icons.play_circle_outline,
                    color: Colors.white38, size: 64),
              ),
            if (s.textOverlay != null && s.textOverlay!.isNotEmpty)
              Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Text(
                    s.textOverlay!,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 24,
                      fontWeight: FontWeight.w800,
                      shadows: [Shadow(color: Colors.black, blurRadius: 8)],
                    ),
                  ),
                ),
              ),
            SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(10),
                child: Column(
                  children: [
                    Row(
                      children: List.generate(widget.stories.length, (i) {
                        return Expanded(
                          child: Container(
                            height: 3,
                            margin: const EdgeInsets.symmetric(horizontal: 2),
                            decoration: BoxDecoration(
                              color: Colors.white24,
                              borderRadius: BorderRadius.circular(2),
                            ),
                            child: i == _index
                                ? AnimatedBuilder(
                                    animation: _progress,
                                    builder: (_, __) =>
                                        FractionallySizedBox(
                                      alignment: Alignment.centerLeft,
                                      widthFactor: _progress.value,
                                      child: Container(
                                        decoration: BoxDecoration(
                                          color: Colors.white,
                                          borderRadius:
                                              BorderRadius.circular(2),
                                        ),
                                      ),
                                    ),
                                  )
                                : (i < _index
                                    ? Container(color: Colors.white)
                                    : null),
                          ),
                        );
                      }),
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        GwAvatar(
                            url: resolveMedia(s.author?.avatarUrl),
                            name: name,
                            size: 34),
                        const SizedBox(width: 10),
                        Text(name,
                            style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w700)),
                        const SizedBox(width: 8),
                        Text(timeAgo(s.createdAt),
                            style: const TextStyle(
                                color: Colors.white70, fontSize: 12)),
                        const Spacer(),
                        GestureDetector(
                          onTap: () => Navigator.of(context).pop(),
                          child: const Icon(Icons.close, color: Colors.white),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
