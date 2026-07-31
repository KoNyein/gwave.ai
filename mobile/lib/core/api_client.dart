import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';

import 'package:http/http.dart' as http;

import 'config.dart';
import 'session.dart';

class ApiException implements Exception {
  ApiException(this.message, [this.status]);
  final String message;
  final int? status;
  @override
  String toString() => message;
}

/// The app's network layer.
///
/// - **Auth** posts email/password to the Next.js `/api/mobile/auth/*` endpoints,
///   which run the same Cognito flow as the web app and return the minted `gw_at`
///   data token. No browser round-trip — a plain native form.
/// - **Data** goes straight to PostgREST (`$SUPABASE_URL/rest/v1`) with that
///   token as the bearer and the public anon key as `apikey` — exactly how the
///   browser's data client talks to the backend, so every RLS policy resolves
///   against `auth.uid() = profiles.id`.
class ApiClient {
  ApiClient(this._store);

  final SessionStore _store;
  final http.Client _http = http.Client();
  Session? _session;

  /// Called when the session is over (token expired and the refresh failed), so
  /// the app can route back to sign-in instead of silently failing every write
  /// with a stale token. Set by [AppState].
  void Function()? onSessionExpired;

  Session? get session => _session;
  bool get isSignedIn => _session != null && !_session!.isExpired;

  Future<void> loadSession() async {
    _session = await _store.read();
  }

  /// Fetch the web app's exact public data-plane values (`/api/mobile/config`)
  /// so the app always talks to the same PostgREST/JWKS as the browser. This
  /// is what keeps the minted token's `kid` resolvable — a mismatch here is the
  /// "No suitable key or wrong key type" error. Best-effort: on any failure we
  /// keep the build-time `--dart-define` fallback.
  /// Returns true once the runtime config has been applied (now or earlier).
  Future<bool> loadRuntimeConfig() async {
    if (AppConfig.runtimeLoaded) return true;
    try {
      final res = await _http
          .get(Uri.parse("${AppConfig.apiBase}/api/mobile/config"))
          .timeout(const Duration(seconds: 8));
      if (res.statusCode >= 400) return false;
      final j = _decode(res);
      if (j == null) return false;
      AppConfig.applyRuntime(
        url: j["supabaseUrl"] as String?,
        anonKey: j["supabaseAnonKey"] as String?,
        cognitoDomain: j["cognitoDomain"] as String?,
        cognitoClientId: j["cognitoClientId"] as String?,
        mediaCdn: j["mediaCdn"] as String?,
      );
    } catch (_) {
      // Keep the build-time fallback.
    }
    return AppConfig.runtimeLoaded;
  }

  // ---- Auth -----------------------------------------------------------------

  Future<Session> login(String email, String password) =>
      _authenticate("/api/mobile/auth/login", {
        "email": email.trim(),
        "password": password,
      });

  Future<Session> register(String email, String password) =>
      _authenticate("/api/mobile/auth/register", {
        "email": email.trim(),
        "password": password,
      });

  /// Finish native Google sign-in: hand the Cognito Hosted UI authorization
  /// [code] (caught from the `gwave://auth` deep link) to the server, which
  /// exchanges it for tokens and mints our data token.
  Future<Session> googleExchange(String code) =>
      _authenticate("/api/mobile/auth/google", {
        "code": code,
        "redirectUri": AppConfig.googleRedirectUri,
      });

  /// Begin phone sign-in. Returns true if the number was already registered and
  /// we're signed in immediately; false if an SMS code was sent and the app
  /// should collect it via [phoneVerify].
  Future<bool> phoneStart(String phone) async {
    final res = await _http.post(
      Uri.parse("${AppConfig.apiBase}/api/mobile/auth/phone/start"),
      headers: const {"content-type": "application/json"},
      body: jsonEncode({"phone": phone}),
    );
    final j = _decode(res);
    if (res.statusCode >= 400 || j == null) {
      throw ApiException(
        (j?["error"] ?? "Couldn't send the code.").toString(),
        res.statusCode,
      );
    }
    if (j["status"] == "signed_in") {
      final s = _sessionFromAuth(j);
      _session = s;
      await _store.write(s);
      return true;
    }
    return false;
  }

  /// Confirm the SMS code and sign in.
  Future<Session> phoneVerify(String phone, String code) =>
      _authenticate("/api/mobile/auth/phone/verify", {
        "phone": phone,
        "code": code,
      });

  Future<Session> _authenticate(String path, Map<String, dynamic> body) async {
    final res = await _http.post(
      Uri.parse("${AppConfig.apiBase}$path"),
      headers: const {"content-type": "application/json"},
      body: jsonEncode(body),
    );
    final json = _decode(res);
    if (res.statusCode >= 400 || json == null) {
      throw ApiException(
        (json?["error"] ?? "Sign-in failed.").toString(),
        res.statusCode,
      );
    }
    final s = _sessionFromAuth(json);
    _session = s;
    await _store.write(s);
    return s;
  }

  Session _sessionFromAuth(Map<String, dynamic> j) {
    final expiresIn = (j["expiresIn"] as num?)?.toInt() ?? 3600;
    return Session(
      token: j["token"] as String,
      profileId: j["profileId"] as String,
      email: j["email"] as String?,
      cognitoUsername: j["cognitoUsername"] as String?,
      refreshToken: j["refreshToken"] as String?,
      expiresAt: DateTime.now().add(Duration(seconds: expiresIn)),
    );
  }

  Future<void> logout() async {
    _session = null;
    await _store.clear();
  }

  /// Bring the session up at app start (or resume). An *expired* data token is
  /// NOT a dead session: the 30-day Cognito refresh token silently re-mints it,
  /// so we must try a refresh before ever showing sign-in. Returns true when the
  /// app should treat the user as signed in — which stays true through a network
  /// blip or a server hiccup; only a genuine 401 (revoked/expired refresh token)
  /// clears the session and returns false. This is what keeps users logged in
  /// until they actually log out, instead of bouncing to sign-in every time the
  /// hourly token lapsed.
  Future<bool> ensureSession() async {
    if (_session == null) return false;
    if (_session!.needsRefresh) await _ensureFreshToken();
    // _ensureFreshToken clears _session only on a terminal 401; any transient
    // failure leaves it in place, so "still have a session" == "stay signed in".
    return _session != null;
  }

