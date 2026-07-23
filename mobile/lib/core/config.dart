/// Runtime + build-time configuration.
///
/// The data plane (PostgREST + Realtime) and the anon key are the *same*
/// public values the web app ships to the browser (`NEXT_PUBLIC_SUPABASE_URL`
/// / `NEXT_PUBLIC_SUPABASE_ANON_KEY`). They are not secrets, but they differ
/// per environment and MUST match the web app exactly — otherwise the minted
/// `gw_at` token's `kid` won't be in the gateway's JWKS and every data call
/// fails with "No suitable key or wrong key type".
///
/// To guarantee they always match, the app fetches them at startup from the
/// web app's `/api/mobile/config` endpoint (see `ApiClient.loadRuntimeConfig`)
/// and applies them via [applyRuntime]. The `--dart-define` values below are
/// only a fallback used before that fetch completes (or if it fails).
///
/// ```
/// flutter build apk --release \
///   --dart-define=API_BASE=https://gwave.cc \
///   --dart-define=SUPABASE_URL=https://<ref>.supabase.co \
///   --dart-define=SUPABASE_ANON_KEY=<anon key>
/// ```
class AppConfig {
  /// The Next.js app origin — serves the mobile auth API (`/api/mobile/auth/*`),
  /// the runtime `/api/mobile/config`, and hosts the WebRTC go-live publisher.
  static const String apiBase = String.fromEnvironment(
    "API_BASE",
    defaultValue: "https://gwave.cc",
  );

  static const String _fallbackUrl = String.fromEnvironment(
    "SUPABASE_URL",
    defaultValue: "",
  );

  static const String _fallbackAnonKey = String.fromEnvironment(
    "SUPABASE_ANON_KEY",
    defaultValue: "",
  );

  /// Live data-plane values. Start from the build-time fallback and get
  /// overwritten by [applyRuntime] once `/api/mobile/config` responds.
  static String _supabaseUrl = _fallbackUrl;
  static String _supabaseAnonKey = _fallbackAnonKey;

  /// Cognito Hosted UI values for native Google sign-in, fetched at startup.
  /// Empty means Google sign-in isn't configured on the server — the app hides
  /// the Google button.
  static String _cognitoDomain = "";
  static String _cognitoClientId = "";

  static String get cognitoDomain => _cognitoDomain;
  static String get cognitoClientId => _cognitoClientId;

  /// The redirect the Cognito Hosted UI sends the browser back to after
  /// Google auth. This is the *web's already-registered* callback — a custom
  /// gwave:// scheme can't be whitelisted on the Cognito app client, so the
  /// app borrows the web callback with `state=mobile`; the server then bounces
  /// the code into the app via the `gwave://auth` deep link (see
  /// /auth/callback), and the app exchanges it at /api/mobile/auth/google
  /// using this same URL as redirect_uri.
  static String get googleRedirectUri => "$apiBase/auth/callback";

  static bool get googleEnabled =>
      _cognitoDomain.isNotEmpty && _cognitoClientId.isNotEmpty;

  /// CloudFront base for media (from the web's `NEXT_PUBLIC_S3_CDN`). Set means
  /// media lives on S3: read from `$mediaCdn/$path` and upload via a presigned
  /// S3 PUT. Empty means Supabase Storage (`$supabaseUrl/storage/v1/...`).
  static String _mediaCdn = "";
  static String get mediaCdn => _mediaCdn;

  /// True when media is on the S3/CloudFront backend.
  static bool get useS3Media => _mediaCdn.isNotEmpty;

  /// PostgREST/Realtime gateway base (no trailing slash).
  static String get supabaseUrl => _supabaseUrl;

  /// Public anon key sent as the `apikey` header to PostgREST.
  static String get supabaseAnonKey => _supabaseAnonKey;

  /// REST lives at `$supabaseUrl/rest/v1`.
  static String get restBase => "$supabaseUrl/rest/v1";

  /// Realtime WebSocket gateway (`wss://host/realtime/v1`) — carries the
  /// messenger call signaling (broadcast), same as the web supabase-js client.
  static String get realtimeUrl =>
      "${_supabaseUrl.replaceFirst(RegExp(r'^http'), 'ws')}/realtime/v1";

  /// CI build number (--dart-define=APP_BUILD, the workflow run number).
  /// 0 in local/dev builds, which disables the update banner.
  static const int appBuild = int.fromEnvironment("APP_BUILD", defaultValue: 0);

  /// The rolling release's version manifest, published next to gwave.apk.
  static const String versionManifestUrl =
      "https://github.com/KoNyein/gwave.ai/releases/download/mobile-latest/version.json";

  /// Where users grab the newest APK.
  static String get downloadUrl => "$apiBase/download/apk";

  static bool get isConfigured =>
      _supabaseUrl.isNotEmpty && _supabaseAnonKey.isNotEmpty;

  /// Adopt the exact values the web app uses, fetched at startup. Empty /
  /// null values are ignored so a partial response can't wipe a good fallback.
  static void applyRuntime({
    String? url,
    String? anonKey,
    String? cognitoDomain,
    String? cognitoClientId,
    String? mediaCdn,
  }) {
    if (url != null && url.isNotEmpty) _supabaseUrl = url;
    if (anonKey != null && anonKey.isNotEmpty) _supabaseAnonKey = anonKey;
    if (cognitoDomain != null) _cognitoDomain = cognitoDomain;
    if (cognitoClientId != null) _cognitoClientId = cognitoClientId;
    if (mediaCdn != null) _mediaCdn = mediaCdn;
  }
}
