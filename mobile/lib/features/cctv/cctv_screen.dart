import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:video_player/video_player.dart';

import '../../core/app_state.dart';
import '../../core/models.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';

/// Native CCTV: the user's cameras from `user_cameras`. Tapping a camera with a
/// public HLS URL opens a full-screen live viewer.
class CctvScreen extends StatefulWidget {
  const CctvScreen({super.key});

  @override
  State<CctvScreen> createState() => _CctvScreenState();
}

class _CctvScreenState extends State<CctvScreen> {
  List<Camera> _cameras = [];
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
      final c = await context.read<AppState>().repo.cameras();
      setState(() => _cameras = c);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("CCTV")),
      body: RefreshIndicator(
        color: GwColors.primary,
        onRefresh: _load,
        child: _loading
            ? const Center(
                child: CircularProgressIndicator(color: GwColors.primary))
            : _error != null && _cameras.isEmpty
                ? ListView(children: [
                    const SizedBox(height: 120),
                    GwEmpty(
                        icon: Icons.cloud_off,
                        title: "Couldn't load",
                        subtitle: _error),
                  ])
                : _cameras.isEmpty
                    ? ListView(children: const [
                        SizedBox(height: 120),
                        GwEmpty(
                            icon: Icons.videocam_off_outlined,
                            title: "No cameras yet",
                            subtitle: "Add a camera on gwave.cc"),
                      ])
                    : GridView.builder(
                        padding: const EdgeInsets.all(14),
                        gridDelegate:
                            const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 2,
                          crossAxisSpacing: 12,
                          mainAxisSpacing: 12,
                          childAspectRatio: 0.9,
                        ),
                        itemCount: _cameras.length,
                        itemBuilder: (_, i) => _cameraCard(_cameras[i]),
                      ),
      ),
    );
  }

  Widget _cameraCard(Camera c) {
    final playable = c.hlsUrl != null && c.hlsUrl!.isNotEmpty;
    return InkWell(
      borderRadius: BorderRadius.circular(GwRadius.md),
      onTap: playable
          ? () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => _CameraViewer(camera: c)),
              )
          : null,
      child: Card(
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Container(
                color: GwColors.darkBg,
                width: double.infinity,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    Icon(
                      playable ? Icons.play_circle_fill : Icons.videocam_off,
                      color: playable ? Colors.white : Colors.white24,
                      size: 44,
                    ),
                    Positioned(
                      top: 8,
                      left: 8,
                      child: GwPill(
                        label: playable ? "LIVE" : "OFF",
                        color: playable ? GwColors.live : Colors.black45,
                        filled: true,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(c.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontWeight: FontWeight.w700, fontSize: 14)),
                  Text(c.zone ?? c.cameraType,
                      style: const TextStyle(
                          color: GwColors.inkSoft, fontSize: 12)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CameraViewer extends StatefulWidget {
  const _CameraViewer({required this.camera});
  final Camera camera;

  @override
  State<_CameraViewer> createState() => _CameraViewerState();
}

class _CameraViewerState extends State<_CameraViewer> {
  VideoPlayerController? _controller;
  bool _ready = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    final url = widget.camera.hlsUrl;
    if (url == null) {
      setState(() => _error = "This camera has no stream.");
      return;
    }
    try {
      final c = VideoPlayerController.networkUrl(Uri.parse(url));
      _controller = c;
      await c.initialize();
      await c.play();
      if (mounted) setState(() => _ready = true);
    } catch (_) {
      if (mounted) setState(() => _error = "Couldn't open the stream.");
    }
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: Text(widget.camera.title),
      ),
      body: Center(
        child: _error != null
            ? Text(_error!, style: const TextStyle(color: Colors.white70))
            : !_ready || _controller == null
                ? const CircularProgressIndicator(color: Colors.white)
                : AspectRatio(
                    aspectRatio: _controller!.value.aspectRatio == 0
                        ? 16 / 9
                        : _controller!.value.aspectRatio,
                    child: VideoPlayer(_controller!),
                  ),
      ),
    );
  }
}
