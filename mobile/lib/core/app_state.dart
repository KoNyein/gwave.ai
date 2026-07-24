import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:flutter/foundation.dart';

import '../features/health/health_store.dart';
import 'api_client.dart';
import 'models.dart';
import 'repository.dart';
import 'session.dart';

enum AuthStatus { loading, signedOut, signedIn }

/// Root app state: owns the API client + repository and exposes the sign-in
/// lifecycle to the widget tree via Provider.
class AppState extends ChangeNotifier {
  AppState() {
    api = ApiClient(_store);
    repo = Repository(api);
    // A dead session (expired + refresh failed) routes back to sign-in so a
    // fresh login mints a working token.
    api.onSessionExpired = () {
      me = null;
      status = AuthStatus.signedOut;
      notifyListeners();
    };
    _initDeepLinks();
  }

  final SessionStore _store = SessionStore();
  late final ApiClient api;
  late final Repository repo;

  final AppLinks _appLinks = AppLinks();
  StreamSubscription<Uri>? _linkSub;

  AuthStatus status = AuthStatus.loading;
  Profile? me;

  /// Presence heartbeat: stamp last_seen_at every minute while signed in so
  /// friends see the online dot. Best-effort — a miss just shows us offline.
  Timer? _presence;

  void _startPresence() {
    _presence?.cancel();
    repo.heartbeat();
    _presence =
        Timer.periodic(const Duration(seconds: 60), (_) => repo.heartbeat());
  }

  /// Run after every successful sign-in: wire the Health store to the cloud and
  /// restore this user's health data (vitals, oximeter, activity journal, etc.)
  /// so nothing is lost across logout/login, reinstall, or a new phone.
  /// Best-effort and fire-and-forget — never blocks the UI.
  void _afterSignIn() {
    HealthStore.attachCloud(api);
    HealthStore.restoreFromCloud(api);
  }

  /// Google sign-in progress + error, surfaced to the login screen. The flow
  /// completes asynchronously via the `gwave://auth` deep link, so it can't be
  /// awaited from the button press.
  bool googleBusy = false;
  String? googleError;

  Future<void> bootstrap() async {
    // Adopt the web app's exact data-plane URL + anon key first, so every
    // subsequent PostgREST call hits the same gateway/JWKS as the browser.
    await api.loadRuntimeConfig();
    await api.loadSession();
    if (api.session != null && !api.session!.isExpired) {
      status = AuthStatus.signedIn;
      notifyListeners();
      _loadMe();
      _startPresence();
      _afterSignIn();
    } else {
      status = AuthStatus.signedOut;
      notifyListeners();
    }
  }

  Future<void> _loadMe() async {
    try {
      me = await repo.myProfile();
      notifyListeners();
    } catch (_) {
      // Non-fatal — the app works without the cached profile.
    }
  }

  /// Re-fetch the cached profile after an edit (settings screen).
  Future<void> refreshMe() => _loadMe();

  Future<void> login(String email, String password) async {
    await api.login(email, password);
    status = AuthStatus.signedIn;
    notifyListeners();
    _startPresence();
    _afterSignIn();
    await _loadMe();
  }

  Future<void> register(
    String email,
    String password, {
    DateTime? birthDate,
    String? fullName,
    String? gender,
  }) async {
    await api.register(email, password);
    // Best-effort: registration already succeeded, so don't fail sign-up if a
    // profile detail hiccups (e.g. the gender column isn't deployed yet) — the
    // user can set it later in settings.
    if (birthDate != null) {
      try {
        await repo.setBirthDate(birthDate);
      } catch (_) {}
    }
    if ((fullName != null && fullName.trim().isNotEmpty) || gender != null) {
      try {
        await repo.setProfileBasics(fullName: fullName, gender: gender);
      } catch (_) {}
    }
    status = AuthStatus.signedIn;
    notifyListeners();
    _afterSignIn();
    await _loadMe();
  }

  /// Listen for the `gwave://auth?code=...` redirect from the Cognito Hosted UI
  /// Google flow (both a cold-start link and links while running).
  void _initDeepLinks() {
    _linkSub = _appLinks.uriLinkStream.listen(_handleLink, onError: (_) {});
    _appLinks
        .getInitialLink()
        .then((uri) {
          if (uri != null) _handleLink(uri);
        })
        .catchError((_) {});
  }

  void _handleLink(Uri uri) {
    if (uri.scheme != "gwave") return;
    final code = uri.queryParameters["code"];
    if (code != null && code.isNotEmpty) completeGoogleSignIn(code);
  }

  Future<void> completeGoogleSignIn(String code) async {
    googleBusy = true;
    googleError = null;
    notifyListeners();
    try {
      await api.googleExchange(code);
      status = AuthStatus.signedIn;
      notifyListeners();
      _afterSignIn();
      await _loadMe();
    } catch (e) {
      googleError = e.toString();
    } finally {
      googleBusy = false;
      notifyListeners();
    }
  }

  /// Best-effort profile details after any sign-in path (used by the phone
  /// OTP signup, which can't send them during authentication itself). Never
  /// throws — sign-in already succeeded and details can be set later.
  Future<void> applyProfileBasics({
    String? fullName,
    String? gender,
    DateTime? birthDate,
  }) async {
    if (birthDate != null) {
      try {
        await repo.setBirthDate(birthDate);
      } catch (_) {}
    }
    if ((fullName != null && fullName.trim().isNotEmpty) || gender != null) {
      try {
        await repo.setProfileBasics(fullName: fullName, gender: gender);
      } catch (_) {}
    }
    await _loadMe();
  }

  /// Begin phone sign-in. Returns true if signed in immediately (existing
  /// number); false if the app must collect the SMS code via [verifyPhone].
  Future<bool> startPhone(String phone) async {
    final signedIn = await api.phoneStart(phone);
    if (signedIn) {
      status = AuthStatus.signedIn;
      notifyListeners();
      _afterSignIn();
      await _loadMe();
    }
    return signedIn;
  }

  Future<void> verifyPhone(String phone, String code) async {
    await api.phoneVerify(phone, code);
    status = AuthStatus.signedIn;
    notifyListeners();
    _afterSignIn();
    await _loadMe();
  }

  Future<void> logout() async {
    _presence?.cancel();
    _presence = null;
    HealthStore.detachCloud();
    await api.logout();
    me = null;
    status = AuthStatus.signedOut;
    notifyListeners();
  }

  @override
  void dispose() {
    _presence?.cancel();
    _linkSub?.cancel();
    super.dispose();
  }
}
