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
      final s = await context.read<AppState>().repo.liveStreams();
      setState(() => _streams = s);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
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
    final past = _streams.where((s) => !s.isLive).toList();

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
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => LiveWatchScreen(stream: s)),
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
    final poster = stream.host?.coverUrl;
    if (poster != null && poster.isNotEmpty) {
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
