import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:video_player/video_player.dart';

import '../../core/app_state.dart';
import '../../core/models.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';
import 'live_watch_screen.dart';

/// Horizontal "Live now" rail for the top of the feed. Shows every stream that
/// is broadcasting right now — regardless of who you follow — so a live
/// broadcast reaches every user, not only the host's followers. Renders
/// nothing when nobody is live.
class LiveNowRail extends StatefulWidget {
  const LiveNowRail({super.key});

  @override
  State<LiveNowRail> createState() => _LiveNowRailState();
}

class _LiveNowRailState extends State<LiveNowRail> {
  List<LiveStream> _live = [];
  Timer? _refresh;

  @override
  void initState() {
    super.initState();
    _load();
    // Keep the rail fresh — new broadcasts appear, ended ones drop off.
    _refresh = Timer.periodic(const Duration(seconds: 25), (_) => _load());
  }

  @override
  void dispose() {
    _refresh?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final s =
          await context.read<AppState>().repo.liveStreams(onlyLive: true);
      if (mounted) setState(() => _live = s.where((e) => e.isLive).toList());
    } catch (_) {
      // Non-fatal — the rail just stays hidden/unchanged.
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_live.isEmpty) return const SizedBox.shrink();
    return Container(
      color: GwColors.surface,
      padding: const EdgeInsets.only(top: 10, bottom: 10),
      margin: const EdgeInsets.only(bottom: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(
            padding: EdgeInsets.fromLTRB(14, 0, 14, 8),
            child: Row(
              children: [
                Icon(Icons.circle, color: GwColors.live, size: 10),
                SizedBox(width: 6),
                Text("🔴 Live now",
                    style: TextStyle(
                        fontWeight: FontWeight.w800, fontSize: 14.5)),
              ],
            ),
          ),
          SizedBox(
            height: 168,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              itemCount: _live.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (_, i) => _LiveRailCard(stream: _live[i]),
            ),
          ),
        ],
      ),
    );
  }
}

class _LiveRailCard extends StatefulWidget {
  const _LiveRailCard({required this.stream});
  final LiveStream stream;

  @override
  State<_LiveRailCard> createState() => _LiveRailCardState();
}

class _LiveRailCardState extends State<_LiveRailCard> {
  VideoPlayerController? _vc;

  @override
  void initState() {
    super.initState();
    _initPreview();
  }

  @override
  void dispose() {
    _vc?.dispose();
    super.dispose();
  }

  Future<void> _initPreview() async {
    final url = widget.stream.ivsPlaybackUrl;
    if (url == null || url.isEmpty) return;
    try {
      final c = VideoPlayerController.networkUrl(Uri.parse(url));
      _vc = c;
      await c.initialize();
      await c.setVolume(0);
      await c.play();
      if (mounted) setState(() {});
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.stream;
    final host = s.host?.displayName ?? "Host";
    return GestureDetector(
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => LiveWatchScreen(stream: s)),
      ),
      child: SizedBox(
        width: 118,
        child: ClipRRect(
          borderRadius: BorderRadius.circular(GwRadius.md),
          child: Stack(
            fit: StackFit.expand,
            children: [
              if (_vc != null && _vc!.value.isInitialized)
                FittedBox(
                  fit: BoxFit.cover,
                  clipBehavior: Clip.hardEdge,
                  child: SizedBox(
                    width: _vc!.value.size.width,
                    height: _vc!.value.size.height,
                    child: VideoPlayer(_vc!),
                  ),
                )
              else
                Container(
                  decoration:
                      const BoxDecoration(gradient: GwColors.primaryGradient),
                  child: const Center(
                    child: Icon(Icons.videocam, color: Colors.white70),
                  ),
                ),
              const DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [Colors.transparent, Colors.black87],
                    stops: [0.5, 1],
                  ),
                ),
              ),
              const Positioned(
                top: 8,
                left: 8,
                child: GwPill(
                    label: "LIVE",
                    color: GwColors.live,
                    filled: true,
                    icon: Icons.circle),
              ),
              if (s.viewerCount > 0)
                Positioned(
                  top: 8,
                  right: 8,
                  child: Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.45),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.visibility,
                            size: 11, color: Colors.white),
                        const SizedBox(width: 3),
                        Text("${s.viewerCount}",
                            style: const TextStyle(
                                color: Colors.white,
                                fontSize: 10,
                                fontWeight: FontWeight.w700)),
                      ],
                    ),
                  ),
                ),
              Positioned(
                left: 8,
                right: 8,
                bottom: 8,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      s.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.w800),
                    ),
                    Text(
                      host,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.85),
                          fontSize: 10.5),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