  /// Ensure a live token before a data call. Re-mints via the Cognito refresh
  /// token when we're within the refresh window; returns false when the session
  /// is truly over (caller should route to sign-in).
  Future<bool> _ensureFreshToken() async {
    final s = _session;
    if (s == null) return false;
    if (!s.needsRefresh) return true;
    if (s.refreshToken == null || s.cognitoUsername == null) {
      // No refresh material to exchange. Keep the session; nothing here proves
      // it is dead, and only a 401 below ever ends it.
      return _keepAlive(s);
    }
    try {
      final res = await _http.post(
        Uri.parse("${AppConfig.apiBase}/api/mobile/auth/refresh"),
        headers: const {"content-type": "application/json"},
        body: jsonEncode({
          "refreshToken": s.refreshToken,
          "cognitoUsername": s.cognitoUsername,
        }),
      );
      // 401 is the ONLY terminal case: the Cognito refresh token was revoked or
      // has hit its 30-day limit, so the session is genuinely over.
      if (res.statusCode == 401) return _endSession();
      // Any other failure (5xx, throttling, a transient proxy/DNS error) must
      // NOT sign the user out — a single blocked refresh used to boot people to
      // the login screen. Keep the stored session and retry on the next call.
      if (res.statusCode >= 400) return _keepAlive(s);
      final j = _decode(res)!;
      final expiresIn = (j["expiresIn"] as num?)?.toInt() ?? 3600;
      _session = s.copyWith(
        token: j["token"] as String,
        expiresAt: DateTime.now().add(Duration(seconds: expiresIn)),
        // Adopt the server's profile id: if the account was re-linked to a
        // different profile (support fixing a mismatch), the refreshed token's
        // subject changes and every client-side filter must follow it.
        profileId: (j["profileId"] as String?) ?? s.profileId,
      );
      await _store.write(_session!);
      return true;
    } catch (_) {
      // Offline / DNS / TLS blip — keep the session, never sign out.
      return _keepAlive(s);
    }
  }

  /// A transient refresh failure. Preserve the stored session (and its 30-day
  /// Cognito refresh token) so a blip never bounces the user to sign-in. The
  /// current token stays usable until it actually expires; past that, individual
  /// data calls may fail until connectivity returns and the next refresh
  /// succeeds — but the user stays signed in the whole time.
  bool _keepAlive(Session s) => !s.isExpired;

  /// Terminal: the refresh token is revoked or past its 30-day life (HTTP 401).
  /// Clear the stored session and route to sign-in so a fresh login mints a
  /// working token.
  bool _endSession() {
    _session = null;
    _store.clear();
    onSessionExpired?.call();
    return false;
  }

  /// A currently-valid data token (refreshing first if it's near expiry) —
  /// used to sign the in-app web view in by planting the `gw_at` cookie.
  Future<String?> freshToken() async {
    await _ensureFreshToken();
    return _session?.token;
  }

  // ---- Media upload ---------------------------------------------------------

  /// Upload raw bytes straight to Supabase Storage's `media` bucket — the same
  /// public bucket and `<uid>/<file>` key layout the web app writes to, so a
  /// stored path resolves the same way ([resolveMedia]). The data token is the
  /// bearer and the anon key the apikey, exactly like PostgREST, so the storage
  /// RLS ("first folder = auth.uid()") passes for our own folder. Returns the
  /// stored object path (relative to the bucket).
  Future<String> uploadBytes(
    List<int> bytes, {
    required String ext,
    required String contentType,
    String bucket = "media",
  }) async {
    await _ensureFreshToken();
    final s = _session;
    if (s == null) throw ApiException("Not signed in.");
    // S3 backend: ask the server for a presigned PUT and upload straight to S3.
    if (AppConfig.useS3Media) {
      return _uploadToS3(bytes, ext: ext, contentType: contentType, bucket: bucket);
    }
    // Supabase Storage backend: upload directly with the data token, same as web.
    final rand = Random().nextInt(0x7fffffff).toRadixString(16);
    final path =
        "${s.profileId}/${DateTime.now().microsecondsSinceEpoch}-$rand.$ext";
    final uri =
        Uri.parse("${AppConfig.supabaseUrl}/storage/v1/object/$bucket/$path");
    final res = await _http.post(
      uri,
      headers: {
        "Authorization": "Bearer ${s.token}",
        "apikey": AppConfig.supabaseAnonKey,
        "content-type": contentType,
        "x-upsert": "true",
      },
      body: bytes,
    );
    if (res.statusCode >= 400) {
      throw ApiException(_restError(res), res.statusCode);
    }
    return path;
  }

  /// Presigned S3 upload: POST `/api/mobile/upload` for a short-lived PUT URL
  /// (authed by the data token), then PUT the bytes straight to S3. Returns the
  /// stored key, which resolves under CloudFront via [AppConfig.mediaCdn].
  Future<String> _uploadToS3(
    List<int> bytes, {
    required String ext,
    required String contentType,
    required String bucket,
  }) async {
    final signRes = await _http.post(
      Uri.parse("${AppConfig.apiBase}/api/mobile/upload"),
      headers: {
        "Authorization": "Bearer ${_session!.token}",
        "content-type": "application/json",
      },
      body: jsonEncode({"bucket": bucket, "ext": ext, "contentType": contentType}),
    );
    final j = _decode(signRes);
    if (signRes.statusCode >= 400 || j == null) {
      throw ApiException(
        (j?["error"] ?? "Upload failed.").toString(),
        signRes.statusCode,
      );
    }
    final putRes = await _http.put(
      Uri.parse(j["url"] as String),
      headers: {"content-type": contentType},
      body: bytes,
    );
    if (putRes.statusCode >= 400) {
      throw ApiException("Upload to storage failed.", putRes.statusCode);
    }
    return j["path"] as String;
  }

  // ---- G-Pay ----------------------------------------------------------------

  /// Start a G-Pay top-up: the server creates a Stripe Checkout session for
  /// [amountMmk] (1,000–10,000,000 Ks) and returns its URL; the app opens it in
  /// the browser and the Stripe webhook credits the wallet on payment success.
  Future<String> gpayTopup(int amountMmk) async {
    await _ensureFreshToken();
    final s = _session;
    if (s == null) throw ApiException("Not signed in.");
    final res = await _http.post(
      Uri.parse("${AppConfig.apiBase}/api/mobile/gpay/topup"),
      headers: {
        "Authorization": "Bearer ${s.token}",
        "content-type": "application/json",
      },
      body: jsonEncode({"amount": amountMmk}),
    );
    final j = _decode(res);
    if (res.statusCode >= 400 || j == null || j["url"] == null) {
      throw ApiException(
        (j?["error"] ?? "Couldn't start the top-up.").toString(),
        res.statusCode,
      );
    }
    return j["url"] as String;
  }

  /// Open a G-Pay wallet from the app: submit the KYC details natively (the
  /// same upsert as the web form). A fresh account starts `pending` until an
  /// admin approves it. Returns the account row (id, status, balance…).
  Future<Map<String, dynamic>?> gpayRegister({
    required String fullName,
    required String nrcNumber,
    required String phone,
    required String email,
    required String address,
    String telegram = "",
    String viber = "",
  }) async {
    final j = await _mobilePost("/api/mobile/gpay/register", {
      "fullName": fullName,
      "nrcNumber": nrcNumber,
      "phone": phone,
      "email": email,
      "telegram": telegram,
      "viber": viber,
      "address": address,
    });
    final a = j["account"];
    return a is Map ? a.cast<String, dynamic>() : null;
  }

