import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';

import '../../core/video_audio.dart';

/// A minimal, self-contained fullscreen player for a chat video attachment.
/// Tap to play/pause; a scrubber shows progress. No external controls package
/// so it stays light and always builds.
class VideoViewScreen extends StatefulWidget {
  const VideoViewScreen({super.key, required this.url, this.title});

  final String url;
  final String? title;

  @override
  State<VideoViewScreen> createState() => _VideoViewScreenState();
}

class _VideoViewScreenState extends State<VideoViewScreen>
    with SoundScreen<VideoViewScreen> {
  VideoPlayerController? _c;
  bool _ready = false;
  bool _error = false;

  /// A clip opened from a chat takes the speaker while it is open, and gives
  /// it back the moment it isn't.
  late final SoundClaim _sound = SoundClaim(
    tag: "chat-video",
    onSilence: () => _c?.pause(),
    onRestore: () {
      if (mounted) _c?.play();
    },
  );

  @override
  SoundClaim? get soundClaim => _sound;

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    try {
      final c = watchVideoController(Uri.parse(widget.url));
      // Held before `initialize()` completes so a background or a cover during
      // start-up still has something to pause.
      _c = c;
      await c.initialize();
      await c.setVolume(GwSound.instance.claim(_sound) ? 1 : 0);
      c.addListener(() {
        if (mounted) setState(() {});
      });
      await c.play();
      if (mounted) {
        setState(() {
          _c = c;
          _ready = true;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _error = true);
    }
  }

  @override
  void dispose() {
    GwSound.instance.release(_sound);
    _c?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: Text(widget.title ?? "Video",
            style: const TextStyle(color: Colors.white)),
      ),
      body: Center(
        child: _error
            ? const Text("Couldn't play this video.",
                style: TextStyle(color: Colors.white70))
            : !_ready || _c == null
                ? const CircularProgressIndicator(color: Colors.white)
                : GestureDetector(
                    onTap: () => setState(() {
                      _c!.value.isPlaying ? _c!.pause() : _c!.play();
                    }),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        AspectRatio(
                          aspectRatio: _c!.value.aspectRatio == 0
                              ? 16 / 9
                              : _c!.value.aspectRatio,
                          child: VideoPlayer(_c!),
                        ),
                        VideoProgressIndicator(_c!, allowScrubbing: true),
                        const SizedBox(height: 8),
                        Icon(
                          _c!.value.isPlaying
                              ? Icons.pause_circle
                              : Icons.play_circle,
                          color: Colors.white70,
                          size: 44,
                        ),
                      ],
                    ),
                  ),
      ),
    );
  }
}
