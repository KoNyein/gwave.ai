import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_state.dart';
import '../../core/models.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';
import 'go_live_screen.dart';
import 'live_watch_screen.dart';

class LiveListScreen extends StatefulWidget {
  const LiveListScreen({super.key});

  @override
  State<LiveListScreen> createState() => _LiveListScreenState();
}

class _LiveListScreenState extends State<LiveListScreen> {
  List<LiveStream> _streams = [];
  bool _loading = true;
  String? _error;
  Timer? _refresh;

  @override
  void initState() {
    super.initState();
    _load();
    // New broadcasts appear without a manual pull-to-refresh.
    _refresh = Timer.periodic(
        const Duration(seconds: 20), (_) => _load(quiet: true));
  }

  @override
  void dispose() {
    _refresh?.cancel();
    super.dispose();
  }

  Future<void> _load({bool quiet = false}) async {
    if (!quiet) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final repo = context.read<AppState>().repo;
      final api = context.read<AppState>().api;
      var s = await repo.liveStreams();
      // A browser broadcast that died without ending stays "live" forever.
      // Requesting a watch token makes the server check the room and mark
      // dead ones ended — do that for stale-looking lives, then re-fetch.
      final suspicious = s.where((x) =>
          x.isLive &&
          (x.livekitRoom?.isNotEmpty ?? false) &&
          x.createdAt != null &&
          DateTime.now().difference(x.createdAt!).inMinutes > 10);
      if (suspicious.isNotEmpty) {
        await Future.wait(suspicious
            .map((x) => api.liveToken(x.id).then((_) {}).catchError((_) {})));
        s = await repo.liveStreams();
      }
      if (mounted) setState(() => _streams = s);
    } catch (e) {
      if (mounted && !quiet) setState(() => _error = e.toString());
    } finally {
      if (mounted && !quiet) setState(() => _loading = false);
    }
  }

  void _goLive() {
    // Native pre-flight screen; the WebRTC broadcast itself hands off to the
    // web publisher from there. Watching + replay below are fully native.
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => const GoLiveScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
    final live = _streams.where((s) => s.isLive).toList();
    // Only replays that can actually play — ended rows with no recording are
    // dead weight that made the list look broken.
    final past = _streams.where((s) => !s.isLive && s.hasReplay).toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text("Live"),
        actions: [
          TextButton.icon(
            onPressed: _goLive,
            icon: const Icon(Icons.videocam, size: 18),
            label: const Text("Go Live"),
            style: TextButton.styleFrom(foregroundColor: GwColors.live),
          ),
        ],
      ),
      body: RefreshIndicator(
        color: GwColors.primary,
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator(color: GwColors.primary))
            : _error != null && _streams.isEmpty
                ? ListView(children: [
                    const SizedBox(height: 120),
                    GwEmpty(
                        icon: Icons.cloud_off,
                        title: "Couldn't load Live",
                        subtitle: _error),
                  ])
                : ListView(
                    padding: const EdgeInsets.fromLTRB(14, 8, 14, 90),
                    children: [
                      if (live.isNotEmpty) ...[
                        _sectionHeader("🔴 Live now", live.length),
                        const SizedBox(height: 10),
                        ...live.map((s) => Padding(
                              padding: const EdgeInsets.only(bottom: 12),
                              child: _LiveCard(stream: s, onTap: () => _open(s)),
                            )),
                        const SizedBox(height: 8),
                      ],
                      _sectionHeader("Recent broadcasting", past.length),
                      const SizedBox(height: 10),
                      if (past.isEmpty)
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 30),
                          child: GwEmpty(
                            icon: Icons.videocam_off_outlined,
                            title: "No past broadcasts yet",
                          ),
                        )
                      else
                        ...past.map((s) => Padding(
                              padding: const EdgeInsets.only(bottom: 12),
                              child: _LiveCard(stream: s, onTap: () => _open(s)),
                            )),
                    ],
                  ),
      ),
    );
  }

  void _open(LiveStream s) {
    // One-page TikTok-style viewing: swipe up/down moves between broadcasts
    // without ever bouncing back to this list.
    final watchable = [
      ..._streams.where((x) => x.isLive),
      ..._streams.where((x) => !x.isLive && x.hasReplay),
    ];
    final idx = watchable.indexWhere((x) => x.id == s.id);
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => LiveSwipeScreen(
          streams: watchable.isEmpty ? [s] : watchable,
          initialIndex: idx < 0 ? 0 : idx,
        ),
      ),
    );
  }

  Widget _sectionHeader(String title, int count) => Row(
        children: [
          Text(title,
              style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900)),
          const SizedBox(width: 8),
          if (count > 0)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: GwColors.primary.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text("$count",
                  style: const TextStyle(
                      color: GwColors.primary,
                      fontWeight: FontWeight.w700,
                      fontSize: 12)),
            ),
        ],
      );
}

