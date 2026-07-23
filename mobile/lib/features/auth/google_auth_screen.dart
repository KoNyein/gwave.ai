import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../../core/config.dart';
import '../../core/theme.dart';

/// Runs the Cognito Hosted UI Google flow inside the app and hands the
/// resulting `code` straight back — no external browser, no gwave:// deep link,
/// no dependency on the callback round-tripping `state=mobile` (which some
/// browsers / Cognito setups drop, landing the user on the web onboarding page
/// instead of back in the app).
///
/// It loads the authorize URL, lets Cognito + Google do their thing, then
/// intercepts the redirect to `/auth/callback?code=...` (or the `gwave://auth`
/// deep link) and pops the `code` for [AppState.completeGoogleSignIn].
class GoogleAuthScreen extends StatefulWidget {
  const GoogleAuthScreen({super.key});

  /// Push the flow and resolve with the auth code, or null if the user backed
  /// out / it failed.
  static Future<String?> run(BuildContext context) {
    return Navigator.of(context).push<String>(
      MaterialPageRoute(builder: (_) => const GoogleAuthScreen()),
    );
  }

  @override
  State<GoogleAuthScreen> createState() => _GoogleAuthScreenState();
}

class _GoogleAuthScreenState extends State<GoogleAuthScreen> {
  WebViewController? _web;
  int _progress = 0;
  bool _done = false;

  Uri get _authorizeUrl =>
      Uri.parse("${AppConfig.cognitoDomain}/oauth2/authorize").replace(
        queryParameters: {
          "identity_provider": "Google",
          "response_type": "code",
          "client_id": AppConfig.cognitoClientId,
          "scope": "openid email",
          "redirect_uri": AppConfig.googleRedirectUri,
          "state": "mobile",
        },
      );

  /// The redirect we're waiting for — our own callback URL carrying `?code=`.
  bool _isCallback(String url) =>
      url.startsWith("${AppConfig.apiBase}/auth/callback") ||
      url.startsWith("gwave://");

  void _finish(String url) {
    if (_done) return;
    final code = Uri.parse(url).queryParameters["code"];
    _done = true;
    if (mounted) Navigator.of(context).pop(code);
  }

  @override
  void initState() {
    super.initState();
    final controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.white)
      // A plain Chrome UA (no "wv") — Google refuses sign-in from user agents it
      // recognises as an embedded WebView.
      ..setUserAgent(
          "Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) "
          "Chrome/120.0.0.0 Mobile Safari/537.36")
      ..setNavigationDelegate(NavigationDelegate(
        onProgress: (p) {
          if (mounted) setState(() => _progress = p);
        },
        onNavigationRequest: (req) {
          if (_isCallback(req.url)) {
            _finish(req.url);
            return NavigationDecision.prevent;
          }
          return NavigationDecision.navigate;
        },
        onUrlChange: (change) {
          final url = change.url;
          if (url != null && _isCallback(url)) _finish(url);
        },
      ))
      ..loadRequest(_authorizeUrl);
    _web = controller;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text("Continue with Google"),
        bottom: _progress < 100
            ? PreferredSize(
                preferredSize: const Size.fromHeight(2.5),
                child: LinearProgressIndicator(
                  value: _progress <= 0 ? null : _progress / 100,
                  minHeight: 2.5,
                  backgroundColor: Colors.transparent,
                  valueColor: const AlwaysStoppedAnimation(GwColors.primary),
                ),
              )
            : null,
      ),
      body: _web == null
          ? const Center(
              child: CircularProgressIndicator(color: GwColors.primary))
          : WebViewWidget(controller: _web!),
    );
  }
}
