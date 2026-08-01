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
  `/api/live/recordings/sweep` (one-minute cron) links the ones that finalise
  after the host has already tapped End — without it, long broadcasts silently
  never got a replay (four out of ten in production), and
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
- Metaverse infrastructure (user-side, console/CLI — this container cannot
  reach AWS): `db/sql/metaverse.sql` applied to RDS, `MV_TICKET_SECRET` and
  `DATABASE_URL` in Secrets Manager, ECR repo + ECS service, ALB with
  `idle_timeout=300` and stickiness, ACM cert and Route 53 record for
  `mv.gwave.cc`, then `NEXT_PUBLIC_MV_WS_URL` in `/etc/gwave-web.env` and a
  rebuild (it is baked at build time). Commands in
  `server/metaverse/README.md`.

## Changelog

- 2026-08-02 (web): **Metaverse — phase 5, world features.** The city now has
  a clock everyone shares, a minimap, footsteps you can hear coming from the
  left or the right, bloom you can switch off, a live screen, and doors back
  into Gwave. In-world time is derived from the epoch (corrected by the
  server's clock on join) rather than counted locally, so two people standing
  next to each other are never in different halves of the day — two tabs
  opened nine seconds apart read 09:15 and 09:17, and the two minutes are the
  HUD's 4 Hz refresh, not drift. Bloom defaults on but is one click away and
  the choice is remembered; the software-GL test box renders under 1 fps with
  it on and 20 fps with it off, which is the whole reason it must be
  switchable. Footsteps are synthesised (filtered noise + envelope through an
  HRTF panner) rather than downloaded — nobody pays mobile data for four .mp3
  files — and the audio context is not even constructed until you press the
  sound button, because browsers refuse audio without a gesture. The centre
  screen plays the live IVS stream via hls.js, muted (autoplay dies otherwise),
  only while you are within 34 m, and falls back to a drawn placeholder rather
  than a black rectangle when nothing is on air. Signposts for Marketplace /
  Farm / Learn / Live and a notice board showing the five latest public posts
  (`/api/metaverse/board`, flat queries, no PostgREST embeds) link back out to
  the real pages. **Two bugs the typechecker could not see**: `A` and `D` were
  swapped since phase 1 — the strafe vector had the wrong sign, and testing
  only `W` never revealed it; and the notice board was parked directly in
  front of the spawn point with its backing panel in front of its own text, so
  the first thing anyone saw was a black slab covering the city.

- 2026-08-02 (web): **Metaverse — phase 4, RDS persistence.** Sign in, walk
  somewhere, close the tab, come back: you are where you left off. The
  position lives in the task's memory and reaches Postgres only on a 30-second
  sweep of players who actually moved, on disconnect, and on SIGTERM — **two
  writes per player per minute**, verified by counting rows from a trigger
  while a client sent 15Hz updates for 65 seconds (975 updates in, 2 writes
  out). Writing every update would have been 1 500 writes/second at 100
  players, which `db.t4g.micro` will not survive. A saved position is only
  restored when the room matches, or a farm coordinate would drop you inside a
  city wall. Guests are never written to `mv_players` (their id changes every
  session and is not in `profiles`) but their **chat is** logged, since that is
  what moderation actually needs; chat older than 30 days is purged hourly.
  If the database is down the world still opens — nobody is ever denied entry
  over a failed query. New tables in `db/sql/metaverse.sql`
  (`mv_players`, `mv_wallet_nonces`, `mv_plots`, `mv_chat_log`), all sealed:
  RLS enabled with zero policies, since PostgREST never reads them — the
  metaverse server holds its own connection. **User-side**: apply that file to
  RDS and put `DATABASE_URL` in Secrets Manager for the ECS task (the task
  definition already references it; it must never be plain text). Two bugs
  found by testing rather than by typechecking: the pool forced TLS on
  anything that was not literally `localhost`, which breaks a unix-socket or
  `sslmode=`-carrying URL, and each 30-second flush rounded 0.5 minutes up to
  1, so an hour in the world would have been recorded as two.

- 2026-08-02 (web): **Metaverse — phases 0-3.** `gwave.cc/metaverse` is a
  three.js world with a procedural avatar (no GLB download: the first person to
  open it on phone data would have paid for a 2-5 MB model), wall collision that
  resolves x and z separately so you slide along walls instead of sticking,
  a three-minute day/night cycle, desktop and touch controls, and multiplayer
  over a `ws` server in `server/metaverse/` — rooms scoped to maps, 15Hz
  position updates interpolated on the client, chat, emotes, server-side speed
  and bounds validation, 30-second heartbeat and SIGTERM close(1001) so an ECS
  deploy reconnects instead of hanging. **Guests can enter without an account**
  and may name themselves, but every message carries a server-set `authed` flag
  and the client always marks guests, so a guest cannot pass as an account
  holder; a signed-in user's name comes from a 60-second HMAC ticket
  (`/api/metaverse/ws-ticket`) and `setname` is refused outright. Fixed along
  the way: the CSP in `next.config.mjs` did not allow the metaverse origin in
  `connect-src`, so the browser would have refused the WebSocket in production
  — the page would have looked fine and nobody would ever have been in the
  world. **Not deployed**: ECR/ECS/ALB (idle timeout 300s + stickiness), the
  ACM cert for `mv.gwave.cc` and the security groups are console work —
  commands in `server/metaverse/README.md`. Persistence is phase 4.

- 2026-08-01 (app): **One owner of the speaker, and it stops when you leave.**
  Every noisy feature started playing on its own and stopped only when its
  widget was disposed, so a Live kept talking behind anything opened on top of
  it and kept talking after the app was backgrounded — a broadcast playing in
  the user's pocket with nothing on screen to stop it. Audio focus cannot
  express the rule we want, because the rule is a product one: *one feature
  owns the speaker at a time, and it stops the moment its screen stops being
  what you are looking at.* `core/video_audio.dart` now holds that ownership
  explicitly (`GwSound` + `SoundClaim`), with three priorities — background
  listening (the audio player), media (live, reels, feed video, CCTV, chat
  clips, lesson speech) and conversation (calls, PTT), which nothing may
  interrupt. A claim is dropped by all four things that end it: someone else
  claiming, a screen pushed on top (`gwRouteObserver` + the `SoundScreen`
  mixin), a bottom-nav tab switch (`silenceMedia()`, which routes never see),
  and the app going to the background. Music and calls are the only two that
  survive backgrounding, because that is what they are for. Live also claims on
  play — it never did, so a podcast played *underneath* a broadcast — and
  browser (LiveKit) lives disable the remote audio publication rather than only
  pausing a controller they don't have.

- 2026-07-31 (web): **The live worked; the post announcing it didn't.** Moving
  the status update ahead of the provider call fixed "nobody can see the
  broadcast" and left the feed announcement stranded behind the same abort —
  so the broadcast appeared and the post pointing at it never did, and hosts
  couldn't find their own live afterwards. Everything a person sees (live,
  in the feed, followers notified) now happens before any AWS call; the
  replay/restream work is last and may be cut short without costing anything
  visible.

