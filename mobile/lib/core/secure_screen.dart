import 'package:flutter/services.dart';

/// Screenshot / screen-record protection for privacy-marked media.
///
/// Talks to the native side over a [MethodChannel] whose Android handler adds
/// or clears `WindowManager.LayoutParams.FLAG_SECURE` on the activity window.
/// FLAG_SECURE makes the OS refuse screenshots and screen recording of the
/// window, and blanks the app's thumbnail in the recent-apps switcher.
///
/// The handler is registered in `MainActivity.kt`. That file is scaffolded
/// fresh by `flutter create` on every build (android/ is gitignored), so the
/// registration is re-injected by the build scripts
/// (`~/gwave-ops/build-mobile-apk.sh`) right after scaffolding — see the
/// `MainActivity` heredoc there. There is no Flutter plugin dependency.
///
/// A reference count lets several protected views be on screen (or stacked in
/// the navigator) at once without an inner view's dispose clearing the flag
/// while an outer one still needs it. The flag is on while the count > 0.
///
/// Platform scope: Android only. On every other platform the method calls are
/// no-ops (the channel simply isn't wired), so callers never need to branch.
class SecureScreen {
  SecureScreen._();

  static const MethodChannel _channel =
      MethodChannel('ai.gwave.app/secure_screen');

  static int _refCount = 0;

  /// Number of active protection holders (visible for tests/diagnostics).
  static int get activeHolders => _refCount;

  /// Mark the current screen protected. Safe to call repeatedly; only the
  /// first active holder actually raises FLAG_SECURE.
  static Future<void> enable() async {
    _refCount++;
    if (_refCount == 1) {
      await _invoke('enableSecure');
    }
  }

  /// Release one protection holder. When the last holder releases, FLAG_SECURE
  /// is cleared. Extra calls are clamped at zero so a double-dispose can't push
  /// the count negative and strand the flag on.
  static Future<void> disable() async {
    if (_refCount == 0) return;
    _refCount--;
    if (_refCount == 0) {
      await _invoke('disableSecure');
    }
  }

  static Future<void> _invoke(String method) async {
    try {
      await _channel.invokeMethod(method);
    } on MissingPluginException {
      // Non-Android platform (or a debug run where android/ wasn't scaffolded
      // with the handler): nothing to secure, so ignore silently.
    } on PlatformException {
      // Never let a windowing failure crash the viewer.
    }
  }
}