/// Full-screen vertical pager over every watchable broadcast — the TikTok
/// pattern: swipe up for the next live/replay, swipe down for the previous,
/// chat/reactions stay overlaid on the video. One page, no list round-trips.
class LiveSwipeScreen extends StatelessWidget {
  const LiveSwipeScreen({
    super.key,
    required this.streams,
    required this.initialIndex,
  });
  final List<LiveStream> streams;
  final int initialIndex;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: PageView.builder(
        scrollDirection: Axis.vertical,
        controller: PageController(initialPage: initialIndex),
        itemCount: streams.length,
        itemBuilder: (_, i) =>
            LiveWatchScreen(key: ValueKey(streams[i].id), stream: streams[i]),
      ),
    );
  }
}

class _LiveCard extends StatelessWidget {
  const _LiveCard({required this.stream, required this.onTap});
  final LiveStream stream;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final host = stream.host?.displayName ?? "Host";
    return InkWell(
      borderRadius: BorderRadius.circular(GwRadius.lg),
      onTap: onTap,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(GwRadius.lg),
        child: AspectRatio(
          aspectRatio: 16 / 10,
          child: Stack(
            fit: StackFit.expand,
            children: [
              _thumb(),
              Container(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [Colors.transparent, Colors.black87],
                    stops: [0.4, 1],
                  ),
                ),
              ),
              Positioned(
                top: 12,
                left: 12,
                child: stream.isLive
                    ? const GwPill(label: "LIVE", color: GwColors.live, filled: true, icon: Icons.circle)
                    : GwPill(
                        label: "REPLAY",
                        color: Colors.black.withValues(alpha: 0.5),
                        filled: true,
                        icon: Icons.replay),
              ),
              Positioned(
                top: 12,
                right: 12,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.45),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.visibility, size: 13, color: Colors.white),
                      const SizedBox(width: 4),
                      Text("${stream.viewerCount}",
                          style: const TextStyle(
                              color: Colors.white,
                              fontSize: 12,
                              fontWeight: FontWeight.w700)),
                    ],
                  ),
                ),
              ),
              Positioned(
                left: 12,
                right: 12,
                bottom: 12,
                child: Row(
                  children: [
                    GwAvatar(
                      url: stream.host?.avatarUrl,
                      name: host,
                      size: 34,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            stream.title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w800,
                              fontSize: 15,
                            ),
                          ),
                          Text(host,
                              style: TextStyle(
                                  color: Colors.white.withValues(alpha: 0.85),
                                  fontSize: 12)),
                          if (stream.locationName != null &&
                              stream.locationName!.isNotEmpty)
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(Icons.place,
                                    size: 11, color: Colors.white70),
                                const SizedBox(width: 2),
                                Flexible(
                                  child: Text(stream.locationName!,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                          color: Colors.white70,
                                          fontSize: 11)),
                                ),
                              ],
                            ),
                        ],
                      ),
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

  Widget _thumb() {
    // Best visual available: host's cover photo, else their avatar blown up.
    final cover = stream.host?.coverUrl;
    final avatar = stream.host?.avatarUrl;
    final poster = (cover != null && cover.isNotEmpty)
        ? cover
        : (avatar != null && avatar.isNotEmpty)
            ? avatar
            : null;
    if (poster != null) {
      return CachedNetworkImage(
        imageUrl: poster,
        fit: BoxFit.cover,
        errorWidget: (_, __, ___) => _placeholder(),
        placeholder: (_, __) => _placeholder(),
      );
    }
    return _placeholder();
  }

  Widget _placeholder() => Container(
        decoration: const BoxDecoration(gradient: GwColors.primaryGradient),
        child: const Center(
          child: Icon(Icons.videocam, color: Colors.white54, size: 48),
        ),
      );
}