  /// Join a walkie-talkie channel by its 6-character code. Server-side because
  /// a non-member can't see the channel row under RLS to resolve the code.
  /// Returns the channel id.
  Future<String> pttJoin(String code) async {
    await _ensureFreshToken();
    final s = _session;
    if (s == null) throw ApiException("Not signed in.");
    final res = await _http.post(
      Uri.parse("${AppConfig.apiBase}/api/mobile/ptt/join"),
      headers: {
        "Authorization": "Bearer ${s.token}",
        "content-type": "application/json",
      },
      body: jsonEncode({"code": code}),
    );
    final j = _decode(res);
    if (res.statusCode >= 400 || j == null || j["id"] == null) {
      throw ApiException(
        (j?["error"] ?? "Couldn't join the channel.").toString(),
        res.statusCode,
      );
    }
    return j["id"] as String;
  }

  /// Create a walkie-talkie channel server-side (service role), so the write
  /// isn't blocked by the channel tables' RLS on device. Returns the new
  /// channel row (id, name, join_code, owner_id).
  Future<Map<String, dynamic>> pttCreate(String name) async {
    await _ensureFreshToken();
    final s = _session;
    if (s == null) throw ApiException("Not signed in.");
    final res = await _http.post(
      Uri.parse("${AppConfig.apiBase}/api/mobile/ptt/create"),
      headers: {
        "Authorization": "Bearer ${s.token}",
        "content-type": "application/json",
      },
      body: jsonEncode({"name": name}),
    );
    final j = _decode(res);
    if (res.statusCode >= 400 || j == null || j["channel"] == null) {
      throw ApiException(
        (j?["error"] ?? "Couldn't create the channel.").toString(),
        res.statusCode,
      );
    }
    return (j["channel"] as Map).cast<String, dynamic>();
  }

  /// Comments on a knowledge entry (a strain or mineral). Read + write go
  /// through the mobile API (service role) so the device isn't blocked by the
  /// table's RLS. Returns rows oldest→newest, each with an embedded `author`.
  /// Live networked drone detections near a point — signals reported by SDR
  /// sensors (and other clients) that a phone's own radios can't hear. Public,
  /// best-effort: returns an empty list before the endpoint is deployed or when
  /// nothing is nearby, so it never blocks the map.
  Future<List<Map<String, dynamic>>> nearbyDrones({
    double? lat,
    double? lng,
    int radius = 8000,
  }) async {
    final uri =
        Uri.parse("${AppConfig.apiBase}/api/mobile/drone/nearby").replace(
      queryParameters: {
        "radius": "$radius",
        if (lat != null) "lat": "$lat",
        if (lng != null) "lng": "$lng",
      },
    );
    try {
      final res = await _http.get(uri).timeout(const Duration(seconds: 10));
      final j = _decode(res);
      if (res.statusCode >= 400 || j == null || j["detections"] is! List) {
        return [];
      }
      return (j["detections"] as List).cast<Map<String, dynamic>>();
    } catch (_) {
      return [];
    }
  }

  Future<List<Map<String, dynamic>>> subjectComments(
      String type, String id) async {
    await _ensureFreshToken();
    final s = _session;
    if (s == null) throw ApiException("Not signed in.");
    final uri = Uri.parse("${AppConfig.apiBase}/api/mobile/subject-comments")
        .replace(queryParameters: {"type": type, "id": id});
    final res = await _http.get(uri, headers: {
      "Authorization": "Bearer ${s.token}",
    }).timeout(const Duration(seconds: 12));
    final j = _decode(res);
    if (res.statusCode >= 400 || j == null || j["comments"] is! List) {
      throw ApiException(
        (j?["error"] ?? "Couldn't load comments.").toString(),
        res.statusCode,
      );
    }
    return (j["comments"] as List).cast<Map<String, dynamic>>();
  }

  /// Add a comment to a strain/mineral, optionally with an uploaded media path
  /// ([mediaType] = image | audio | video). Returns the new row (with author).
  Future<Map<String, dynamic>> subjectCommentCreate({
    required String type,
    required String id,
    required String content,
    String? mediaPath,
    String? mediaType,
  }) async {
    await _ensureFreshToken();
    final s = _session;
    if (s == null) throw ApiException("Not signed in.");
    final res = await _http.post(
      Uri.parse("${AppConfig.apiBase}/api/mobile/subject-comments"),
      headers: {
        "Authorization": "Bearer ${s.token}",
        "content-type": "application/json",
      },
      body: jsonEncode({
        "subjectType": type,
        "subjectId": id,
        "content": content,
        if (mediaPath != null) "mediaPath": mediaPath,
        if (mediaType != null) "mediaType": mediaType,
      }),
    );
    final j = _decode(res);
    if (res.statusCode >= 400 || j == null || j["comment"] == null) {
      throw ApiException(
        (j?["error"] ?? "Couldn't post the comment.").toString(),
        res.statusCode,
      );
    }
    return (j["comment"] as Map).cast<String, dynamic>();
  }

  /// Web-push + FCM the callee about an incoming call (works even when their
  /// tab/app can't receive the realtime ring). Passing [callId] additionally
  /// makes the server relay the realtime "ring" broadcast itself, so the
  /// callee still rings when our own socket's broadcast is lost.
  /// Fire-and-forget beside the client-side broadcast.
  Future<void> callNotify(String conversationId, bool video,
      {String? callId}) async {
    await _mobilePost("/api/mobile/call/notify", {
      "conversationId": conversationId,
      "video": video,
      if (callId != null) "callId": callId,
    });
  }

  /// Relay a call-signaling event (accept/offer/answer/ice/decline/hangup/
  /// cancel) through the server, which re-broadcasts it on the Realtime
  /// call channel. Used instead of raw socket sends, which field debugging
  /// showed can silently vanish on some phones while receives keep working.
  Future<void> callSignal(
    String callId,
    String event,
    Map<String, dynamic> payload, {
    String? ringUserId,
  }) async {
    await _mobilePost("/api/mobile/call/signal", {
      "callId": callId,
      "event": event,
      "payload": payload,
      if (ringUserId != null) "ringUserId": ringUserId,
    });
  }

  /// Post a small client-state diagnostics blob; the server just logs it
  /// (`/api/mobile/diag`), making the phone's call-stack state visible in
  /// `docker logs gwave-web` without asking the user for screenshots.
  /// Best-effort — never throws.
  Future<void> sendDiag(Map<String, dynamic> data) async {
    try {
      await _mobilePost("/api/mobile/diag", data);
    } catch (_) {/* diagnostics must never hurt the app */}
  }

  /// Publish an audio catalogue track (server enforces admin). The MP3/cover
  /// are uploaded via [uploadBytes] first; this sends metadata + their paths.
  Future<Map<String, dynamic>> audioPublish(Map<String, dynamic> body) =>
      _mobilePost("/api/mobile/audio/publish", body);

