import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:provider/provider.dart';
import 'package:wakelock_plus/wakelock_plus.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';

import '../../core/app_state.dart';
import '../../core/config.dart';
import '../../core/theme.dart';

/// Gwave Metaverse inside the app (Phase 17).
///
/// ★ WebView ကို ရွေးရတာက **code တစ်ခုတည်း** ဖြစ်စေဖို့ — three.js လောကကို
///   native အဖြစ် ထပ်ရေးရင် feature တစ်ခုတိုင်း ၂ ခါ ပြုစုရမယ်။
/// ★ Login ပြန်မလုပ်ရ — app ရဲ့ token ကို `gw_at` cookie အဖြစ် ထည့်ပေးတယ်
///   (web session က တိတိကျကျ အဲဒီ cookie ကို ဖတ်တယ်၊ WebScreen နဲ့ တူတူ)。
/// ★ Mic permission — WebView က တောင်းရင် Android ရဲ့ permission dialog ကို
///   **အရင်ပြရမယ်**၊ ရမှ grant လုပ်ရမယ်။ တန်းပြီး grant လုပ်လိုက်ရင်
///   Android က ငြင်းပြီး voice chat က တိတ်တိတ်ကြီး အလုပ်မလုပ်ဘဲ ဖြစ်မယ်။
class MetaverseScreen extends StatefulWidget {
  const MetaverseScreen({
    super.key,
    this.room = "city",
    this.path,
    this.loadingLabel,
    this.errorLabel,
  });

  /// city / farm / snow / sky / vip
  final String room;

  /// Any other full-screen three.js experience on the same site — the FPV
  /// simulator and the Edu Arcade run through this identical shell so the
  /// signed-in cookie, the native bridge, immersive mode, the mic prompt and
  /// the wake-lock are written once instead of three times.
  final String? path;

  final String? loadingLabel;
  final String? errorLabel;

  @override
  State<MetaverseScreen> createState() => _MetaverseScreenState();
}

/// Open the metaverse from anywhere in the app.
Future<void> openMetaverse(BuildContext context, {String room = "city"}) {
  return Navigator.of(context).push(
    MaterialPageRoute(builder: (_) => MetaverseScreen(room: room)),
  );
}

/// FPV drone simulator (`/fpv`) — same shell, different world.
Future<void> openFpv(BuildContext context) {
  return Navigator.of(context).push(MaterialPageRoute(
    builder: (_) => const MetaverseScreen(
      path: "/fpv?app=1",
      loadingLabel: "စက်ကို ပြင်ဆင်နေသည်…",
      errorLabel: "FPV simulator ကို ဖွင့်လို့ မရသေးပါ။",
    ),
  ));
}

/// Edu Arcade (`/arcade`) — the three.js learning games.
Future<void> openArcade(BuildContext context) {
  return Navigator.of(context).push(MaterialPageRoute(
    builder: (_) => const MetaverseScreen(
      path: "/arcade?app=1",
      loadingLabel: "ဂိမ်းများ ပြင်ဆင်နေသည်…",
      errorLabel: "Arcade ကို ဖွင့်လို့ မရသေးပါ။",
    ),
  ));
}

const _allowedRooms = {"city", "farm", "snow", "sky", "vip"};

