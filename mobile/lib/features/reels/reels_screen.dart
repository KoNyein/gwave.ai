import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:geolocator/geolocator.dart';
import 'package:provider/provider.dart';
import 'package:video_player/video_player.dart';

import '../../core/app_state.dart';
import '../../core/i18n.dart';
import '../../core/models.dart';
import '../../core/repository.dart';
import '../../core/theme.dart';
import '../../widgets/share_sheet.dart';
import '../../widgets/common.dart';
import '../create/upload_flow.dart';
import '../../core/video_audio.dart';

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
    // Optional location tag (GPS), like posts.
    double? lat, lng;
    String? locName;
    final tag = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(tr(ctx, "Tag your location?", "တည်နေရာ တွဲတင်မလား?")),
        content: Text(tr(
            ctx,
            "Viewers will see 📍 on your reel and can open it on the map.",
            "ကြည့်သူများ reel ပေါ်တွင် 📍 မြင်ရပြီး မြေပုံပေါ်တွင် ဖွင့်ကြည့်နိုင်ပါမည်။")),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: Text(tr(ctx, "Skip", "မတွဲပါ"))),
          ElevatedButton(
              onPressed: () => Navigator.of(ctx).pop(true),
              child: Text(tr(ctx, "📍 Tag location", "📍 တည်နေရာ တွဲမည်"))),
        ],
      ),
    );
    if (tag == true && mounted) {
      try {
        var perm = await Geolocator.checkPermission();
        if (perm == LocationPermission.denied) {
          perm = await Geolocator.requestPermission();
        }
        if (perm != LocationPermission.denied &&
            perm != LocationPermission.deniedForever) {
          final pos = await Geolocator.getCurrentPosition(
            locationSettings:
                const LocationSettings(accuracy: LocationAccuracy.high),
          ).timeout(const Duration(seconds: 12));
          lat = pos.latitude;
          lng = pos.longitude;
          locName = tr(context, "My location", "ကျွန်ုပ်တည်နေရာ");
        }
      } catch (_) {
        // Best-effort — the reel still posts without a tag.
      }
    }
    if (!mounted) return;
    try {
      await context.read<AppState>().repo.createReel(
            media.path,
            caption: caption,
            locationName: locName,
            latitude: lat,
            longitude: lng,
          );
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
        child: const Icon(Icons.videocam, color: Colors.white),
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

  /// The reel's claim on the speaker, so an unmuted reel pauses the music
  /// instead of playing over it — and stops when the app is backgrounded
  /// instead of playing on in the user's pocket.
  late final SoundClaim _sound = SoundClaim(
    tag: "reel:${widget.reel.id}",
    onSilence: () => _controller?.pause(),
    onRestore: () {
      if (mounted && widget.active) _controller?.play();
    },
  );

  @override
  void initState() {
    super.initState();
    _init();
  }

  /// Take or hand back the speaker, and set the volume to match. Returns the
  /// volume actually applied: a reel that cannot have the sound (a call is in
  /// progress) keeps playing silently rather than interrupting.
  double _applySound({required bool wantsSound}) {
    if (!wantsSound) {
      GwSound.instance.release(_sound);
      return 0;
    }
    return GwSound.instance.claim(_sound) ? 1 : 0;
  }

  Future<void> _init() async {
    final url = resolveMedia(widget.reel.videoPath, bucket: "media");
    if (url == null) return;
    // mixWithOthers, then decide about the music ourselves: a muted reel
    // scrolling past has no claim on the speaker, an unmuted one does.
    final c = silentVideoController(Uri.parse(url));
    _controller = c;
    try {
      await c.initialize();
      await c.setLooping(true);
      await c.setVolume(
          _applySound(wantsSound: widget.active && !_muted));
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
      _controller!.setVolume(_applySound(wantsSound: !_muted));
      _controller!.play();
    } else if (!widget.active && old.active) {
      // Scrolled away or the tab was left: this reel has no claim on the
      // speaker any more, so the music it interrupted can come back.
      _applySound(wantsSound: false);
      _controller!.pause();
      _controller!.seekTo(Duration.zero);
    }
  }

  void _toggleMute() {
    _muted = !_muted;
    _controller?.setVolume(_applySound(wantsSound: widget.active && !_muted));
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    GwSound.instance.release(_sound);
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
                if (r.locationName != null && r.locationName!.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.place,
                          size: 14, color: Colors.white70),
                      const SizedBox(width: 3),
                      Flexible(
                        child: Text(r.locationName!,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                                color: Colors.white70,
                                fontSize: 12.5,
                                fontWeight: FontWeight.w600)),
                      ),
                    ],
                  ),
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
                _rail(Icons.share, "Share", Colors.white, () {
                  showShareSheet(
                    context,
                    url: "https://gwave.cc/reels/${widget.reel.id}",
                    title: "Gwave reel",
                  );
                }),
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