  /// Import a podcast's public RSS feed into the catalogue (server enforces
  /// admin). Returns {show, found, imported, skipped}.
  Future<Map<String, dynamic>> audioImportRss(String url, {int limit = 20}) =>
      _mobilePost("/api/mobile/audio/import-rss", {"url": url, "limit": limit});

  /// Publish a book to the store (PDF/EPUB uploaded via [uploadBytes] first).
  /// Admin publishes platform books; anyone else publishes as themselves.
  Future<Map<String, dynamic>> booksPublish(Map<String, dynamic> body) =>
      _mobilePost("/api/mobile/books/publish", body);

  /// Register this device's FCM token so the server can ring/notify it even when
  /// the app is closed. Best-effort — swallows errors so a push hiccup never
  /// blocks sign-in. Idempotent server-side (re-binds the token to this owner).
  Future<void> registerPushToken(String token) async {
    try {
      await _mobilePost("/api/mobile/push/register", {
        "token": token,
        "platform": "android",
      });
    } catch (_) {/* push just won't reach this device; the app is unaffected */}
  }

  /// Drop this device's FCM token (e.g. on sign-out). Best-effort.
  Future<void> unregisterPushToken(String token) async {
    try {
      await _mobilePost("/api/mobile/push/register", {
        "token": token,
        "remove": true,
      });
    } catch (_) {}
  }

  /// Ask the server whether a broadcast is really still live (it checks the
  /// media plane and self-heals dead rows). Returns the resulting status.
  Future<String> liveVerify(String streamId) async {
    final j = await _mobilePost("/api/mobile/live/verify", {"id": streamId});
    return (j["status"] ?? "").toString();
  }

  /// Runtime ICE (STUN/TURN) config shared with the web client. The TURN
  /// relay is what carries call audio when both peers sit behind carrier NAT.
  Future<List<Map<String, dynamic>>> iceServers() async {
    final j = await _mobileGet("/api/webrtc/ice");
    final list = j["iceServers"];
    if (list is! List) throw ApiException("Bad ICE config.");
    return list
        .whereType<Map>()
        .map((e) => e.cast<String, dynamic>())
        .toList();
  }

  // ---- Crowdsourced WiFi map (WiGLE-style) ----------------------------------

  /// Upload scanned WiFi APs observed at a GPS point to the shared map.
  Future<void> wifiObserve({
    required double latitude,
    required double longitude,
    required List<Map<String, dynamic>> networks,
    /// Platform / OS / app build, so the admin dashboard can show which
    /// clients are contributing scans.
    Map<String, dynamic>? client,
  }) =>
      _mobilePost("/api/mobile/wifi/observe", {
        "latitude": latitude,
        "longitude": longitude,
        "networks": networks,
        if (client != null) "client": client,
      });

  /// The collected WiFi points near a map viewport.
  Future<List<Map<String, dynamic>>> wifiNearby(
    double lat,
    double lng, {
    double radiusKm = 5,
  }) async {
    final j = await _mobileGet("/api/mobile/wifi/nearby", {
      "lat": "$lat",
      "lng": "$lng",
      "radius": "$radiusKm",
    });
    final list = j["networks"];
    return list is List ? list.cast<Map<String, dynamic>>() : [];
  }

  // ---- Marketplace + Dating -------------------------------------------------
  // Both features read/write through the mobile API (service role) with the
  // data token as bearer — same shape as /subject-comments.

  Future<Map<String, dynamic>> _mobileGet(
    String path, [
    Map<String, String>? query,
  ]) async {
    await _ensureFreshToken();
    final s = _session;
    if (s == null) throw ApiException("Not signed in.");
    final uri = Uri.parse("${AppConfig.apiBase}$path")
        .replace(queryParameters: (query?.isEmpty ?? true) ? null : query);
    final res = await _http.get(uri, headers: {
      "Authorization": "Bearer ${s.token}",
    }).timeout(const Duration(seconds: 15));
    final j = _decode(res);
    if (res.statusCode >= 400 || j == null) {
      throw ApiException(
        (j?["error"] ?? "Request failed.").toString(),
        res.statusCode,
      );
    }
    return j;
  }

  Future<Map<String, dynamic>> _mobilePost(
    String path,
    Map<String, dynamic> body,
  ) async {
    await _ensureFreshToken();
    final s = _session;
    if (s == null) throw ApiException("Not signed in.");
    final res = await _http
        .post(
          Uri.parse("${AppConfig.apiBase}$path"),
          headers: {
            "Authorization": "Bearer ${s.token}",
            "content-type": "application/json",
          },
          body: jsonEncode(body),
        )
        .timeout(const Duration(seconds: 20));
    final j = _decode(res);
    if (res.statusCode >= 400 || j == null) {
      throw ApiException(
        (j?["error"] ?? "Request failed.").toString(),
        res.statusCode,
      );
    }
    return j;
  }

  /// Marketplace feed (newest first). [mine] switches to my own listings
  /// (any status); otherwise active listings, optionally filtered.
  Future<List<Map<String, dynamic>>> marketList({
    String? q,
    String? category,
    bool mine = false,
  }) async {
    final j = await _mobileGet("/api/mobile/market", {
      if (q != null && q.isNotEmpty) "q": q,
      if (category != null && category.isNotEmpty) "category": category,
      if (mine) "mine": "1",
    });
    return ((j["listings"] as List?) ?? const [])
        .cast<Map<String, dynamic>>();
  }

  /// Create a marketplace listing. [photos] are storage keys from
  /// [uploadBytes]. Returns the new row.
  Future<Map<String, dynamic>> marketCreate({
    required String title,
    required String description,
    required num price,
    required String category,
    required String location,
    List<String> photos = const [],
    String currency = "MMK",
  }) async {
    final j = await _mobilePost("/api/mobile/market", {
      "title": title,
      "description": description,
      "price": price,
      "currency": currency,
      "category": category,
      "location": location,
      "photos": photos,
    });
    return (j["listing"] as Map).cast<String, dynamic>();
  }

  /// Seller marks a listing active/sold/hidden.
  Future<void> marketSetStatus(String id, String status) =>
      _mobilePost("/api/mobile/market/status", {"id": id, "status": status});

  /// My dating profile, or null when not set up yet.
  Future<Map<String, dynamic>?> datingMe() async {
    final j = await _mobileGet("/api/mobile/dating");
    final p = j["profile"];
    return p is Map ? p.cast<String, dynamic>() : null;
  }

  /// Create/update my dating profile (18+; the server checks the birth year).
  Future<Map<String, dynamic>> datingSave({
    required String displayName,
    required int birthYear,
    required String gender,
    required String lookingFor,
    String bio = "",
    String city = "",
    List<String> photos = const [],
    bool active = true,
  }) async {
    final j = await _mobilePost("/api/mobile/dating", {
      "displayName": displayName,
      "birthYear": birthYear,
      "gender": gender,
      "lookingFor": lookingFor,
      "bio": bio,
      "city": city,
      "photos": photos,
      "active": active,
    });
    return (j["profile"] as Map).cast<String, dynamic>();
  }

