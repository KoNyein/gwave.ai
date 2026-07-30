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

- 2026-07-30 (midday): **Admin data dashboards + Thailand cannabis market +
  Thai language.** New wifi_scans table (RLS-sealed, zero policies) logs one
  row per AP per scan with user, GPS fix and RSSI, written by
  /api/mobile/wifi/observe best-effort; /admin/wifi reads it through the
  service role for a coverage map (dot colour = signal, red ring = open
  network), scan-activity + security + signal-band bar charts and a per-user
  contribution table; /admin/data charts the whole system (module totals,
  per-table with 7-day growth, log-scale toggle) off getModuleMetrics
  (PR #411, deploy #167). /strains/market gains Thailand first: SET-listed
  cannabis/hemp equities in THB via Yahoo .BK, a hand-recorded Thai price log
  (cannabis_quotes + /api/cannabis/quotes, admin-gated writes) with quick-picks
  for grades and provinces, and a specific Thai legal-compliance panel — FDA
  cultivation registration, DTAM sale licence, the 0.2 % THC extract line,
  under-20/pregnancy sale ban, advertising prohibition, 2025 prescription
  rules — plus a third language, Thai (PR #412, deploy #168). App (APK 226-228):
  shared signal_meter widgets put signal strength on every scan screen (WiFi
  map live panel with bars/band/security/dBm/%, Bluetooth finder rows), Strains
  opens the market board, and GwLang gains th with tr3() so Thai falls back to
  English where untranslated. Both SQL files applied on RDS by the user.

- 2026-07-30 (late morning): **Market log split + border gates + cannabis
  market board.** metals.dev free tier confirmed to carry no tin/rhodium
  (key list checked on prod), so per the user's decision the market log now
  has a hand-recorded world-price section (e.g. tin LME) on top and Myanmar
  border/local prices below; a local quote with no live row compares
  against the logged world entry (PR #406). Border-gate quick-picks north
  to south — Tachileik, Maese, Gate 13/14 (Kayah), Myawaddy, Mae Tha Waw,
  Mae Tha Lay, Htee Khee, Nat Ein Taung, Kawthaung — each gate its own row,
  with a note that prices differ per gate (PRs #407-408, deploys 164-165).
  New /strains/market (PR #409, deploy #166): cannabis/hemp/CBD equity
  board (ETFs, Canadian producers, US MSOs, CBD companies via Yahoo)
  behind requireAdult 18+, with educational-only + illegal-in-Myanmar
  disclaimer and my/en toggle; app Strains screen opens it via the
  signed-in webview (APK 226, which also carries the main merge f109d07).

- 2026-07-30 (mid-morning): **Metal board v3, drone radar v2, map travel
  tools.** Web (PR #404, deploy #162): tap-to-expand metal rows (1-mo
  chart, high/low/avg, kyattha/gram/kg/tonne conversion cards, per-metal
  background), Myanmar minerals guide (regions + legal status + world-price
  link; uranium listed as education-only with a legal warning and
  deliberately no price), my/en toggle flipping every board string
  (metal-data.ts, compile-checked key parity), help accordion. App (APK
  224): drone radar detail sheet with RSSI history graph, quality meter,
  chips, first-seen/tracked-for, Copy GPS/Show-on-map; 9-section bilingual
  user guide; app-bar language button flips the whole app via GwLang. App
  (APK 225): map travel tools — long-press waypoints (fuel/camp/mine emoji
  pins, on-device store), trip recorder (distance/duration/speed, live
  chip) with animated replay ("travel video"), GPX export and stats share,
  in-app OSRM routing with nav HUD (straight-line fallback offline),
  share-my-location one-off, 8-section bilingual map guide
  (trip_tools.dart).

- 2026-07-30 (morning): **Market log v2 — tin border prices, Kachin rare
  earths, world-price reference** (PR #402, deploy #161). Quick-pick chips
  for metals (antimony, tin ခဲမဖြူ, rare-earth Dy/Tb, zinc, lead, nickel,
  copper) and markets (Muse, Kachin Pangwa border, Tachileik, Myawaddy,
  Yangon). Each hand-recorded quote shows the matching LME/COMEX price
  beneath it (Burmese-name match, longest-first so ခဲမဖြူ→tin beats ခဲ→lead).
  /api/metals: metals.dev key candidates per row — free tier serves plain
  `tin`, not `lme_tin`, which is why tin was missing from prod (key-check
  showed only lme_nickel/zinc/lead; rhodium absent may be plan-limited).
  Rare earths have no public feed (SMM licensed) — the log is the only
  honest source, so no reference line is shown for them.

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
