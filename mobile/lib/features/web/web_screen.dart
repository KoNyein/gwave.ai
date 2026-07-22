import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../../core/app_state.dart';
import '../../core/config.dart';
import '../../core/theme.dart';

/// In-app browser for gwave.cc pages — web features open here, signed in,
/// instead of bouncing to the external browser (where no session exists and
/// users landed on the welcome/login pages).
///
/// Signed-in works by planting the app's own data token as the `gw_at`
/// cookie before loading: the web app reads exactly that cookie to recognise
/// a session, and the token is the same ES256 JWT the app already holds.
class WebScreen extends StatefulWidget {
  const WebScreen({super.key, required this.path, this.title});

  /// Path on gwave.cc ("/gpay") or an absolute https URL (Stripe checkout).
  final String path;
  final String? title;

  @override
  State<WebScreen> createState() => _WebScreenState();
}

/// Open [path] inside the app. Use everywhere instead of launching a browser.
Future<void> openWeb(BuildContext context, String path, {String? title}) {
  return Navigator.of(context).push(
    MaterialPageRoute(builder: (_) => WebScreen(path: path, title: title)),
  );
}

class _WebScreenState extends State<WebScreen> {
  WebViewController? _web;
  int _progress = 0;

  Uri get _target => widget.path.startsWith("http")
      ? Uri.parse(widget.path)
      : Uri.parse("${AppConfig.apiBase}${widget.path}");

  @override
  void initState() {
    super.initState();
    _boot();
  }

  Future<void> _boot() async {
    final api = context.read<AppState>().api;

    // Sign the web view in: same token, same cookie the web session uses.
    try {
      final token = await api.freshToken();
      final host = Uri.parse(AppConfig.apiBase).host;
      if (token != null) {
        final mgr = WebViewCookieManager();
        for (final domain in {host, "www.$host"}) {
          await mgr.setCookie(WebViewCookie(
            name: "gw_at",
            value: token,
            domain: domain,
            path: "/",
          ));
        }
      }
    } catch (_) {
      // Not signed in / refresh failed — the page will show its login wall.
    }

    final controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.white)
      ..setNavigationDelegate(NavigationDelegate(
        onProgress: (p) {
          if (mounted) setState(() => _progress = p);
        },
      ))
      ..loadRequest(_target);
    if (mounted) setState(() => _web = controller);
  }

  Future<bool> _goBackInPage() async {
    final web = _web;
    if (web != null && await web.canGoBack()) {
      await web.goBack();
      return true;
    }
    return false;
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        if (!await _goBackInPage() && context.mounted) {
          Navigator.of(context).pop();
        }
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text(widget.title ?? "Gwave",
              maxLines: 1, overflow: TextOverflow.ellipsis),
          actions: [
            IconButton(
              tooltip: "Reload",
              icon: const Icon(Icons.refresh),
              onPressed: () => _web?.reload(),
            ),
          ],
          bottom: _progress < 100
              ? PreferredSize(
                  preferredSize: const Size.fromHeight(2.5),
                  child: LinearProgressIndicator(
                    value: _progress <= 0 ? null : _progress / 100,
                    minHeight: 2.5,
                    backgroundColor: Colors.transparent,
                    valueColor:
                        AlwaysStoppedAnimation(GwColors.primary),
                  ),
                )
              : null,
        ),
        body: _web == null
            ? Center(
                child: CircularProgressIndicator(color: GwColors.primary))
            : WebViewWidget(controller: _web!),
      ),
    );
  }
}
