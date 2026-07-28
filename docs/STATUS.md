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

- LiveKit egress recording envs + IAM access key (see above) so browser
  Go Live sessions get replays like app broadcasts do.
- Native iOS app (Apple Developer Program, $99/yr, user-side).
- Old Vercel project deletion (user-side).

## In-flight (2026-07-28, final) — call-ring: relay live, awaiting user test

INFRA (on the EC2 box, 2026-07-28): /etc/caddy/Caddyfile gained a
`handle /sb/realtime/v1/api/*` block (strip_prefix + proxy to 127.0.0.1:4000
with Host realtime-dev.gwave.cc) BEFORE the websocket handler — the websocket
handler rewrites /sb/realtime/v1 -> /socket, which had been swallowing the
relay's POST /api/broadcast. Verified: POST gwave.cc/sb/realtime/v1/api/broadcast
now returns 202 from Realtime (tenant realtime-dev; resolution is Host-based,
so direct 127.0.0.1:4000 calls need that Host header). Backup:
Caddyfile.bak-before-broadcast-api.


PR #381 MERGED (server-side ring relay via the Realtime HTTP broadcast API +
FCM/notify logging) — main auto-deploy runs it; APK build 176 on mobile-latest
carries the app-side callId. VERIFIED earlier today: server FCM send → live
token = HTTP 200; APK 173+ bakes the com.green.gwave google-services config
(build log confirmed) with POST_NOTIFICATIONS in the manifest; realtime +
postgrest containers healthy. Remaining test (user): browser tab signed in as
the callee, call from APK v1.0.176 — the tab should ring. If anything still
fails, `sudo docker logs gwave-web | grep -E 'call/notify|realtime|fcm'` now
shows exactly which leg broke (notify hit, relay HTTP status, FCM sends —
watch for `[realtime] server broadcast ... -> 404`, which means the
`/realtime/v1/api/broadcast` proxy path needs a Caddy mapping on the box).
Also still unverified: does web→web ring today? If not, inspect the web
ring-inbox subscribe (gw_at at join time). When the test passes: delete this
section and move the outcome to the changelog.

## Changelog

- 2026-07-28 (night): **Calls no longer depend on the phone's realtime socket,
  plus a feature batch.** Server (PRs #381/#382/#383, all deployed): both call
  paths (app + web caller) FCM-push the full ring payload AND relay the
  realtime ring server-side via the Realtime HTTP broadcast API (Caddy on EC2
  gained the /sb/realtime/v1/api/* route; tenant=realtime-dev, Host-based);
  45s TTL on ring pushes; one shared in-flight FCM OAuth mint; go-live now
  FCM-pushes followers' phones; new log-only /api/mobile/diag. App (builds
  ≤181 on mobile-latest): rings the incoming-call UI straight from the FCM
  push + force-rebuilds the socket for signaling; call-notify waits for the
  signaling channel join (accept race); runtime-config retry (fallback URL
  can no longer strand the data plane — footer shows 'ready·cfg!' if it
  does); diag beacon (~100s) posts build/ring/config/heartbeat-error to the
  server logs; drone radar survives Bluetooth-off (Wi-Fi leg independent,
  amber banner + system turn-on dialog, BLE self-heals); NFC read/write/
  erase/lock tool in the Tools hub; feed's story+live rails merged into one
  compact strip; TikTok pager auto-advances when a replay ends. Debugging
  note: `docker logs gwave-web | grep -E 'diag|call/notify|realtime|fcm'`
  now shows the phone's internals — no more screenshot round-trips.

- 2026-07-28: **FCM push is LIVE end-to-end (closed-app call ring).** Native
  app package switched to `com.green.gwave` (the app actually registered in
  Firebase project `gen-lang-client-0745825519`; pre-launch so no user
  reinstall pain) — workflow scaffolds with `--org com.green`, and
  `mobile/google-services.json` is committed (a `GOOGLE_SERVICES_JSON_BASE64`
  secret still wins if set). Server send key `FCM_SERVICE_ACCOUNT_JSON` is set
  in `/etc/gwave-web.env` and verified inside the container (valid JSON, right
  project). First com.green.gwave APK = build 173. NOTE: new applicationId ⇒
  installs as a NEW app; old ai.gwave.app installs must be removed manually
  and get no update banner. The TWA (`build-apk.yml`, ai.gwave.app) is a
  separate package, untouched. See docs/FCM_SETUP.md. (mobile branch.)
- 2026-07-24: **Call reliability — re-ring + caller identity.** The outgoing
  call now re-broadcasts the `ring` to `calls:{callee}` every 3s for the 45s
  window (Realtime broadcast is ephemeral, so a single ring missed a callee
  whose socket was mid-reconnect or who opened the app a beat late → caller
  stuck on "Ringing…"). The callee's `inCall` guard drops duplicate rings, so
  re-rings are idempotent. The ring payload now carries the caller's
  profile (name/avatar) so the incoming screen shows who's calling. Note: a
  fully-closed callee app still needs FCM (documented gap). (mobile branch.)
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