class _MetaverseScreenState extends State<MetaverseScreen> {
  WebViewController? _web;
  bool _ready = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    // ★ 3D လောကက အနေတော်ဆုံး အလျားလိုက် — ဒါပေမယ့် အတင်းမလှည့်ဘူး၊
    // portrait ကို ဆက်ခွင့်ပြုတယ် (တစ်လက်နဲ့ ကိုင်ချင်သူတွေ ရှိတယ်)。
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
    _boot();
  }

  @override
  void dispose() {
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    // ★ ထွက်တာနဲ့ wakelock ကို မဖြစ်မနေ ပြန်ဖြုတ်ရမယ် — မဖြုတ်ရင်
    // metaverse ကထွက်ပြီးတောင် ဖန်သားပြင်က ဘယ်တော့မှ မပိတ်တော့ဘူး။
    WakelockPlus.disable().catchError((_) => null);
    super.dispose();
  }

  String get _url {
    final custom = widget.path;
    if (custom != null) return "${AppConfig.apiBase}$custom";
    final room = _allowedRooms.contains(widget.room) ? widget.room : "city";
    // ★ `app=1` က web client ကို "app ထဲမှာ ဖွင့်နေတယ်" လို့ ပြောတယ် —
    // bridge မရောက်သေးခင်ကတည်းက အရည်အသွေးကို လျှော့ချလို့ရအောင်။
    return "${AppConfig.apiBase}/metaverse?room=$room&app=1";
  }

  Future<void> _boot() async {
    final api = context.read<AppState>().api;

    // ── Sign the WebView in ────────────────────────────────────────────────
    try {
      final token = await api.freshToken();
      final host = Uri.parse(AppConfig.apiBase).host;
      if (token != null) {
        final mgr = WebViewCookieManager();
        for (final domain in {host, "www.$host"}) {
          await mgr.setCookie(
            WebViewCookie(name: "gw_at", value: token, domain: domain, path: "/"),
          );
        }
      }
    } catch (_) {
      // ဝင်မထားရင် ဧည့်သည်အဖြစ် ဆက်ဝင်လို့ရတယ် — ပိတ်မထားဘူး။
    }

    final controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.black)
      ..addJavaScriptChannel(
        // ★ JS ကနေ native ကို ခေါ်တဲ့ လမ်းကြောင်း တစ်ခုတည်း — message က
        // JSON ဖြစ်ပြီး မသိတဲ့ `fn` ကို လျစ်လျူရှုတယ်။ Channel တစ်ခုချင်း
        // ဖွင့်ရင် WebView ထဲက ဘယ် script မဆို တိုက်ရိုက် ခေါ်လို့ရမယ်။
        "GwaveNativeBridge",
        onMessageReceived: _onBridgeMessage,
      )
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (_) => _injectBridge(),
          onPageFinished: (_) {
            _injectBridge();
            // ★ `onMetaverseReady` ကို metaverse ကသာ ခေါ်တယ် — FPV/Arcade က
            // မခေါ်ဘူး၊ ဒါကြောင့် အဲဒီနှစ်ခုအတွက် page ပြီးတာနဲ့ loader ကို
            // ဖျောက်ရမယ် (မဟုတ်ရင် အလုပ်လုပ်နေတဲ့ စာမျက်နှာပေါ် spinner
            // ထာဝရ တင်နေမယ်)。
            // ★ Metaverse မှာတော့ **မဖျောက်ရ** — HTML ရောက်တာနဲ့ လောကက
            // ဆောက်ပြီးတာ မဟုတ်ဘူး၊ three.js က နောက်ထပ် စက္ကန့်ပိုင်း
            // ယူတယ်။ ဒီမှာ ဖျောက်လိုက်ရင် "ဆောက်နေသည်" ကနေ မဲနေတဲ့
            // ဖန်သားပြင်ကို ကူးသွားပြီး ပျက်နေသလို ထင်ရမယ်။
            if (widget.path != null && mounted) setState(() => _ready = true);
          },
          onWebResourceError: (err) {
            // ★ အဓိက document ကျမှ ပြရမယ် — ပုံတစ်ပုံ မရလို့ error
            // စာမျက်နှာ ပြလိုက်ရင် လောကက ဘယ်တော့မှ မပေါ်တော့ဘူး။
            if (err.isForMainFrame == false) return;
            if (mounted) setState(() => _error = err.description);
          },
        ),
      );

    if (controller.platform is AndroidWebViewController) {
      final android = controller.platform as AndroidWebViewController;
      // ★ မပါရင် audio/video က user gesture စောင့်နေမယ် — လောကထဲက
      // အသံနဲ့ live screen က တိတ်နေမယ်။
      await android.setMediaPlaybackRequiresUserGesture(false);
      // Lambda ဖြင့် — platform-interface ရဲ့ type နာမည်ကို မခေါ်ရအောင်
      // (package version တစ်ခုနဲ့တစ်ခု export ကွဲတတ်တယ်)。
      await android.setOnPlatformPermissionRequest((request) async {
        final wantsMic =
            request.types.contains(WebViewPermissionResourceType.microphone);
        if (!wantsMic) {
          await request.deny();
          return;
        }
        // ★ Android permission ကို **အရင်တောင်း** → ရမှ WebView ကို grant။
        // တန်းပြီး grant လုပ်ရင် Android က ငြင်းပြီး voice chat က
        // တိတ်တိတ်ကြီး အလုပ်မလုပ်ဘဲ ဖြစ်မယ်။
        final status = await Permission.microphone.request();
        if (status.isGranted) {
          await request.grant();
        } else {
          await request.deny();
        }
      });
    }

    await controller.loadRequest(Uri.parse(_url));
    if (mounted) setState(() => _web = controller);
  }

  /// JS ကနေ လာတဲ့ ခေါ်ဆိုမှုများ။
  void _onBridgeMessage(JavaScriptMessage message) {
    Map<String, dynamic> msg;
    try {
      msg = jsonDecode(message.message) as Map<String, dynamic>;
    } catch (_) {
      return; // JSON မဟုတ်တာ တိတ်တိတ်ပစ်
    }
    final fn = msg["fn"];
    final args = (msg["args"] is List) ? msg["args"] as List : const [];

    switch (fn) {
      case "onMetaverseReady":
        if (mounted) setState(() => _ready = true);
        break;

      case "setKeepAwake":
        final on = args.isNotEmpty && args.first == true;
        // ★ 3D လောကမှာ တစ်နေရာမှာ ရပ်ကြည့်နေရင် ဖုန်းက "ဘာမှမလုပ်ဘူး" လို့
        // ထင်ပြီး ဖန်သားပြင် ပိတ်တယ် — အဲဒါက အလွန်စိတ်ညစ်ဖွယ်။
        (on ? WakelockPlus.enable() : WakelockPlus.disable())
            .catchError((_) => null);
        break;

      case "vibrate":
        // ★ Plugin မလိုဘဲ Flutter ကိုယ်တိုင် ပေးထားတဲ့ haptic ကို သုံးတယ်။
        final ms = args.isNotEmpty ? (args.first as num?)?.toInt() ?? 0 : 0;
        if (ms >= 40) {
          HapticFeedback.mediumImpact();
        } else {
          HapticFeedback.selectionClick();
        }
        break;

      case "openNative":
        // ★ Route ကို whitelist မလုပ်ဘဲ Navigator ကို မပေးဘူး — WebView ထဲက
        // script က app ရဲ့ ဘယ်စာမျက်နှာကိုမဆို ဖွင့်လို့ရသွားမယ်။ အခုတော့
        // "ထွက်မယ်" တစ်ခုတည်း ခွင့်ပြုတယ်။
        if (args.isNotEmpty && args.first == "back") {
          if (mounted) Navigator.of(context).maybePop();
        }
        break;

      default:
        break;
    }
  }

  /// `window.GwaveNative` ကို ထည့်တယ်။
  ///
  /// ★ ဒါက **idempotent** ဖြစ်ရမယ် — onPageStarted ရော onPageFinished ရော
  ///   ၂ ခါ ခေါ်တယ် (စောစော ရောက်ရင် ပိုကောင်းပေမယ့် Android မှာ အာမမခံဘူး)。
  /// ★ Web ဘက်က `gwave-native-ready` event ကို စောင့်တယ် — inject က နောက်ကျရင်
  ///   `window.GwaveNative` မရှိသေးလို့ "app ထဲမဟုတ်ဘူး" လို့ မှားယူဆမယ်။
  void _injectBridge() {
    final controller = _web;
    if (controller == null) return;
    const js = '''
(function () {
  if (window.GwaveNative && window.GwaveNative.v === 1) return;
  var call = function (fn, args) {
    try {
      GwaveNativeBridge.postMessage(JSON.stringify({ fn: fn, args: args || [] }));
    } catch (e) {}
  };
  window.GwaveNative = {
    v: 1,
    platform: "android",
    vibrate: function (ms) { call("vibrate", [ms]); },
    setKeepAwake: function (on) { call("setKeepAwake", [!!on]); },
    openNative: function (route) { call("openNative", [String(route)]); },
    onMetaverseReady: function () { call("onMetaverseReady", []); },
  };
  window.dispatchEvent(new Event("gwave-native-ready"));
})();
''';
    controller.runJavaScript(js).catchError((_) {});
  }

  @override
  Widget build(BuildContext context) {
    final web = _web;
    return PopScope(
      // ★ Back က **metaverse ကနေသာ** ထွက်ရမယ်၊ app ကနေ မထွက်ရ — ဒီ route
      // ကို pop လုပ်တာက အဲဒါပဲ။ WebView ရဲ့ history ကို မနောက်ပြန်ဘူး၊
      // metaverse က single page ဖြစ်လို့ နောက်ပြန်စရာ စာမျက်နှာ မရှိဘူး။
      canPop: true,
      child: Scaffold(
        backgroundColor: Colors.black,
        body: Stack(
          children: [
            if (web != null) Positioned.fill(child: WebViewWidget(controller: web)),
            if (_error != null)
              Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.wifi_off, color: Colors.white54, size: 40),
                      const SizedBox(height: 12),
                      Text(
                        "${widget.errorLabel ?? "Metaverse ကို ဖွင့်လို့ မရသေးပါ။"}\nအင်တာနက် ပြန်စစ်ပြီး ထပ်ကြိုးစားပါ။",
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: Colors.white70),
                      ),
                      const SizedBox(height: 16),
                      FilledButton(
                        onPressed: () {
                          setState(() => _error = null);
                          _web?.loadRequest(Uri.parse(_url));
                        },
                        child: const Text("ထပ်ကြိုးစား"),
                      ),
                    ],
                  ),
                ),
              )
            else if (!_ready)
              Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const CircularProgressIndicator(color: GwColors.primary),
                    const SizedBox(height: 14),
                    Text(
                      widget.loadingLabel ?? "လောကကို ဆောက်နေသည်…",
                      style: const TextStyle(color: Colors.white60, fontSize: 13),
                    ),
                  ],
                ),
              ),
            // ထွက်ရန် — immersive mode မှာ system back bar မရှိတော့လို့
            Positioned(
              left: 8,
              top: MediaQuery.of(context).padding.top + 8,
              child: _RoundButton(
                icon: Icons.arrow_back,
                onTap: () => Navigator.of(context).maybePop(),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RoundButton extends StatelessWidget {
  const _RoundButton({required this.icon, required this.onTap});

  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.black54,
      shape: const CircleBorder(),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(10),
          child: Icon(icon, color: Colors.white, size: 20),
        ),
      ),
    );
  }
}
