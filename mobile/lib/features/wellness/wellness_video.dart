import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';

import '../../core/theme.dart';

/// One curated video in a wellness shelf.
class VideoInfo {
  const VideoInfo({
    required this.id,
    required this.title,
    required this.author,
    this.durationLabel,
  });

  /// YouTube video id (embedded via youtube-nocookie — never opens the app).
  final String id;
  final String title;
  final String author;
  final String? durationLabel;
}

/// A polished inline video card. It shows the poster first (cheap), and on tap
/// swaps in a WebView that plays the clip **inside the app** via a responsive
/// youtube-nocookie `<iframe>` — it never hands off to the YouTube application,
/// and a navigation guard blocks any attempt to leave the embed.
class WellnessVideo extends StatefulWidget {
  const WellnessVideo({super.key, required this.video});

  final VideoInfo video;

  @override
  State<WellnessVideo> createState() => _WellnessVideoState();
}

class _WellnessVideoState extends State<WellnessVideo> {
  WebViewController? _web;
  bool _playing = false;

  static const _allowedHosts = {
    "www.youtube-nocookie.com",
    "youtube-nocookie.com",
    "www.youtube.com",
    "youtube.com",
    "www.google.com",
  };

  String _html(String id) => '''
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { background:#000; height:100%; overflow:hidden; }
  .frame { position:relative; width:100%; height:100%; }
  iframe { position:absolute; inset:0; width:100%; height:100%; border:0; }
</style>
</head>
<body>
  <div class="frame">
    <iframe
      src="https://www.youtube-nocookie.com/embed/$id?playsinline=1&modestbranding=1&rel=0&iv_load_policy=3&fs=1&autoplay=1"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
      allowfullscreen></iframe>
  </div>
</body>
</html>
''';

  void _play() {
    final controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.black)
      ..setNavigationDelegate(NavigationDelegate(
        // Keep everything inside the embed — block any hop to the YouTube app
        // or an external page. Data/about URLs (the loaded HTML) are allowed.
        onNavigationRequest: (req) {
          final u = Uri.tryParse(req.url);
          if (u == null) return NavigationDecision.prevent;
          if (req.url.startsWith("about:") ||
              req.url.startsWith("data:") ||
              _allowedHosts.contains(u.host)) {
            return NavigationDecision.navigate;
          }
          return NavigationDecision.prevent;
        },
      ))
      ..loadHtmlString(_html(widget.video.id),
          baseUrl: "https://www.youtube-nocookie.com");
    if (controller.platform is AndroidWebViewController) {
      (controller.platform as AndroidWebViewController)
          .setMediaPlaybackRequiresUserGesture(false);
    }
    setState(() {
      _web = controller;
      _playing = true;
    });
  }

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(GwRadius.md),
      child: AspectRatio(
        aspectRatio: 16 / 9,
        child: _playing && _web != null
            ? WebViewWidget(controller: _web!)
            : _poster(),
      ),
    );
  }

  Widget _poster() {
    return GestureDetector(
      onTap: _play,
      child: Stack(
        fit: StackFit.expand,
        children: [
          CachedNetworkImage(
            imageUrl:
                "https://i.ytimg.com/vi/${widget.video.id}/hqdefault.jpg",
            fit: BoxFit.cover,
            errorWidget: (_, __, ___) => Container(
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [Color(0xFF16351F), Color(0xFF0F2A16)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
              ),
            ),
          ),
          // Darken for legibility
          Container(color: Colors.black.withValues(alpha: 0.28)),
          const Center(
            child: CircleAvatar(
              radius: 26,
              backgroundColor: Colors.black45,
              child: Icon(Icons.play_arrow, color: Colors.white, size: 34),
            ),
          ),
          Positioned(
            left: 10,
            right: 10,
            bottom: 10,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  widget.video.title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                    fontSize: 14,
                    shadows: [Shadow(color: Colors.black, blurRadius: 6)],
                  ),
                ),
                const SizedBox(height: 2),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        widget.video.author,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.85),
                          fontSize: 12,
                          shadows: const [
                            Shadow(color: Colors.black, blurRadius: 6)
                          ],
                        ),
                      ),
                    ),
                    if (widget.video.durationLabel != null)
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.black54,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(widget.video.durationLabel!,
                            style: const TextStyle(
                                color: Colors.white, fontSize: 11)),
                      ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// A titled, vertically-stacked shelf of inline videos.
