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
- **Calls**: WORKING app↔app and app↔browser (user-confirmed 2026-07-29).
  TURN relay (coturn on the EC2 host, 18.139.214.180:3478) is live;
  `/api/webrtc/ice` serves it; SG ports open (3478 udp+tcp, relay
  49160-49200 udp). ALL signaling is relayed server-side — the app posts to
  `/api/mobile/call/signal`, the web posts through the `relayCallSignal`
  server action — because the self-hosted Realtime silently drops client
  websocket sends. **A relayed broadcast arrives WRAPPED** as
  `{event, payload, type}` while a client-socket one arrives bare; the app's
  `_sigBody()` unwraps it. Reading the envelope as the payload was what left
  every call at "Connecting" for days — `sdp`/`candidate` came back null and
  only `accept` (the one data-free signal) appeared to work. App:
  ringtone/ringback + vibration, speaker toggle with a volume slider
  (speaker 0.65 / earpiece 1.0 — raw speakerphone was painfully loud),
  20-min Realtime auth refresh, ring-socket auto-reconnect + resume rejoin,
  web-push callee notify (`/api/mobile/call/notify`), ICE diagnostics posted
  to `/api/mobile/diag`.
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

- **Shop**: a full sale system on both surfaces. App: Sell screen (up to 10
  photos, camera or gallery multi-select), My listings (hide/relist/delete),
  My sales (the seller's order queue — buyer name, tap-to-dial phone,
  address, one-tap status advance), buyer order history, checkout prefilled
  from the last order. Product pages swipe a gallery; `shop_products.images
  text[]` is APPLIED on RDS (constraint fixed in #398 — a CHECK cannot
  contain a subquery; rewritten with array operators, validated on scratch
  pg16). A photo uploaded from the app is a storage KEY, not a URL —
  anything rendering `image_url` must resolve via `mediaRef()` (web) /
  `resolveMedia()` (app). AliExpress import (admin panel on `/shop`) does
  dropship-by-default with a markup %, or affiliate; an affiliate purchase
  can never finish in-app (we never take the money), which is why "buy"
  used to bounce users to AliExpress. **Needs `ALIEXPRESS_APP_KEY`,
  `ALIEXPRESS_APP_SECRET`, `ALIEXPRESS_TRACKING_ID` in `/etc/gwave-web.env`**
  — until then the import endpoint answers 503.
- **Live sale (Shopee-style)**: host pins own listings to a broadcast
  (`live_products`, RLS enforced) from Go Live's 🏷️ button or the watch
  screen; viewers get a buy card over the video (above chat) and checkout
  opens ON TOP of the stream. Pins refresh on the 3s chat poll. Reads are
  flat queries, never embeds.
- **Feed**: a shared `gwave.cc/shop/<uuid>` link renders as the product card
  (photo, title, price, Buy) with the raw URL stripped — same pattern as
  live links — on web (`FeedProductCard` via `LinkPreview`) and app
  (`_ProductBanner` in post_card). Product-screen share posts the link
  alone; the card is the whole render.
- **Right sidebar (web)**: REAL users now — suggestions from
  `getSuggestions()` with add-friend, contacts = accepted friends sorted
  online-first, green dot = `last_seen_at` within 2 min. The old hardcoded
  "Hydro Growers MM / Aung / Su Su" arrays are gone.
- **Messenger**: group chats (create, add members, leave) via security-definer
  RPCs — `create_group_conversation`, `add_group_members`,
  `leave_group_conversation`.

## Known gaps / next candidates

- ALIEXPRESS_* keys (see Shop above) — the import button is live but 503s.
- Scheduled `{"action":"refresh"}` against `/api/shop/aliexpress` so affiliate
  prices don't drift (a listing once advertised 13 THB for an 89 THB item).
- Re-run db/sql/shop-media.sql on RDS once (constraint only; column +
  backfill already applied — the first run errored on the subquery CHECK).
- LiveKit egress recording envs + IAM access key (see above) so browser
  Go Live sessions get replays like app broadcasts do.
- No FCM device token registered for user `75f0e8b3-…`, so a closed app on
  that account can't be woken by push.
- Native iOS app (Apple Developer Program, $99/yr, user-side).
- Old Vercel project deletion (user-side).

## Debugging notes worth keeping

