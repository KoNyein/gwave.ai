import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:video_player/video_player.dart';

import '../../core/app_state.dart';
import '../../core/models.dart';
import '../../core/repository.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';
import '../create/upload_flow.dart';

/// Vertical, full-screen TikTok/Reels feed. One video per page; the visible page
/// plays and loops, the rest pause. Right rail = like/comment/share, bottom-left
/// = author + caption.
class ReelsScreen extends StatefulWidget {
  const ReelsScreen({super.key, this.active = true});

  /// Whether the Reels tab is the one currently on screen. When false (the user
  /// switched to another tab) the visible reel pauses so its audio stops.
  final bool active;

  @override
  State<ReelsScreen> createState() => _ReelsScreenState();
}

class _ReelsScreenState extends State<ReelsScreen> {
  final _pager = PageController();
  List<Reel> _reels = [];
  bool _loading = true;
  String? _error;
  int _page = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _pager.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final r = await context.read<AppState>().repo.reels();
      setState(() => _reels = r);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _createReel() async {
    final media = await pickAndUploadVideo(context);
    if (media == null || !mounted) return;
    final caption = await askCaption(context, title: "Reel caption");
    if (!mounted) return;
    try {
      await context
          .read<AppState>()
          .repo
          .createReel(media.path, caption: caption);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text("Reel posted 🎬")),
        );
        _load();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text("Couldn't post reel — $e")),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      floatingActionButton: FloatingActionButton(
        heroTag: "createReel",
        backgroundColor: GwColors.primary,
        onPressed: _createReel,
        child: Icon(Icons.videocam, color: GwColors.onPrimary),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Colors.white))
          : _error != null && _reels.isEmpty
              ? _errorState()
              : _reels.isEmpty
                  ? _emptyState()
                  : PageView.builder(
                      controller: _pager,
                      scrollDirection: Axis.vertical,
                      itemCount: _reels.length,
                      onPageChanged: (i) => setState(() => _page = i),
                      itemBuilder: (_, i) => _ReelPage(
                        reel: _reels[i],
                        active: i == _page && widget.active,
                      ),
                    ),
    );
  }

  Widget _errorState() => Center(
        child: Padding(
          padding: const EdgeInsets.all(30),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.cloud_off, color: Colors.white38, size: 54),
              const SizedBox(height: 12),
              const Text("Couldn't load Reels",
                  style: TextStyle(color: Colors.white70)),
              const SizedBox(height: 12),
              OutlinedButton(
                onPressed: _load,
                style: OutlinedButton.styleFrom(
                  foregroundColor: Colors.white,
                  side: const BorderSide(color: Colors.white54),
                ),
                child: const Text("Retry"),
              ),
            ],
          ),
        ),
      );

  Widget _emptyState() => const Center(
        child: Padding(
          padding: EdgeInsets.all(30),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.movie_creation_outlined,
                  color: Colors.white38, size: 56),
              SizedBox(height: 12),
              Text("No reels yet",
                  style: TextStyle(color: Colors.white70, fontSize: 16)),
            ],
          ),
        ),
      );
}

class _ReelPage extends StatefulWidget {
  const _ReelPage({required this.reel, required this.active});
  final Reel reel;
  final bool active;

  @override
  State<_ReelPage> createState() => _ReelPageState();
}

class _ReelPageState extends State<_ReelPage> {
  VideoPlayerController? _controller;
  bool _ready = false;
  bool _liked = false;
  late int _likes = widget.reel.likeCount;

