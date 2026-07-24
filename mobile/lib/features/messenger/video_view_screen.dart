import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';

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

class _VideoViewScreenState extends State<VideoViewScreen> {
  VideoPlayerController? _c;
  bool _ready = false;
  bool _error = false;

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    try {
      final c = VideoPlayerController.networkUrl(Uri.parse(widget.url));
      await c.initialize();
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