- Realtime broadcast **envelope asymmetry**: a broadcast sent over a client
  websocket arrives bare; one published through the server relay (Realtime
  HTTP broadcast API) arrives as `{event, payload, type}`. Any new subscriber
  must unwrap. This cost days on calls.
- Whole call handshake in one stream:
  `sudo docker logs --since 30m gwave-web 2>&1 | grep -E "call/signal"`
  (`[call/signal-web]` = browser leg, `[call/signal]` = app leg — the first
  missing event names the broken leg).
- coturn does NOT log allocations at default verbosity, so empty coturn logs
  are NOT evidence that no packets arrived. Trickle-ICE is the real test.
- Caddy routes `/sb/realtime/v1/api/*` to Realtime's HTTP broadcast API
  (tenant realtime-dev, Host-based; backup Caddyfile.bak-before-broadcast-api).
- `docker logs -f` on the shared EC2 SSH session swallows everything typed
  afterwards as stdin. Don't use `-f`; use `--since`.

## Changelog

- 2026-07-30 (night): **Sell-from-phone, live sale, honest feed cards, real
  sidebar.** App (builds 219-220 on mobile-latest): Sell screen with a
  10-photo gallery, My listings, My sales queue with tap-to-dial and
  one-tap status advance, checkout address prefill, product-page gallery
  pager, in-Gwave share (to feed / to chat) added to the share sheet, and a
  Shopee-style live sale (host pins listings, viewers buy over the video).
  Web (PRs #396-#399, all merged + deployed): AliExpress import now
  dropship-by-default with markup % (affiliate stays possible but hands
  off — it must), `images text[]` gallery + `mediaRef()` for storage-key
  covers, shared shop links render as product cards in the feed, and the
  right sidebar shows real suggestions/friends with real presence instead
  of the hardcoded fake names. DB: shop-media.sql applied (column+backfill;
  re-run once for the fixed constraint — first version used a subquery
  CHECK, which Postgres rejects). Build 217 failed on an `await` inside a
  setState closure; 219 fixed it.

- 2026-07-29 (evening): **Calls FIXED, group chat, shop wired end to end.**
  Root cause of calls hanging at "Connecting": the app read the Realtime
  broadcast ENVELOPE as the payload, so `sdp`/`candidate` were null and
  `_from` unreadable — `accept`, the only data-free signal, was the sole leg
  that appeared to work. `_sigBody()` in `mobile/lib/core/call_service.dart`
  unwraps it on both the call channel and the ring inbox. User-confirmed:
  "messenger video call ရပါပြီ". Every earlier suspect (TURN, security
  group, ICE server shape, SDP serialization) was ruled out by evidence;
  the SG UDP ports and ICE flattening shipped anyway as correct hardening.
  Also: call volume slider (speaker 0.65 / earpiece 1.0); messenger GROUP
  chats on app + web (`create_group_conversation` / `add_group_members` /
  `leave_group_conversation`, security definer — applied on RDS); Shop no
  longer a dead link catalogue — dropship checkout, affiliate click
  recording and buyer order history now use the order backend that was
  already built but unused, and affiliate prices render `~ X` with an
  "indicative only" note rather than pretending to be ours. PRs #394/#395:
  AliExpress best-seller import + admin panel on `/shop` (dedupe on
  `source_url` behind a partial unique index, live prices converted via
  `currency_rates`, `refresh` action to re-price). Blocked on the three
  ALIEXPRESS_* env keys.

- 2026-07-29 (later): **Go-live feed post guaranteed + call relay deployed +
  APK 203.** PR #389 (merged, deployed): new `ensureLiveAnnouncement()` —
  service-role, idempotent (public-post dedupe on /live/<id> + converging
  duplicate cleanup for concurrent healers), logs `[live/announce]`; used by
  web goLive, /api/mobile/live/start, AND /api/mobile/live/verify, so a
  live stream whose announcement post never landed self-heals when any app
  (build ≥200) sweeps the live rails. Root cause: both go-live paths
  discarded the PostgREST error object (supabase-js doesn't throw), so
  failed inserts were invisible. PR #388 (merged, deployed): web per-call
  signaling relayed server-side, incl. Codex fix (throwaway-channel
  fallback after teardown). APK build 203 on mobile-latest = full batch
  (main b32015c merged in). Awaiting user retest: app↔browser calls, and
  go-live → feed post visible to other accounts. App (builds ≤202 on mobile-latest): every live surface (stories
  bar, live-now rail, feed live banner) now sweeps stale rows — anything
  "live" ≥4 min gets `/api/mobile/live/verify` (throttled per-stream), which
  ends dead broadcasts AND links their IVS replay, so LIVE cards stop
  lingering after a host drops; feed live posts render only the auto-playing
  video card (raw gwave.cc/live URL + generated "🔴 Live …" line stripped,
  user-written text kept) with pulsing LIVE badge, viewer chip and in-feed
  unmute. Web: same URL/marker strip in post-card (PR #387, merged).
  Calls: PR #388 relays the browser's accept/offer/answer/ICE/hangup through
  the server (`relayCallSignal` → Realtime HTTP broadcast; `_from` echo
  guard; throwaway-channel fallback after teardown) — see In-flight. DB note:
  books-store.sql and the profiles.gender column are now APPLIED on RDS
  (PostgREST restarted). Still open: LIVEKIT_EGRESS_S3_* keys, so browser
  (LiveKit) lives still have no replay.

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

- 2026-07-28 (later): **Audio 2.0 + Books store + background playback.**
  `/api/mobile/audio/publish` (artists publish their own tracks with
  publisher_id so premium sales settle to their wallet; admin publishes
  platform tracks) and `/api/mobile/audio/import-rss` (podcast RSS →
  catalogue, get-or-creates `podcast_shows`, dedupes on audio_url) —
  merged in PR #386 along with `/api/mobile/books/publish` and
  `db/sql/books-store.sql` (books, book_purchases,
  book_progress, atomic `buy_book` G-Pay RPC). Both books-store.sql and
  profiles-gender.sql have since been APPLIED on RDS (2026-07-29). App: pro
  player
  (queue, shuffle, repeat one/all, auto-advance, offline downloads),
  "My device music" local player (mp3/m4a/aac/wav/ogg/flac/opus), Books
  store with G-Pay purchase and an in-app PDF reader (resume, night mode,
  jump-to-page, progress saved to book_progress), and background playback
  via just_audio_background — media notification + lock-screen controls,
  with the APK workflow injecting the foreground-service/MediaButton
  manifest entries and AudioServiceActivity. Cycle tracking is now
  female-only (profiles.gender, collected at sign-up; Settings can set it
  on legacy accounts).
- 2026-07-28 (later): **App batch — knowledge Burmese + inline comments, Menu/
  Profile split, 4-skin theme system.** Strains/Minerals render fully in
  Burmese when selected (term dictionary + generated summaries in
  `mobile/lib/features/knowledge/knowledge_i18n.dart`), detail pages gained
  richer facts (type meaning, potency class, Mohs real-world comparisons,
  terpene explainers) and comments+photos now show INLINE on the page
  (`SubjectCommentsPanel`, sheet still available). Me tab split: ProfileScreen
  = Main Menu launcher (identity card → new `MyProfileScreen` with the FB
  cover/posts profile). New skin-based theme system (`core/skins.dart`,
  docs/THEMES.md): Gwave Green / Sky (Twitter/X, stadium buttons, Dim dark) /
  Liberty (Truth-style violet) / Tactical (military olive, angular, night-ops
  dark) — picked in Settings → Design theme, persisted, light+dark each. Also
  fixed an APK compile break: gold-heatmap cleanup had landed in
  `_SosSheetState.dispose` (wrong class) in map_screen. (mobile branch.)
- 2026-07-28 (later): **Web live fixes (PR #385).** Replay "Source Not
  Supported" root-caused: Docker bakes `NEXT_PUBLIC_IVS_RECORDING_BASE=""`
  when the ARG is unset and `ivsRecordingUrl` used `??`, losing the
  `/recordings` prefix → 404 → dead player; now `||`. Live viewers get a
  tap-to-unmute overlay (muted autoplay read as "no sound"). New `ReplayDeck`
  on the watch page auto-plays the next saved replay in place on end / swipe /
  next, provider-scoped replay bases (LiveKit/Agora each to their own).
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
  the `db/sql/health-state.sql` migration on RDS.
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