  /// The swipe deck (unswiped, preference-matched, active profiles).
  Future<List<Map<String, dynamic>>> datingCandidates() async {
    final j = await _mobileGet("/api/mobile/dating/candidates");
    return ((j["candidates"] as List?) ?? const [])
        .cast<Map<String, dynamic>>();
  }

  /// Like/pass on [targetId]. Returns true when the like was mutual (match!).
  Future<bool> datingSwipe(String targetId, {required bool liked}) async {
    final j = await _mobilePost("/api/mobile/dating/swipe", {
      "targetId": targetId,
      "liked": liked,
    });
    return j["matched"] == true;
  }

  /// My matches, newest first, each with the other side's dating profile
  /// (`dating`) and account info (`account`).
  Future<List<Map<String, dynamic>>> datingMatches() async {
    final j = await _mobileGet("/api/mobile/dating/matches");
    return ((j["matches"] as List?) ?? const [])
        .cast<Map<String, dynamic>>();
  }

  // ---- Ride hailing ---------------------------------------------------------
  // Everything goes through /api/ride/* rather than PostgREST: the ride tables
  // have RLS with zero policies, so this is the only door. See docs/RIDE.md.

  /// Price a trip for every vehicle type in one call.
  Future<Map<String, dynamic>> rideQuote({
    required double fromLat,
    required double fromLng,
    required double toLat,
    required double toLng,
  }) =>
      _mobilePost("/api/ride/quote", {
        "pickup": {"lat": fromLat, "lng": fromLng},
        "dropoff": {"lat": toLat, "lng": toLng},
      });

  /// Book a ride. [expectedFare] is what the rider was shown — the server
  /// rejects the booking with `fare_changed` if the price has since drifted,
  /// rather than silently charging the new one.
  Future<Map<String, dynamic>> rideRequest({
    required String vehicleType,
    required double fromLat,
    required double fromLng,
    required String fromAddress,
    required double toLat,
    required double toLng,
    required String toAddress,
    required String paymentMethod,
    num? expectedFare,
    String? note,
  }) async {
    final j = await _mobilePost("/api/ride/request", {
      "vehicleType": vehicleType,
      "pickup": {"lat": fromLat, "lng": fromLng, "address": fromAddress},
      "dropoff": {"lat": toLat, "lng": toLng, "address": toAddress},
      "paymentMethod": paymentMethod,
      if (expectedFare != null) "expectedFare": expectedFare,
      if (note != null && note.isNotEmpty) "note": note,
    });
    return Map<String, dynamic>.from(j["ride"] as Map);
  }

  /// One ride plus the other party's card.
  ///
  /// For the rider this call is not just a read: each one advances the driver
  /// search by a step server-side, which is why the ride screen polls it while
  /// waiting instead of sitting on a socket. See lib/ride/dispatch.ts.
  Future<Map<String, dynamic>> rideGet(String rideId) =>
      _mobileGet("/api/ride/$rideId");

  /// What the signed-in user is in the middle of, as rider or as driver.
  /// Called on app start so a killed app can rejoin a trip in progress.
  Future<Map<String, dynamic>> rideActive() => _mobileGet("/api/ride/active");

  Future<Map<String, dynamic>> rideCancel(String rideId, {String? reason}) =>
      _mobilePost("/api/ride/$rideId/cancel", {
        if (reason != null && reason.isNotEmpty) "reason": reason,
      });

  Future<void> rideRate(String rideId, int rating, {String? comment}) =>
      _mobilePost("/api/ride/$rideId/rate", {
        "rating": rating,
        if (comment != null && comment.isNotEmpty) "comment": comment,
      });

  /// Driver: move the trip forward. `arrived` | `in_progress` | `completed`.
  Future<Map<String, dynamic>> rideSetStatus(
    String rideId,
    String status, {
    int? distanceM,
    int? durationS,
  }) async {
    final j = await _mobilePost("/api/ride/$rideId/status", {
      "status": status,
      if (distanceM != null) "distanceM": distanceM,
      if (durationS != null) "durationS": durationS,
    });
    return Map<String, dynamic>.from(j["ride"] as Map);
  }

  /// Driver: answer an offer. Returns false when another driver got there
  /// first — a lost race, not an error worth showing as one.
  Future<bool> rideRespondOffer(String rideId, {required bool accept}) async {
    try {
      await _mobilePost("/api/ride/offers/respond", {
        "rideId": rideId,
        "action": accept ? "accept" : "decline",
      });
      return true;
    } on ApiException catch (e) {
      if (e.status == 409) return false;
      rethrow;
    }
  }

  /// Driver: position heartbeat. [online] toggles Driver Mode; omit it to send
  /// a position without changing the switch.
  Future<Map<String, dynamic>> rideHeartbeat({
    required double lat,
    required double lng,
    double? heading,
    double? speed,
    double? accuracy,
    int? batteryPct,
    bool? online,
  }) =>
      _mobilePost("/api/ride/driver/heartbeat", {
        "lat": lat,
        "lng": lng,
        if (heading != null) "heading": heading,
        if (speed != null) "speed": speed,
        if (accuracy != null) "accuracy": accuracy,
        if (batteryPct != null) "batteryPct": batteryPct,
        if (online != null) "online": online,
      });

  /// Destination suggestions: the rider's own past destinations first (free,
  /// and the best autocomplete there is for them), then a geocoder if the
  /// server has one configured. An empty [q] returns recent destinations.
  Future<List<Map<String, dynamic>>> ridePlaces(
    String q, {
    double? nearLat,
    double? nearLng,
  }) async {
    final j = await _mobileGet("/api/ride/places", {
      if (q.isNotEmpty) "q": q,
      if (nearLat != null) "lat": "$nearLat",
      if (nearLng != null) "lng": "$nearLng",
    });
    return ((j["places"] as List?) ?? const []).cast<Map<String, dynamic>>();
  }

  /// Driver: what is owed on cash trips, and what the wallet holds.
  Future<Map<String, dynamic>> rideSettleInfo() =>
      _mobileGet("/api/ride/driver/settle");

  /// Driver: pay down commission from the G-Pay wallet. Returns the new
  /// outstanding balance.
  Future<num> rideSettlePay(num amount) async {
    final j = await _mobilePost("/api/ride/driver/settle", {"amount": amount});
    return (j["commissionOwed"] as num?) ?? 0;
  }

  /// Mint (or re-fetch) the public "share my trip" link. Idempotent — sharing
  /// twice hands out the same URL, so the first person's link keeps working.
  Future<String> rideShare(String rideId) async {
    final j = await _mobilePost("/api/ride/$rideId/share", const {});
    return j["url"].toString();
  }

  /// Apply to drive, or resubmit after a rejection. Always lands as `pending`
  /// — the server refuses to let this route set a status.
  Future<void> rideDriverApply(Map<String, dynamic> body) =>
      _mobilePost("/api/ride/driver/apply", body);

