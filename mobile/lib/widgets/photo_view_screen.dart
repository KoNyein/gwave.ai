import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

/// Standard full-screen photo viewer: tap a feed/profile photo to open it here.
/// Gestures match what people expect from Facebook / Instagram:
///  - pinch to zoom, drag to pan while zoomed (InteractiveViewer),
///  - double-tap to toggle zoom,
///  - drag down (while not zoomed) to dismiss,
///  - tap the backdrop or the ✕ to close.
class PhotoViewScreen extends StatefulWidget {
  const PhotoViewScreen({super.key, required this.imageUrl});
  final String imageUrl;

  /// Push the viewer with a quick fade — opening a photo shouldn't slide.
  static Future<void> open(BuildContext context, String imageUrl) {
    return Navigator.of(context).push(PageRouteBuilder(
      opaque: false,
      barrierColor: Colors.black,
      transitionDuration: const Duration(milliseconds: 180),
      pageBuilder: (_, __, ___) => PhotoViewScreen(imageUrl: imageUrl),
      transitionsBuilder: (_, anim, __, child) =>
          FadeTransition(opacity: anim, child: child),
    ));
  }

  @override
  State<PhotoViewScreen> createState() => _PhotoViewScreenState();
}

class _PhotoViewScreenState extends State<PhotoViewScreen> {
  final TransformationController _tc = TransformationController();
  double _dragDy = 0; // how far the image is dragged down before releasing
  bool get _zoomed => _tc.value.getMaxScaleOnAxis() > 1.01;

  @override
  void dispose() {
    _tc.dispose();
    super.dispose();
  }

  void _toggleZoom(TapDownDetails d) {
    if (_zoomed) {
      _tc.value = Matrix4.identity();
    } else {
      // Zoom in 2.5× centred on the double-tap point.
      final p = d.localPosition;
      _tc.value = Matrix4.identity()
        ..translate(-p.dx * 1.5, -p.dy * 1.5)
        ..scale(2.5);
    }
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    // Fade the black backdrop as the photo is dragged away.
    final opacity = (1 - (_dragDy.abs() / 400)).clamp(0.4, 1.0);
    return Scaffold(
      backgroundColor: Colors.black.withValues(alpha: opacity),
      body: Stack(
        children: [
          Positioned.fill(
            child: GestureDetector(
              onTap: () => Navigator.of(context).maybePop(),
              // Drag-to-dismiss only when the photo isn't zoomed (otherwise the
              // vertical drag pans the zoomed image instead).
              onVerticalDragUpdate: _zoomed
                  ? null
                  : (d) => setState(() => _dragDy += d.delta.dy),
              onVerticalDragEnd: _zoomed
                  ? null
                  : (d) {
                      if (_dragDy.abs() > 120 ||
                          (d.primaryVelocity ?? 0).abs() > 700) {
                        Navigator.of(context).maybePop();
                      } else {
                        setState(() => _dragDy = 0);
                      }
                    },
              child: Transform.translate(
                offset: Offset(0, _dragDy),
                child: GestureDetector(
                  onDoubleTapDown: _toggleZoom,
                  onDoubleTap: () {},
                  child: InteractiveViewer(
                    transformationController: _tc,
                    minScale: 1,
                    maxScale: 4,
                    // While at 1× a single-finger drag must reach the outer
                    // drag-to-dismiss handler, not pan the image; two-finger
                    // pinch still zooms. Once zoomed, panning is enabled.
                    panEnabled: _zoomed,
                    onInteractionEnd: (_) => setState(() {}),
                    child: Center(
                      child: CachedNetworkImage(
                        imageUrl: widget.imageUrl,
                        fit: BoxFit.contain,
                        filterQuality: FilterQuality.medium,
                        placeholder: (_, __) => const Center(
                          child: CircularProgressIndicator(color: Colors.white),
                        ),
                        errorWidget: (_, __, ___) => const Icon(
                            Icons.broken_image,
                            color: Colors.white38,
                            size: 48),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
          Positioned(
            top: MediaQuery.of(context).padding.top + 4,
            right: 4,
            child: IconButton(
              icon: const Icon(Icons.close, color: Colors.white),
              onPressed: () => Navigator.of(context).maybePop(),
            ),
          ),
        ],
      ),
    );
  }
}