- 2026-07-31 (web): **Nineteen minutes of broadcasting that nobody could see.**
  `goLive` marked the row `live` *last*, after awaiting the provider's
  recording/restream call. The host component fires that action without
  awaiting it (`void goLive(id)`), so a re-render or navigation aborts the
  request and Next tears the action down where it stands —
  `TypeError: Invalid state: Controller is already closed`. A host published to
  their IVS stage for 19 minutes (AWS: `published: true` for the whole session)
  while the row sat at `idle` and every viewer saw nothing. It had worked an
  hour earlier only because the composition ARNs weren't configured yet, so the
  AWS call returned instantly and beat the abort. Being live is not a side
  effect of recording: the status is now written first, on its own, and the
  provider work is a second update that may or may not survive. The sweeper
  also starts compositions for live stages missing one, so a torn-down action
  heals within a minute.

- 2026-07-31 (web): **A week-old broadcast pinned to the top of Live now.**
  `listStreams()` applies a 12-hour staleness cutoff — and then `/live`
  re-split the combined result on `status === "live"` alone, which put every
  stale row straight back where the cutoff had removed it. A broadcast from
  Jul 24 sat under a pulsing LIVE badge with a viewer count, playing nothing,
  and was filtered *out* of Recent broadcasts — visible only in the one place
  where it was a lie. The rule is now one exported `isBroadcastingNow()` used
  by both halves. The sweeper also ends stale rows outright (`ended_at` = the
  row's own `started_at`, not the moment a cron noticed), which corrects the
  Flutter app too — it read the same ghost, and data is the only thing that
  fixes a shipped APK without shipping another.

- 2026-07-31 (web): **Browser broadcasts were unwatchable on phones.** Browser
  Go Live creates an IVS Real-Time *stage*, and a stage is a WebRTC SFU: only
  an IVS Real-Time SDK can subscribe to one, which the Flutter app has none of
  and cannot get. So the app listed the broadcast, showed its LIVE badge and
  its viewer count, and rendered a grey placeholder where the video should be.
  Every stage broadcast now also gets a Low-Latency channel, and the
  composition restreams the mixed stage into it — so the same HLS URL the app,
  the web player, the feed card and the live rail already play works for
  browser broadcasts too. The composition also runs when the host turns Record
  *off*: it is how the broadcast reaches an HLS URL, not only how a replay gets
  written, and "don't record me" must not mean "hide me from every phone".

- 2026-07-31 (web): **Replays that finalised too late to be caught.** IVS
  finishes writing a recording to S3 *after* the broadcast stops, and how long
  depends on the length of the stream, but the end routes looked the file up
  the instant the host tapped End and never looked again. Short broadcasts got
  a replay, long ones silently never did — six of the last ten, all with
  recording on and all genuinely recorded; the files were in the bucket, only
  the row was missing a path. `/api/live/recordings/sweep` now re-checks ended
  broadcasts on a one-minute cron until the file appears or a day has passed
  (`?hours=` up to 720 for a one-off catch-up over history). Idempotent, and
  harmless alongside the EventBridge webhook that is meant to do this — a row
  that already has a path is never selected. Uses `LIVE_SWEEP_SECRET`, falling
  back to `RIDE_DISPATCH_SECRET`, so it needs no new env.
- 2026-07-31 (app): **Music keeps playing when you leave the player.** The
  `AudioPlayer` lived in `AudioTrackScreen`'s state — and a second one in
  `LocalMusicScreen` — and both `dispose()`d it, so backing out of the player
  stopped the song, and device music and catalogue music could play over each
  other. Both now run on one process-wide `GwAudio` (`mobile/lib/features/
  audio/audio_service.dart`); playback ends only on the explicit ✕, and a mini
  player above the bottom nav keeps whatever is playing reachable from every
  tab. Queue, shuffle, repeat, speed, sleep timer and position-saving all moved
  onto the service, so they survive the screen too. Silent video no longer
  stops it either: `video_player` requested audio focus even for a muted
  autoplaying feed clip, so a video nobody could hear paused the music —
  previews now use `mixWithOthers` (`mobile/lib/core/video_audio.dart`) and
  only an *unmuted* video takes the sound. The bar itself is gone: what is
  playing is now a **draggable floating bubble** that costs no layout, opens
  into transport controls on a tap and closes itself again, and is stopped by
  dragging it onto a ✕ — hidden over Reels, where even a bubble is chrome.
- 2026-07-31 (app): **Driver Mode stayed online only while its screen was
  open.** The ride heartbeat was a screen-local position stream: a distance
  filter meant a parked driver stopped beating, and `dispose()` meant a driver
  who tapped Back stopped beating. Either way the sweeper marked them offline
  within 3 minutes while the switch still read "online", and no ride offer was
  ever created. Now a process-wide `DriverPresence` with a 30s keepalive,
  stopped only by the switch.
- 2026-07-31 (app + web): **Ride: destination search and driver settlement.**
  Typing a destination now searches the rider's **own past destinations first**
  — most trips are somewhere they have already been, no geocoder answers a
  label somebody wrote for themselves, and every geocoder mangles Myanmar
  addresses, so history is both the cheapest source and the best one. Opening
  the screen shows recents. A geocoder (`RIDE_GEOCODER_URL`, Photon or
  Nominatim, told apart by response shape) or Google Places is appended when
  configured, skipped below 3 characters; with neither, history-only search
  still works and the map is still tappable. Drivers can now pay down the
  commission owed on cash trips from their G-Pay wallet — `ride_driver_settle`
  had existed and been tested since the schema, but nothing called it, so the
  ledger was right and the money was not moving.

- 2026-07-31 (app + web): **In-trip safety — SOS and "share my trip".**
  Both sides of a ride get an SOS button that raises the *existing* Gwave SOS
  (same table, same map board, same responders) with the trip attached: plate,
  vehicle, driver name, destination. A "help me" with no vehicle in it is the
  version nobody can act on. There is also a pre-filled — never auto-dialled —
  police number, because a pocket tap must not call the police. **Share my
  trip** mints an unguessable token and a public `/ride/track/<token>` page, so
  the person a rider sends it to at 11pm needs no Gwave account. That page
  shows the vehicle, plate, driver's first name and live position and
  deliberately withholds the rider's identity, both phone numbers, the fare and
  the payment method — the plate is in because it is what you read out to the
  police; the rest is not the business of whoever the link gets forwarded to.
  Position publishing stops when the trip ends, the link answers for 30 more
  minutes (so a late follower reads "Arrived safely", not a 404) and the page
  is `noindex`. Only the rider can mint the link — a driver who could publish
  their passenger's live position would have a stalking tool.

- 2026-07-31 (app): **Driver Mode.** Apply to drive (three documents,
  resubmittable after a rejection), go online, take offers with a countdown,
  run the trip with one button at a time, see today's earnings and what is
  owed. Not a second APK — a mode behind an approved `ride_driver_profiles`
  row, which costs no second signing key, release channel or pipeline.
  **Location is a foreground service with a persistent notification, NOT
  `ACCESS_BACKGROUND_LOCATION`**: background location triggers Play Store's
  prominent-disclosure review, the most common reason ride apps get pulled, and
  offers reach a sleeping screen over FCM anyway. The heartbeat is
  distance-filtered rather than timed — a driver parked at a rank does not need
  to resend the same coordinates, and battery is what ends a shift early.
  Commission owed is shown even at zero, because a driver who only finds out
  when offers stop assumes the app is broken. Navigation hands off to the maps
  app the driver already uses.

- 2026-07-31 (app): **Ride hailing, passenger side.** One screen, a full-bleed
  map, and a bottom sheet whose contents follow the trip's state — not a page
  per step, because pushing a route for "choose vehicle" and another for
  "searching" rebuilds the map each time and throws the camera away, so the
  pickup pin jumps around underneath the rider while they are confirming where
  it is. The screen mirrors the server's state machine rather than keeping one
  of its own, so the UI cannot reach a state the database disagrees with.
  While a ride is live it polls `/api/ride/{id}` every 3s — that poll is also
  the dispatcher's clock server-side — and subscribes to `ride:{rideId}` for
  the driver's position between polls, so the car glides instead of jumping.
  A trip survives the app being killed: `/api/ride/active` on open rejoins it,
  without which a rider reopens Gwave to a fresh booking screen while a driver
  is on the way to them. Surge is labelled on the vehicle row rather than
  folded into the number, and a failed wallet charge is shown on the receipt
  instead of becoming a silent support ticket. Reached from Menu → Places &
  Safety → Ride. **Needs `db/sql/ride-hailing.sql` + the `feat/ride-hailing`
  server branch merged before it does anything.**

- 2026-07-31 (app, v1.0.236): **The post "…" button now actually does
  something.** It was a `const Icon` — no handler at all — so the app had never
  had a way to edit or delete a post; the menu simply did not exist. It is now
  an `IconButton` opening a bottom sheet: edit / delete / copy / share for the
  author, copy / share / report for everyone else. `PostCard` keeps its own
  `_content` and `_deleted` state so an edit shows immediately and a deleted
  card disappears without a refetch (optimistic, rolled back if the write
  fails), and `onChanged` re-loads feed / profile / groups. The three new
  repository writes (`editPost`, `deletePost`, `reportPost`) filter on
  `author_id` as well as `id` — a PATCH or DELETE that matches nothing returns
  success, so the id alone would make a failed edit look like it worked.

- 2026-07-31 (app, v1.0.235): **Calls stop logging themselves two or three
  times, and the permission prompt is no longer a dead end.** The `decline` and
  `hangup` signal handlers were missing the `_ownSignal` guard every other
  handler has, so the server's relay echo re-entered `_teardown` and wrote a
  second call log; `_teardown` also awaits before writing, so two overlapping
  runs both read a live `_conversationId`. Fixed with the echo guard plus a
  `_tearingDown` re-entry lock and a `_lastLoggedCallId` check. Separately, a
  permanently-denied camera/mic permission failed silently — `_grantPermissions`
  now records `permissionPermanentlyDenied` and both the chat screen and the
  call screen offer a **Settings** action that opens the OS app settings, since
  Android will not show the system prompt again.

- 2026-07-31: **Dropship listings carry the whole product, and a kit for
  selling it.** The AliExpress import was pulling one photo out of a feed that
  publishes six plus a video, a store name and a satisfaction score — so a
  reseller had nothing to show a customer. `PRODUCT_FIELDS` now asks for all of
  it, `merchantDetail()` writes it on **both** import and refresh (the first
  cut only set it on import, so a refreshed listing silently reverted to one
  photo), and `shop_product_detail.sql` adds specs/variants/rating/orders/
  store/video/shipping columns with the images cap raised 10 → 24. The product
  page gets a real gallery — swipe, arrows, counter, full-screen viewer, video
  first when there is one — plus a specs table and the merchant's own numbers
  shown as *theirs*, separate from Gwave's review section. The piece that
  matters commercially is the seller-only **customer pack**: a ready-made sales
  message, a share-sheet button, and a save-every-photo button that fetches
  blobs (a cross-origin `download` attribute is ignored, which is why the
  obvious version opens tabs and saves nothing). Merchant list price is
  deliberately NOT copied into `original_price` — our price is theirs plus a
  markup, so showing their "was" beside our "now" would advertise a discount
  that does not exist. **`db/sql/shop-product-detail.sql` must be run on RDS +
  `sudo docker restart postgrest`**, and the import still needs
  `ALIEXPRESS_APP_KEY` / `_APP_SECRET` / `_TRACKING_ID` in `/etc/gwave-web.env`.

- 2026-07-30 (night, 2): **AWS cost board now shows real usage, not the
  credit-masked number.** Grouping Cost Explorer by SERVICE without a
  RECORD_TYPE filter nets credits into each service, and on this account that
  made EC2 read $0.01 against **$149 of actual usage** — the whole bill showed
  $52 when real consumption was **$228.50/month against $180/month of credits**.
  A dashboard that hides that is worse than none, because the day the credits
  run out the invoice jumps 4.5x with no warning. The service table and the
  daily trend are now filtered to `RECORD_TYPE=Usage`, a fourth query pulls the
  credit/tax/refund split, and the page leads with real usage, shows the
  invoice figure beside it, and carries a warning panel naming the gap. Refresh
  is now four billed requests (≈$0.04).

- 2026-07-30 (night): **Admin storage + AWS cost dashboards.** /admin/storage
  answers "how much data does the system hold, and where" — `admin_storage_tables()`
  / `admin_storage_summary()` (SECURITY DEFINER, EXECUTE granted only to
  service_role) give per-table size split into data/index/TOAST plus row
  estimates, because PostgREST serves rows not catalogue views; S3 bucket size
  and object count come from the CloudWatch daily metrics rather than listing
  objects, which on the media bucket would be hundreds of thousands of API
  calls per page load. /admin/aws answers "what is AWS charging for, and why" —
  Cost Explorer month-to-date by service with last-month comparison, a 30-day
  daily bar trend, AWS's own month forecast, and for each service a written
  note saying what Gwave runs on it, what the meter counts, and the one lever
  that would reduce it. Cost Explorer bills $0.01 per request, so the report is
  cached six hours in-process and refreshing is an explicit button that says
  what it costs. Missing IAM permission renders as the exact policy to add, not
  a 500. **`db/sql/admin-storage.sql` must be run on RDS + `sudo docker restart
  postgrest`**, and the EC2 instance role needs `ce:GetCostAndUsage`,
  `ce:GetCostForecast` and `cloudwatch:GetMetricData`.

- 2026-07-30 (evening): **Community mine-site map.** /minerals/mines —
  `mine_sites` + `mine_site_reports`, RLS-sealed behind /api/mine/sites, so
  the metal board's "what is tin worth" now has a "where is it dug" companion.
  Reads are public; any signed-in user adds or corrects a pin; anyone reports
  (unique per reporter, count recomputed not incremented); admin deletes at
  /admin/mines. A pin is only accepted complete — mineral, name, state/region,
  township, exact coordinates and ≥1 photo — enforced in zod AND CHECK
  constraints. 16 minerals (tin, antimony, rare earth, tungsten, jade, ruby,
  …) each with their own pin colour and emoji so a region reads at a glance;
  Leaflet map, standard SearchBar over name/township/region/operator/tags,
  scale + status + operator + access + hazard fields, trilingual (my/en/th)
  with a language button, user guide and an explicit "user-submitted, not an
  official record; mining without a licence is illegal" banner. Access and
  hazard notes are labelled user-reported — a mine map that pretended to know
  a road was safe would get someone hurt. **`db/sql/mine-sites.sql` must be run
  on RDS + `sudo docker restart postgrest`.**
- 2026-07-30 (afternoon): **Community cannabis map, standard search bar +
  keyword analytics, WiGLE-depth WiFi dashboard.** /strains/places (PR #414,
  deploy #169): cannabis_places + cannabis_place_reports, RLS-sealed, any adult
  adds/corrects, anyone reports (unique per reporter, count recomputed not
  incremented), admin deletes; a listing is only accepted complete — name,
  address, phone, coordinates, ≥1 photo — enforced in zod AND CHECK
  constraints; Leaflet map with emoji pins, detail card, multi-photo upload,
  GPS + tap-the-map picker, trilingual; /admin/places moderation queue.
  components/ui/search-bar.tsx is now the one search-box shape (magnifier,
  clear ✕, consistent height), adopted by the navbar, /strains and /minerals;
  search_queries logs keyword + user + source + result count and /admin/search
  charts it, giving zero-result keywords equal billing since that list is the
  content users wanted and we don't have (PR #415, deploy #170). /admin/wifi
  gained WiGLE depth (PR #416, deploy #171): frequency/channel/band/
  capabilities on networks and scans plus user_agent/platform/os/app_build on
  the scan; lib/oui.ts derives vendor from OUI, exact encryption family from
  the capability string, WPS, and browser/OS from the UA; charts for
  encryption, band, channel congestion, vendor, browser, OS and app version;
  full searchable AP table. Scam-compound work is deliberately split: dense
  AP clusters are surfaced as LEADS with an explicit not-evidence banner (a
  hotel or campus looks identical from a scan), and the only thing recorded is
  a human admin flag in wifi_watchlist with risk, category, note and author.
  App (APK 229-230): Strains opens the places map; the WiFi scan sends
  frequency, raw capabilities and its platform/OS/build. Three SQL files
  applied on RDS by the user.

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