  /// My driver profile, balance and today's earnings. `driver` is null when
  /// the signed-in user has never applied.
  Future<Map<String, dynamic>> rideDriverMe() =>
      _mobileGet("/api/ride/driver/apply");

  // ---- Live broadcasting ----------------------------------------------------

  Future<Map<String, dynamic>> _liveCall(
    String path,
    Map<String, dynamic> body,
  ) async {
    await _ensureFreshToken();
    final s = _session;
    if (s == null) throw ApiException("Not signed in.");
    final res = await _http.post(
      Uri.parse("${AppConfig.apiBase}$path"),
      headers: {
        "Authorization": "Bearer ${s.token}",
        "content-type": "application/json",
      },
      body: jsonEncode(body),
    );
    final j = _decode(res);
    if (res.statusCode >= 400 || j == null) {
      throw ApiException(
        (j?["error"] ?? "Live request failed.").toString(),
        res.statusCode,
      );
    }
    return j;
  }

  /// Provision an IVS channel for a native broadcast. Returns id + the RTMPS
  /// ingest URL and stream key the phone encoder pushes to. An optional
  /// location tag shows 📍 on the live card.
  Future<({String id, String ingestUrl, String streamKey})> liveCreate(
    String title, {
    String? locationName,
    double? latitude,
    double? longitude,
    bool record = true,
  }) async {
    final j = await _liveCall("/api/mobile/live/create", {
      "title": title,
      "record": record,
      if (locationName != null && locationName.isNotEmpty)
        "locationName": locationName,
      if (latitude != null && longitude != null) ...{
        "latitude": latitude,
        "longitude": longitude,
      },
    });
    return (
      id: j["id"].toString(),
      ingestUrl: j["ingestUrl"].toString(),
      streamKey: j["streamKey"].toString(),
    );
  }

  /// Encoder connected — mark the stream live (+ feed announcement).
  Future<void> liveStart(String id) => _liveCall("/api/mobile/live/start", {"id": id});

  /// End the broadcast (stops the IVS channel, marks the row ended).
  Future<void> liveEnd(String id) => _liveCall("/api/mobile/live/end", {"id": id});

  /// Viewer token for a browser-broadcast Live (LiveKit SFU). Those streams
  /// have no HLS URL, so the app joins the room like the web viewer does.
  Future<({String url, String token})> liveToken(String streamId) async {
    final j = await _mobilePost("/api/mobile/live/token", {"id": streamId});
    return (url: j["url"].toString(), token: j["token"].toString());
  }

  // ---- Learn catalog --------------------------------------------------------

  /// The learn catalog (track + lesson titles) from the web app — lesson
  /// content lives in the web bundle, not the database. Cached server-side.
  Future<List<Map<String, dynamic>>> learnTracks() async {
    final res = await _http
        .get(Uri.parse("${AppConfig.apiBase}/api/mobile/learn/tracks"))
        .timeout(const Duration(seconds: 12));
    if (res.statusCode >= 400) {
      throw ApiException("Couldn't load the course list.", res.statusCode);
    }
    final j = jsonDecode(utf8.decode(res.bodyBytes));
    final tracks = j is Map<String, dynamic> ? j["tracks"] : null;
    if (tracks is List) return tracks.cast<Map<String, dynamic>>();
    return const [];
  }

  /// Full localized lesson content (sections, code samples, quiz) for the
  /// native lesson reader. [lang] is "en" or "my".
  Future<Map<String, dynamic>> learnLesson(
    String track,
    String lesson, {
    String lang = "en",
  }) async {
    final uri = Uri.parse("${AppConfig.apiBase}/api/mobile/learn/lesson")
        .replace(queryParameters: {
      "track": track,
      "lesson": lesson,
      "lang": lang,
    });
    final res = await _http.get(uri).timeout(const Duration(seconds: 12));
    final j = _decode(res);
    if (res.statusCode >= 400 || j == null || j["lesson"] == null) {
      throw ApiException(
        (j?["error"] ?? "Couldn't load the lesson.").toString(),
        res.statusCode,
      );
    }
    return j;
  }

  /// Language-course catalog (slug, labels, flag, counts).
  Future<List<Map<String, dynamic>>> learnLanguages() async {
    final res = await _http
        .get(Uri.parse("${AppConfig.apiBase}/api/mobile/learn/languages"))
        .timeout(const Duration(seconds: 12));
    final j = _decode(res);
    if (res.statusCode >= 400 || j == null || j["courses"] is! List) {
      throw ApiException(
        (j?["error"] ?? "Couldn't load the language courses.").toString(),
        res.statusCode,
      );
    }
    return (j["courses"] as List).cast<Map<String, dynamic>>();
  }

  /// Fetch spoken audio (MP3 bytes) for a phrase from the server TTS proxy, so
  /// the language courses play sound even on devices with no on-device voice.
  /// `bcp47` is the course language tag (e.g. "th-TH"). Returns null on any
  /// failure so the caller can fall back to on-device TTS.
  Future<Uint8List?> ttsBytes(String text, String bcp47) async {
    try {
      final uri = Uri.parse("${AppConfig.apiBase}/api/mobile/tts").replace(
        queryParameters: {"q": text, "lang": bcp47},
      );
      final res = await _http.get(uri).timeout(const Duration(seconds: 10));
      if (res.statusCode == 200 && res.bodyBytes.isNotEmpty) {
        return res.bodyBytes;
      }
    } catch (_) {}
    return null;
  }

  /// One full language course: units with phrases + bilingual UI labels.
  Future<Map<String, dynamic>> learnLanguage(String slug) async {
    final uri = Uri.parse("${AppConfig.apiBase}/api/mobile/learn/languages")
        .replace(queryParameters: {"course": slug});
    final res = await _http.get(uri).timeout(const Duration(seconds: 15));
    final j = _decode(res);
    if (res.statusCode >= 400 || j == null || j["course"] == null) {
      throw ApiException(
        (j?["error"] ?? "Couldn't load the course.").toString(),
        res.statusCode,
      );
    }
    return j;
  }

  // ---- PostgREST data -------------------------------------------------------

  Map<String, String> _dataHeaders({bool write = false}) {
    final h = <String, String>{
      "apikey": AppConfig.supabaseAnonKey,
      "accept": "application/json",
    };
    if (_session != null) h["Authorization"] = "Bearer ${_session!.token}";
    if (write) {
      h["content-type"] = "application/json";
      h["Prefer"] = "return=representation";
    }
    return h;
  }

  /// GET `$restBase/$table?<query>` → decoded rows.
  Future<List<Map<String, dynamic>>> select(
    String table, {
    Map<String, String> query = const {},
  }) async {
    await _ensureFreshToken();
    final uri = Uri.parse("${AppConfig.restBase}/$table")
        .replace(queryParameters: query.isEmpty ? null : query);
    final res = await _http.get(uri, headers: _dataHeaders());
    if (res.statusCode >= 400) {
      throw ApiException(_restError(res), res.statusCode);
    }
    final body = jsonDecode(utf8.decode(res.bodyBytes));
    if (body is List) return body.cast<Map<String, dynamic>>();
    return const [];
  }

