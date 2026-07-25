import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

/// Firebase Cloud Messaging (FCM) client.
///
/// Best-effort and self-disabling: if the app was built without a bundled
/// `google-services.json` (so `Firebase.initializeApp()` throws) or the device
/// lacks Play Services, every method quietly no-ops and nothing else is
/// affected. When configured, it registers the device's token with the server
/// (`/api/mobile/push/register`) so an incoming call can wake a closed app, and
/// forwards `type: "call"` data messages to a callback that re-connects the
/// realtime ring inbox and surfaces the incoming-call screen.

/// Background isolate handler — must be a top-level, vm:entry-point function so
/// a data message delivered while the app is backgrounded/terminated isn't
/// dropped. The visible ring is driven when the app is (re)opened; a full
/// native lock-screen ringer is layered on in a later step.
@pragma('vm:entry-point')
Future<void> firebaseBackgroundHandler(RemoteMessage message) async {
  try {
    await Firebase.initializeApp();
  } catch (_) {/* not configured / already initialised — nothing to do */}
}

class PushService {
  PushService._();
  static final PushService instance = PushService._();

  bool _enabled = false;
  bool _started = false;
  String? _token;

  Future<void> Function(String token)? _onToken;
  void Function()? _onCallPush;

  String? get token => _token;

  /// Initialise FCM. Safe to call repeatedly (only the first run sets up; later
  /// calls just re-register the current token for the signed-in user).
  Future<void> init({
    required Future<void> Function(String token) onToken,
    void Function()? onCallPush,
  }) async {
    _onToken = onToken;
    _onCallPush = onCallPush;
    if (_started) {
      if (_enabled && _token != null) await _onToken?.call(_token!);
      return;
    }
    _started = true;

    try {
      await Firebase.initializeApp();
      _enabled = true;
    } catch (e) {
      _enabled = false;
      debugPrint("PushService: Firebase not configured, push disabled ($e)");
      return;
    }

    try {
      final fm = FirebaseMessaging.instance;
      FirebaseMessaging.onBackgroundMessage(firebaseBackgroundHandler);

      await fm.requestPermission(alert: true, badge: true, sound: true);
      await fm.setForegroundNotificationPresentationOptions(
          alert: true, badge: true, sound: true);

      FirebaseMessaging.onMessage.listen(_handle);
      FirebaseMessaging.onMessageOpenedApp.listen(_handle);
      final initial = await fm.getInitialMessage();
      if (initial != null) _handle(initial);

      fm.onTokenRefresh.listen((t) {
        _token = t;
        _onToken?.call(t);
      });

      final t = await fm.getToken();
      if (t != null) {
        _token = t;
        await _onToken?.call(t);
      }
    } catch (e) {
      debugPrint("PushService: setup failed ($e)");
    }
  }

  void _handle(RemoteMessage message) {
    if (message.data["type"] == "call") {
      _onCallPush?.call();
    }
  }
}
