# Gwave — Native Android app (Flutter)

A native Flutter client for the Gwave super-app. It talks to the **same
production backend** as the web app (gwave.cc): it authenticates through the
existing AWS Cognito **Hosted UI** (opened in an in-app WebView), then the
server mints the same Supabase-compatible bearer the web app uses and the app
reads/writes straight from PostgREST — so every RLS policy applies exactly as it
does on the web (`auth.uid() = profiles.id`).

### Auth flow (matches the web's Cognito setup)

1. App → `GET /api/mobile/auth/start` → Hosted-UI authorize URL + `redirectUri`.
2. WebView loads it; the user signs in with email or Google.
3. Cognito redirects to `…/auth/callback?code=…`; the WebView intercepts that
   navigation and grabs the `code` before the page loads.
4. App → `POST /api/mobile/auth/exchange {code, redirectUri}` → server exchanges
   the code (it holds the client secret), provisions the profile on first
   sign-in, and returns the minted Supabase token + Cognito refresh token.
5. App → `POST /api/mobile/auth/refresh {refreshToken}` re-mints silently before
   the hour-long token expires.

> The Cognito app client must list `https://gwave.cc/auth/callback` as an allowed
> callback URL — it already does, because the web app uses the same one.

This is the **foundation** of the full native rewrite: the design system, auth,
app shell and the core screens are here and wired to the live backend. Feature
parity with the web app grows on top of it.

## What's implemented

| Area | Native | Notes |
| --- | --- | --- |
| Auth (Cognito Hosted UI) | ✅ | WebView OAuth via `/api/mobile/auth/*`, minted Supabase bearer in the keystore, silent refresh |
| App shell (5 tabs) | ✅ | Feed · Reels · Live · Shop · Me (Chat + Notifications on the Feed app bar) |
| Feed | ✅ | Stories rail, infinite scroll, composer (text + **photo upload** + location), inline post images, **real like** + **comments sheet** |
| Media upload | ✅ | Pick from gallery → `/api/mobile/upload` (bearer-auth proxy → `media` bucket) → attached as `post_media` |
| Stories | ✅ | Rail grouped by author + full-screen viewer; **"your story" create** (photo/video upload + text) |
| Reels | ✅ | Vertical TikTok feed, autoplay/loop, **real like**, and **create reel** (video upload + caption) |
| Notifications | ✅ | List from `notifications` (actor + typed message), marks read on open |
| Live list | ✅ | Live now + Recent broadcasting, from `live_streams` |
| Live watch | ✅ | One-screen TikTok layout, HLS playback (IVS live + replays), overlay chat + action rail |
| Go Live (broadcast) | ↗︎ web | WebRTC publish has no native Flutter SDK yet — opens the working web publisher |
| Shop | ✅ | Product grid from `shop_products`, opens affiliate links |
| Messenger | ✅ | Conversation list + chat (send/receive) |
| Farm | ✅ | Native dashboard: devices + latest sensor metrics (`devices` + `sensor_readings`) |
| CCTV | ✅ | Native camera grid + full-screen HLS live viewer (`user_cameras`) |
| Profile | ✅ | Cover/avatar/bio + native Farm/CCTV + web hub links (Learn/Tools/Membership/etc.) |

Screens marked "↗︎ web" hand off to gwave.cc via `url_launcher` where a native
implementation needs an SDK we don't have yet (WebRTC broadcast). These are the
first follow-ups for full parity.

## Configuration

The data-plane URL and anon key are the **public** values the web app ships to
the browser (`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`). They
are injected at build time — never hard-coded — so the same source builds
against any environment:

```bash
flutter run \
  --dart-define=API_BASE=https://gwave.cc \
  --dart-define=SUPABASE_URL=https://<ref>.supabase.co \
  --dart-define=SUPABASE_ANON_KEY=<anon key>
```

| Define | Meaning | Default |
| --- | --- | --- |
| `API_BASE` | Next.js app origin (auth API + web hand-offs) | `https://gwave.cc` |
| `SUPABASE_URL` | PostgREST/Realtime gateway base | _(required)_ |
| `SUPABASE_ANON_KEY` | Public anon key (`apikey` header) | _(required)_ |
| `IVS_RECORDING_BASE` | Base URL for IVS recording HLS replays | _(optional)_ |

## Build locally

```bash
cd mobile
flutter create --org ai.gwave --project-name gwave --platforms=android .   # scaffold android/ (once)
flutter pub get
flutter build apk --release --dart-define=SUPABASE_URL=... --dart-define=SUPABASE_ANON_KEY=...
# → build/app/outputs/flutter-apk/app-release.apk
```

## Build in CI

`.github/workflows/build-flutter-apk.yml` scaffolds the Android project,
builds the APK and uploads it as an artifact. Set these in the repo:

- **Secrets:** `MOBILE_SUPABASE_URL`, `MOBILE_SUPABASE_ANON_KEY`
- **Variables (optional):** `MOBILE_API_BASE`, `MOBILE_IVS_RECORDING_BASE`

Run it from **Actions → Build Flutter APK → Run workflow**. For a Play Store
release, add a signing keystore step (upload key) before `flutter build`.

## Architecture

```
lib/
  core/        config · theme (Green Wave design system) · session (keystore)
               api_client (auth + PostgREST) · repository (typed queries) · models
  features/    auth · shell · feed · live · shop · messenger · profile
  widgets/     avatar, pills, empty states, splash
```

The backend contract (mobile auth API) lives in the web repo at
`src/app/api/mobile/auth/{start,exchange,refresh}/route.ts`.