  /// Exact row count for `$table` under [filter], via PostgREST's
  /// `Prefer: count=exact` + a HEAD-like `limit=0` read. The total comes back
  /// in the `Content-Range` header (`*/N`). Returns 0 on any hiccup so a
  /// dashboard tile degrades to a zero rather than throwing.
  Future<int> count(
    String table, {
    Map<String, String> filter = const {},
  }) async {
    await _ensureFreshToken();
    final q = {...filter, "select": "id", "limit": "1"};
    final uri = Uri.parse("${AppConfig.restBase}/$table")
        .replace(queryParameters: q);
    try {
      final res = await _http.get(uri, headers: {
        ..._dataHeaders(),
        "Prefer": "count=exact",
      });
      if (res.statusCode >= 400) return 0;
      // Content-Range is "<start>-<end>/<total>", e.g. "0-0/42".
      final range = res.headers["content-range"];
      final total = range?.split("/").last;
      return int.tryParse(total ?? "") ?? 0;
    } catch (_) {
      return 0;
    }
  }

  Future<Map<String, dynamic>?> insert(
    String table,
    Map<String, dynamic> row,
  ) async {
    await _ensureFreshToken();
    final res = await _http.post(
      Uri.parse("${AppConfig.restBase}/$table"),
      headers: _dataHeaders(write: true),
      body: jsonEncode(row),
    );
    if (res.statusCode >= 400) {
      throw ApiException(_restError(res), res.statusCode);
    }
    final body = jsonDecode(utf8.decode(res.bodyBytes));
    if (body is List && body.isNotEmpty) {
      return body.first as Map<String, dynamic>;
    }
    return null;
  }

  /// POST with `Prefer: resolution=merge-duplicates` — a PostgREST upsert on
  /// the [onConflict] columns (comma-separated).
  Future<Map<String, dynamic>?> upsert(
    String table,
    Map<String, dynamic> row, {
    required String onConflict,
  }) async {
    await _ensureFreshToken();
    final uri = Uri.parse("${AppConfig.restBase}/$table")
        .replace(queryParameters: {"on_conflict": onConflict});
    final res = await _http.post(
      uri,
      headers: {
        ..._dataHeaders(write: true),
        "Prefer": "return=representation,resolution=merge-duplicates",
      },
      body: jsonEncode(row),
    );
    if (res.statusCode >= 400) {
      throw ApiException(_restError(res), res.statusCode);
    }
    final body = jsonDecode(utf8.decode(res.bodyBytes));
    if (body is List && body.isNotEmpty) {
      return body.first as Map<String, dynamic>;
    }
    return null;
  }

  /// PATCH `$restBase/$table?<filter>` with [values]. Filters are PostgREST
  /// operators, e.g. `{ "id": "eq.<id>" }`.
  Future<void> update(
    String table,
    Map<String, dynamic> values, {
    required Map<String, String> filter,
  }) async {
    await _ensureFreshToken();
    final uri = Uri.parse("${AppConfig.restBase}/$table")
        .replace(queryParameters: filter);
    final res = await _http.patch(
      uri,
      headers: _dataHeaders(write: true),
      body: jsonEncode(values),
    );
    if (res.statusCode >= 400) {
      throw ApiException(_restError(res), res.statusCode);
    }
  }

  /// DELETE `$restBase/$table?<filter>`. Filters are PostgREST operators, e.g.
  /// `{ "post_id": "eq.<id>", "user_id": "eq.<me>" }`.
  Future<void> deleteRows(
    String table, {
    required Map<String, String> filter,
  }) async {
    await _ensureFreshToken();
    final uri = Uri.parse("${AppConfig.restBase}/$table")
        .replace(queryParameters: filter);
    final res = await _http.delete(uri, headers: _dataHeaders());
    if (res.statusCode >= 400) {
      throw ApiException(_restError(res), res.statusCode);
    }
  }

  // ---- Metal prices ---------------------------------------------------------

  /// Live world metal prices (COMEX/NYMEX via Yahoo, LME via metals.dev when
  /// the key is configured). Public — no token needed.
  Future<Map<String, dynamic>> metals() async {
    final res = await _http
        .get(Uri.parse("${AppConfig.apiBase}/api/metals"))
        .timeout(const Duration(seconds: 20));
    final j = _decode(res);
    if (res.statusCode >= 400 || j == null) {
      throw ApiException(
        (j?["error"] ?? "Couldn't load metal prices.").toString(),
        res.statusCode,
      );
    }
    return j;
  }

  /// The hand-recorded market log — border-gate and world quotes an admin
  /// typed in for the metals no free feed prices (tin, antimony, rare earth).
  Future<List<Map<String, dynamic>>> metalQuotes() async {
    final s = _session;
    final res = await _http.get(
      Uri.parse("${AppConfig.apiBase}/api/metals/quotes"),
      headers: {if (s != null) "Authorization": "Bearer ${s.token}"},
    ).timeout(const Duration(seconds: 20));
    final j = _decode(res);
    if (res.statusCode >= 400 || j == null) return const [];
    return ((j["quotes"] as List?) ?? const [])
        .whereType<Map<String, dynamic>>()
        .toList();
  }

  // ---- Cannabis (18+, educational) ------------------------------------------
  // The market board and the community places map used to be web pages in a
  // webview. These are the same routes the browser calls; the data token goes
  // as the bearer so the server's own 18+ check applies to the app too.

  /// Listed cannabis/hemp/CBD equities and ETFs — public quotes, no auth.
  Future<List<Map<String, dynamic>>> cannabisMarket() async {
    final res = await _http
        .get(Uri.parse("${AppConfig.apiBase}/api/cannabis/market"))
        .timeout(const Duration(seconds: 20));
    final j = _decode(res);
    if (res.statusCode >= 400 || j == null) {
      throw ApiException(
        (j?["error"] ?? "Couldn't load the market board.").toString(),
        res.statusCode,
      );
    }
    return ((j["rows"] as List?) ?? const [])
        .whereType<Map<String, dynamic>>()
        .toList();
  }

  /// The hand-recorded Thai price log — no exchange prices flower, so these
  /// are trade quotes someone typed in, with the market and grade attached.
  Future<List<Map<String, dynamic>>> cannabisQuotes() async {
    final s = _session;
    final res = await _http.get(
      Uri.parse("${AppConfig.apiBase}/api/cannabis/quotes"),
      headers: {if (s != null) "Authorization": "Bearer ${s.token}"},
    ).timeout(const Duration(seconds: 20));
    final j = _decode(res);
    if (res.statusCode >= 400 || j == null) return const [];
    return ((j["quotes"] as List?) ?? const [])
        .whereType<Map<String, dynamic>>()
        .toList();
  }

