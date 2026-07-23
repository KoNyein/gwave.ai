import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../core/secure_screen.dart';
import '../core/theme.dart';

/// Full-screen viewer for a photo whose poster marked it `protected`.
///
/// While this route is on screen it raises the native FLAG_SECURE window flag
/// (via [SecureScreen]) so Android refuses screenshots and screen recording,
/// and it offers no share / save / forward affordance. The flag is released
/// on dispose through the refcount, so returning to the feed re-enables normal
/// capture for the rest of the app.
///
/// Limitation, stated plainly: FLAG_SECURE stops on-device capture only. A
/// second phone photographing the screen cannot be prevented by any app.
class SecureImageViewer extends StatefulWidget {
  const SecureImageViewer({
    super.key,
    required this.imageUrl,
    this.caption,
  });

  final String imageUrl;
  final String? caption;

  static Future<void> open(
    BuildContext context, {
    required String imageUrl,
    String? caption,
  }) {
    return Navigator.of(context).push(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => SecureImageViewer(imageUrl: imageUrl, caption: caption),
      ),
    );
  }

  @override
  State<SecureImageViewer> createState() => _SecureImageViewerState();
}

class _SecureImageViewerState extends State<SecureImageViewer> {
  @override
  void initState() {
    super.initState();
    // Raise FLAG_SECURE as soon as the protected view mounts.
    SecureScreen.enable();
  }

  @override
  void dispose() {
    // Release our hold; the flag clears once no protected view remains.
    SecureScreen.disable();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      // No AppBar actions, no share button, no download — protection means the
      // only exit is back.
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        elevation: 0,
        title: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.lock, size: 16, color: Colors.white70),
            SizedBox(width: 6),
            Text("ကာကွယ်ထားသော ဓာတ်ပုံ",
                style: TextStyle(fontSize: 14, color: Colors.white70)),
          ],
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: Center(
              child: InteractiveViewer(
                maxScale: 4,
                child: CachedNetworkImage(
                  imageUrl: widget.imageUrl,
                  fit: BoxFit.contain,
                  placeholder: (_, __) => Center(
                    child: CircularProgressIndicator(
                        color: GwColors.primaryBright),
                  ),
                  errorWidget: (_, __, ___) => const Icon(
                      Icons.broken_image_outlined,
                      color: Colors.white24,
                      size: 48),
                ),
              ),
            ),
          ),
          if (widget.caption != null && widget.caption!.trim().isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 20),
              child: Text(
                widget.caption!.trim(),
                style: const TextStyle(color: Colors.white70, fontSize: 13),
                textAlign: TextAlign.center,
              ),
            ),
        ],
      ),
    );
  }
}
