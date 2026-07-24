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
  Future<void> loadRuntimeConfig() async {
    try {
      final res = await _http
          .get(Uri.parse("${AppConfig.apiBase}/api/mobile/config"))
          .timeout(const Duration(seconds: 8));
      if (res.statusCode >= 400) return;
      final j = _decode(res);
      if (j == null) return;
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

  /// Ensure a live token before a data call. Re-mints via the Cognito refresh
  /// token when we're within the refresh window; returns false when the session
  /// is truly over (caller should route to sign-in).
  Future<bool> _ensureFreshToken() async {
    final s = _session;
    if (s == null) return false;
    if (!s.needsRefresh) return true;
    if (s.refreshToken == null || s.cognitoUsername == null) {
      return _keepOrExpire(s);
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
      if (res.statusCode >= 400) return _keepOrExpire(s);
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
      return _keepOrExpire(s);
    }
  }

  /// After a failed refresh: keep using a still-valid token, but if it has
  /// actually expired the session is dead — clear it and bounce to sign-in so a
  /// fresh login mints a working token (rather than failing every write).
  bool _keepOrExpire(Session s) {
    if (!s.isExpired) return true;
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

  /// Web-push the callee about an incoming call (works even when their tab
  /// can't receive the realtime ring). Fire-and-forget beside the broadcast.
  Future<void> callNotify(String conversationId, bool video) async {
    await _mobilePost("/api/mobile/call/notify", {
      "conversationId": conversationId,
      "video": video,
    });
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
