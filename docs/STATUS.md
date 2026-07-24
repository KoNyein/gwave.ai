# Gwave — live system status

> Every Claude session: read this before working, update it after shipping.
> Keep entries short; newest changelog entries on top.

## Current state (2026-07-23)

- **Web**: main auto-deploys to gwave.cc (ECR image + `gwave-redeploy` on EC2).
  vercel.app hosts 308-redirect to gwave.cc; the old Vercel project should be
  deleted by the owner.
- **APK**: signed builds publish to the `mobile-latest` release on every push
  to `mobile/**` (main or claude/**). Settings footer shows the build number
  and call-socket status ("Gwave v1.0.N · calls: ready"). In-app update
  banner works from v1.0.99 onward. `profiles.app_build` heartbeat column
  reports each user's installed build.
- **Calls**: TURN relay (coturn on the EC2 host, 18.139.214.180:3478) is live;
  `/api/webrtc/ice` serves it; SG ports open. App: ringtone/ringback +
  vibration, speaker toggle, 20-min Realtime auth refresh, ring-socket
  auto-reconnect + resume rejoin, web-push callee notify
  (`/api/mobile/call/notify`). Web ring verification is embed-free.
- **Live**: browser→LiveKit, app-broadcast→IVS. IVS auto-records to S3;
  `latestIvsRecordingPath()` links `recording_path` on end/verify, and
  `/recordings/[...path]` streams replays through the domain (app + web).
  Media-plane self-heal on `/api/mobile/live/verify`, `/api/mobile/live/token`
  and the web watch page marks dead lives ended (LiveKit host-absent or IVS
  channel offline, 3-min grace). Feed + live lists autoplay muted previews
  (app: video_player HLS; web: hls.js / Safari native). App live viewing is
  one-page TikTok-style vertical swipe. **LiveKit (browser Go Live) recording
  still NOT configured** — needs static IAM keys for egress
  (`LIVEKIT_EGRESS_S3_*` in `/etc/gwave-web.env`).
- **SOS**: reason/phone/note/photo/video/voice + optional go-live; danger
  banner on the map; tiles dial/view media; SMS+GPS fallback when offline.
  (`sos_alerts` columns applied on RDS.)
- **Offline chat**: nearby_connections P2P (Bluetooth/WiFi, no internet) with
  GPS location sharing; friendly Burmese error guidance when Play Services
  Nearby is unavailable.
- **iPhone**: PWA install guide on /welcome. Native iOS blocked on Apple
  Developer Program enrollment.
- **Presence**: `profiles.last_seen_at` migrated on RDS; green dots live.
- **Repo hygiene**: 100 merged branches + old TWA releases deleted
  (`.github/workflows/cleanup-branches.yml` is a reusable manual cleanup).

## Known gaps / next candidates

- FCM push notifications (calls/messages don't ring when the app is closed;
  web-push covers open-browser cases only). Needs a Firebase project.
- LiveKit egress recording envs + IAM access key (see above) so browser
  Go Live sessions get replays like app broadcasts do.
- Native iOS app (Apple Developer Program, $99/yr, user-side).
- Old Vercel project deletion (user-side).

## Changelog

- 2026-07-24: **Health data now auto-saves & restores across logout/login,
  reinstall, and new phones.** `HealthStore` mirrors the whole module (vitals,
  oximeter/full-scan, cycle, meds, Medical ID, activity journal, report prefs)
  to a per-user JSON snapshot in `public.health_state` (owner-only RLS) — a
  debounced push on every change, and a merge-restore on every sign-in
  (`AppState._afterSignIn`). A different account signing in on a shared device
  clears the previous user's local copy first, so accounts never bleed. Fixes
  the reported bug where health data vanished after logout→re-login. Requires
  the `supabase/sql-editor-bundles/health-state.sql` migration on RDS.
- 2026-07-24: App batch → **Gwave v1.0.142** (`mobile-latest`).
  Standard gestures (full-screen photo viewer pinch-zoom, story drag-to-dismiss),
  Health module (PPG heart-wave, vitals, cycle, meds, Medical ID, doctor PDF
  report — all on-device), dark-mode readability fixes (strains/minerals/offline
  chat), offline maps (disk tile cache + region download), drone-detection radar
  (BLE Remote ID + Wi-Fi heuristic + proximity haptic alarm). Live-list flood
  fix so every user's live shows. Web: admin Users map (#353). Build note: the
  APK workflow runs `flutter analyze` with `|| true`, so compile errors only
  surface at `flutter build` — three slipped through (CupertinoPageTransitions-
  Builder unresolved on Flutter 3.44, LatLngBounds import, TileProvider
  super.headers) and were fixed in builds 141→142.
- 2026-07-24 (later): Media quality upgrade — new `src/lib/hls-quality.ts`
  with two shared hls.js profiles that auto-recover from fatal network/media
  errors (feed/rail/grid previews `attachPreviewHls`, watch/CCTV players
  uncapped high-quality `attachFullHls`), so live previews no longer freeze on
  a hiccup; feed/lightbox photos get async decode + priority hints + full-res
  lightbox (PR #351, merged). App: feed/story/chat photos bumped to
  `FilterQuality.medium` for crisper Retina downscaling (mobile branch).
- 2026-07-23 (later): IVS replays end-to-end (`latestIvsRecordingPath` +
  `/recordings` proxy, PR #339/#340); media-plane live self-heal + web watch
  page reverse check (PR #337/#342); web feed live cards autoplay via hls.js
  incl. replays (PR #343); app: TikTok-style live swipe, feed/live-list muted
  autoplay, double-tap react, SOS details+media+SMS fallback, offline nearby
  chat + friendly errors, profile header redesign, call notify + reconnect
  (builds v1.0.105–120 on `mobile-latest`). `sos_alerts` + `app_build`
  columns applied on RDS.
- 2026-07-24: TURN relay + `/api/webrtc/ice` (PR #336), coturn + SG ports on
  EC2; app v1.0.104: ring sounds, speaker toggle, Realtime auth refresh,
  version footer, live-ended errors. Stale-live self-heal (PR #337).
  CLAUDE.md + this file added.
- 2026-07-23: Green one-story auth screen (v1.0.101); call minimize +
  placeholder-username fix; voice messages, update banner, post sharing
  (v1.0.99); presence (app+web, PR #331); vercel.app redirect (PR #333);
  branch/release cleanup (PR #334); embed-free web ring fix (PR #336);
  presence-setup.sql applied on RDS.
- 2026-07-22: account no-clobber fix (PR #329) after Google-flow back-fill
  destroyed a profile link; project unification — dev==main app (PR #330);
  signed-APK keystore working.