  /// Mute preference shared across all reels, so toggling it once sticks as the
  /// user scrolls the feed.
  static bool _muted = false;

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    final url = resolveMedia(widget.reel.videoPath, bucket: "media");
    if (url == null) return;
    final c = VideoPlayerController.networkUrl(Uri.parse(url));
    _controller = c;
    try {
      await c.initialize();
      await c.setLooping(true);
      await c.setVolume(_muted ? 0 : 1);
      if (widget.active) await c.play();
      if (mounted) setState(() => _ready = true);
    } catch (_) {
      // Leave the poster/placeholder in place.
    }
  }

  @override
  void didUpdateWidget(covariant _ReelPage old) {
    super.didUpdateWidget(old);
    if (_controller == null) return;
    if (widget.active && !old.active) {
      _controller!.setVolume(_muted ? 0 : 1);
      _controller!.play();
    } else if (!widget.active && old.active) {
      _controller!.pause();
      _controller!.seekTo(Duration.zero);
    }
  }

  void _toggleMute() {
    setState(() {
      _muted = !_muted;
      _controller?.setVolume(_muted ? 0 : 1);
    });
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  Future<void> _toggleLike() async {
    final next = !_liked;
    setState(() {
      _liked = next;
      _likes += next ? 1 : -1;
    });
    try {
      final serverLiked =
          await context.read<AppState>().repo.toggleReelLike(widget.reel.id);
      if (mounted && serverLiked != next) {
        setState(() {
          _liked = serverLiked;
          _likes += serverLiked ? 1 : -1;
        });
      }
    } catch (_) {
      setState(() {
        _liked = !next;
        _likes += next ? -1 : 1;
      });
    }
  }

  void _togglePlay() {
    final c = _controller;
    if (c == null) return;
    setState(() => c.value.isPlaying ? c.pause() : c.play());
  }

  @override
  Widget build(BuildContext context) {
    final r = widget.reel;
    final name = r.author?.displayName ?? "Creator";
    return GestureDetector(
      onTap: _togglePlay,
      child: Stack(
        fit: StackFit.expand,
        children: [
          if (_ready && _controller != null)
            FittedBox(
              fit: BoxFit.cover,
              child: SizedBox(
                width: _controller!.value.size.width,
                height: _controller!.value.size.height,
                child: VideoPlayer(_controller!),
              ),
            )
          else
            _poster(r),
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.center,
                end: Alignment.bottomCenter,
                colors: [Colors.transparent, Colors.black87],
              ),
            ),
          ),
          if (!_ready)
            const Center(
              child: CircularProgressIndicator(color: Colors.white),
            ),
          Positioned(
            left: 14,
            right: 80,
            bottom: 24,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    GwAvatar(
                        url: resolveMedia(r.author?.avatarUrl), name: name, size: 40),
                    const SizedBox(width: 10),
                    Text(name,
                        style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w800,
                            fontSize: 15)),
                  ],
                ),
                if (r.caption != null && r.caption!.isNotEmpty) ...[
                  const SizedBox(height: 10),
                  Text(r.caption!,
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: Colors.white, fontSize: 14)),
                ],
              ],
            ),
          ),
          Positioned(
            right: 12,
            bottom: 24,
            child: Column(
              children: [
                _rail(
                  _muted ? Icons.volume_off : Icons.volume_up,
                  _muted ? "Muted" : "Sound",
                  Colors.white,
                  _toggleMute,
                ),
                const SizedBox(height: 18),
                _rail(
                  _liked ? Icons.favorite : Icons.favorite_border,
                  "$_likes",
                  _liked ? GwColors.heart : Colors.white,
                  _toggleLike,
                ),
                const SizedBox(height: 18),
                _rail(Icons.remove_red_eye, "${r.viewCount}", Colors.white, null),
                const SizedBox(height: 18),
                _rail(Icons.share, "Share", Colors.white, null),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _poster(Reel r) {
    final poster = resolveMedia(r.posterPath, bucket: "media");
    if (poster != null) {
      return Image.network(poster, fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => Container(color: Colors.black));
    }
    return Container(color: Colors.black);
  }

  Widget _rail(IconData icon, String label, Color color, VoidCallback? onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        children: [
          Icon(icon, color: color, size: 34),
          const SizedBox(height: 4),
          Text(label,
              style: const TextStyle(
                  color: Colors.white,
                  fontSize: 12,
                  fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}