  /// The community cannabis map — shops, farms and clinics. 18+ server-side,
  /// so a minor's token gets a 403 here rather than an empty list.
  Future<List<Map<String, dynamic>>> cannabisPlaces() async {
    await _ensureFreshToken();
    final s = _session;
    if (s == null) throw ApiException("Not signed in.");
    final res = await _http.get(
      Uri.parse("${AppConfig.apiBase}/api/cannabis/places"),
      headers: {"Authorization": "Bearer ${s.token}"},
    ).timeout(const Duration(seconds: 20));
    final j = _decode(res);
    if (res.statusCode >= 400 || j == null) {
      throw ApiException(
        (j?["error"] ?? "Couldn't load the map.").toString(),
        res.statusCode,
      );
    }
    return ((j["places"] as List?) ?? const [])
        .whereType<Map<String, dynamic>>()
        .toList();
  }

  /// Add a place, or correct one when [id] is given. The server rejects an
  /// incomplete listing — name, kind, address, phone, coordinates and at least
  /// one photo are all required.
  Future<void> cannabisPlaceSave(
    Map<String, dynamic> body, {
    String? id,
  }) async {
    await _ensureFreshToken();
    final s = _session;
    if (s == null) throw ApiException("Not signed in.");
    final uri = Uri.parse("${AppConfig.apiBase}/api/cannabis/places")
        .replace(queryParameters: id == null ? null : {"id": id});
    final headers = {
      "Authorization": "Bearer ${s.token}",
      "content-type": "application/json",
    };
    final payload = jsonEncode(body);
    final res = id == null
        ? await _http.post(uri, headers: headers, body: payload)
        : await _http.patch(uri, headers: headers, body: payload);
    if (res.statusCode >= 400) {
      throw ApiException(
        (_decode(res)?["error"] ?? "Couldn't save the place.").toString(),
        res.statusCode,
      );
    }
  }

  /// Flag a bad listing for the admin queue. One report per person per place.
  Future<void> cannabisPlaceReport(String placeId, String reason) =>
      _mobilePost("/api/cannabis/places/report", {
        "placeId": placeId,
        "reason": reason,
      });

  /// Admin-only removal — the server re-checks the role.
  Future<void> cannabisPlaceDelete(String id) async {
    await _ensureFreshToken();
    final s = _session;
    if (s == null) throw ApiException("Not signed in.");
    final res = await _http.delete(
      Uri.parse("${AppConfig.apiBase}/api/cannabis/places")
          .replace(queryParameters: {"id": id}),
      headers: {"Authorization": "Bearer ${s.token}"},
    );
    if (res.statusCode >= 400) {
      throw ApiException(
        (_decode(res)?["error"] ?? "Couldn't delete.").toString(),
        res.statusCode,
      );
    }
  }

  // ---- Mine sites -----------------------------------------------------------
  // The community mine-site map. mine_sites is RLS-sealed, so everything goes
  // through /api/mine/sites with the data token as bearer — the same door the
  // web board uses, which is why a pin added in the app appears on gwave.cc.

  /// Every mine site, newest first. Reads are public server-side, so this works
  /// even before the user signs in — the map is the part worth browsing cold.
  Future<List<Map<String, dynamic>>> mineSites({String? metal}) async {
    final uri = Uri.parse("${AppConfig.apiBase}/api/mine/sites").replace(
      queryParameters: metal == null ? null : {"metal": metal},
    );
    final s = _session;
    final res = await _http.get(uri, headers: {
      if (s != null) "Authorization": "Bearer ${s.token}",
    }).timeout(const Duration(seconds: 20));
    final j = _decode(res);
    if (res.statusCode >= 400 || j == null) {
      throw ApiException(
        (j?["error"] ?? "Couldn't load the mine map.").toString(),
        res.statusCode,
      );
    }
    return ((j["sites"] as List?) ?? const [])
        .whereType<Map<String, dynamic>>()
        .toList();
  }

  /// Add a site, or correct one when [id] is given. The server rejects an
  /// incomplete pin, so [body] must carry metal, name, region, township,
  /// latitude, longitude and at least one photo path.
  Future<void> mineSiteSave(Map<String, dynamic> body, {String? id}) async {
    await _ensureFreshToken();
    final s = _session;
    if (s == null) throw ApiException("Not signed in.");
    final uri = Uri.parse("${AppConfig.apiBase}/api/mine/sites").replace(
      queryParameters: id == null ? null : {"id": id},
    );
    final headers = {
      "Authorization": "Bearer ${s.token}",
      "content-type": "application/json",
    };
    final payload = jsonEncode(body);
    final res = id == null
        ? await _http.post(uri, headers: headers, body: payload)
        : await _http.patch(uri, headers: headers, body: payload);
    final j = _decode(res);
    if (res.statusCode >= 400) {
      throw ApiException(
        (j?["error"] ?? "Couldn't save the site.").toString(),
        res.statusCode,
      );
    }
  }

  /// Flag a bad pin for the admin queue. One report per person per site.
  Future<void> mineSiteReport(String siteId, String reason) =>
      _mobilePost("/api/mine/sites/report", {
        "siteId": siteId,
        "reason": reason,
      });

  /// Admin-only removal — the server re-checks the role.
  Future<void> mineSiteDelete(String id) async {
    await _ensureFreshToken();
    final s = _session;
    if (s == null) throw ApiException("Not signed in.");
    final res = await _http.delete(
      Uri.parse("${AppConfig.apiBase}/api/mine/sites")
          .replace(queryParameters: {"id": id}),
      headers: {"Authorization": "Bearer ${s.token}"},
    );
    if (res.statusCode >= 400) {
      throw ApiException(
        (_decode(res)?["error"] ?? "Couldn't delete.").toString(),
        res.statusCode,
      );
    }
  }

  /// Call a PostgREST RPC (`/rpc/<fn>`).
  Future<dynamic> rpc(String fn, [Map<String, dynamic> args = const {}]) async {
    await _ensureFreshToken();
    final res = await _http.post(
      Uri.parse("${AppConfig.restBase}/rpc/$fn"),
      headers: _dataHeaders(write: true),
      body: jsonEncode(args),
    );
    if (res.statusCode >= 400) {
      throw ApiException(_restError(res), res.statusCode);
    }
    if (res.body.isEmpty) return null;
    return jsonDecode(utf8.decode(res.bodyBytes));
  }

  Map<String, dynamic>? _decode(http.Response res) {
    if (res.body.isEmpty) return null;
    try {
      final v = jsonDecode(utf8.decode(res.bodyBytes));
      return v is Map<String, dynamic> ? v : null;
    } catch (_) {
      return null;
    }
  }

  String _restError(http.Response res) {
    final j = _decode(res);
    return (j?["message"] ?? j?["error"] ?? "Request failed (${res.statusCode}).")
        .toString();
  }
}