class VideoShelf extends StatelessWidget {
  const VideoShelf({super.key, required this.videos});

  final List<VideoInfo> videos;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        for (final v in videos) ...[
          WellnessVideo(video: v),
          const SizedBox(height: 12),
        ],
      ],
    );
  }
}

/// A full-screen, in-app YouTube browser. Given a search query it opens the
/// mobile YouTube site **inside a WebView** so the user can browse and play
/// guided sessions without ever leaving the app — the navigation guard blocks
/// `intent://`/app deep-links, and media plays inline.
class InAppVideoBrowser extends StatefulWidget {
  const InAppVideoBrowser({super.key, required this.query, required this.title});

  final String query;
  final String title;

  @override
  State<InAppVideoBrowser> createState() => _InAppVideoBrowserState();
}

class _InAppVideoBrowserState extends State<InAppVideoBrowser> {
  WebViewController? _web;
  int _progress = 0;

  @override
  void initState() {
    super.initState();
    final url = Uri.parse(
        "https://m.youtube.com/results?search_query=${Uri.encodeQueryComponent(widget.query)}");
    final controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.black)
      ..setNavigationDelegate(NavigationDelegate(
        onProgress: (p) {
          if (mounted) setState(() => _progress = p);
        },
        onNavigationRequest: (req) {
          final u = Uri.tryParse(req.url);
          // Stay on YouTube's web/Google domains; block app intents & hops out.
          if (u != null &&
              (u.host.endsWith("youtube.com") ||
                  u.host.endsWith("youtube-nocookie.com") ||
                  u.host.endsWith("ytimg.com") ||
                  u.host.endsWith("ggpht.com") ||
                  u.host.endsWith("google.com") ||
                  u.host.endsWith("gstatic.com") ||
                  req.url.startsWith("about:") ||
                  req.url.startsWith("data:"))) {
            return NavigationDecision.navigate;
          }
          return NavigationDecision.prevent;
        },
      ))
      ..loadRequest(url);
    if (controller.platform is AndroidWebViewController) {
      (controller.platform as AndroidWebViewController)
          .setMediaPlaybackRequiresUserGesture(false);
    }
    _web = controller;
  }

  Future<bool> _back() async {
    final w = _web;
    if (w != null && await w.canGoBack()) {
      await w.goBack();
      return false;
    }
    return true;
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        if (await _back() && mounted) Navigator.of(context).pop();
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text(widget.title),
          bottom: _progress < 100
              ? PreferredSize(
                  preferredSize: const Size.fromHeight(2),
                  child: LinearProgressIndicator(
                      value: _progress / 100, minHeight: 2),
                )
              : null,
        ),
        body: _web == null
            ? const Center(child: CircularProgressIndicator())
            : WebViewWidget(controller: _web!),
      ),
    );
  }
}

/// A card that launches the in-app video library for [query].
class VideoLibraryCard extends StatelessWidget {
  const VideoLibraryCard({
    super.key,
    required this.query,
    required this.label,
    required this.note,
  });

  final String query;
  final String label;
  final String note;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(GwRadius.md),
      onTap: () => Navigator.of(context).push(MaterialPageRoute(
        builder: (_) => InAppVideoBrowser(query: query, title: label),
      )),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [Color(0xFF7F1D1D), Color(0xFF991B1B)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(GwRadius.md),
        ),
        child: Row(
          children: [
            const Icon(Icons.smart_display, color: Colors.white, size: 30),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label,
                      style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                          fontSize: 14.5)),
                  const SizedBox(height: 2),
                  Text(note,
                      style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.8),
                          fontSize: 12)),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: Colors.white70),
          ],
        ),
      ),
    );
  }
}
