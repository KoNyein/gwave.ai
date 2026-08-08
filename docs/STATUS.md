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
  is CONFIGURED and verified** (2026-08-06): `LIVEKIT_EGRESS_S3_*` set in
  `/etc/gwave-web.env` (bucket gwave-ivs-recordings, ap-northeast-1) and the
  egress worker container runs on the LiveKit SFU box (52.77.195.25) with
  local redis; `/api/metaverse/lives` self-heals recording_path without the
  SFU webhook. Watch/replay in-metaverse via the 📺 Live & Replays hub.
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

- **Metaverse (`/metaverse`, on main, LIVE)**: Phases 0–19 shipped. 4 maps
  (city/farm/snow/sky), multiplayer WS server (batched fan-out, Redis bus,
  anti-cheat), persistence (`metaverse.sql`, `metaverse-part2.sql`,
  `metaverse-market.sql` — **all APPLIED on RDS**), Web3 SIWE + token-gated
  vip room, weather/water/fire/vehicles, avatar customiser, mini-games
  (server-authoritative, weekly+all-time leaderboard), Android WebView screen
  with JS bridge + AFK battery handling, UGC plot building, spatial voice
  (WebRTC mesh, 18+ ticket claim, mic default off), marketplace (**feature
  hard-off via MV_MARKET_ENABLED pending legal advice** — the tables exist but
  the feature must stay off in production).
  Controls are CS-style: default speed is running, Shift walks, Ctrl crouches,
  V (or the 👁 button) toggles first-person, and clicking in first person takes
  pointer lock. The left HUD is a flow-layout accordion — one panel open at a
  time — so nothing overlaps on short landscape viewports.
- **Open World rooms (`public/world/`)**: Cyber-Yangon, the farm, Mae Sot,
  the Taxi District, the Strike arena and five new city rooms — Myawaddy, Three Pagodas Pass,
  Chiang Mai, Bangkok, Phuket (`world/rooms/CityRooms.js`, driven by a
  `CITY_SPECS` table). Every building is **hollow with a real doorway** and
  every gate is a working border crossing (Myawaddy ↔ Mae Sot, chaining on
  through Three Pagodas, Chiang Mai, Bangkok, Phuket); markets, trade boards,
  POS counters and temples are stations.

  **Collider rules — the expensive lessons, in order:**
  1. One AABB per wall, never one box around a model. A single AABB cannot
     express "hollow with a door".
  2. For a GLB, build the walls from the **model's own triangles**, not its
     bounding box — `world/Occupancy.js` rasterises them into a 0.35 m grid
     and merges each run of occupied cells into one Box3. A bounding-box
     shell put the stilt house's walls 5.9 m outside the real ones, so the
     house was thin air.
  3. The uploaded models ship with their **doors closed**, so there is no gap
     to find. `cutDoorway()` picks the wall that borders interior space,
     clears a 2.4 m opening and our hinged leaf (`world/Door.js`) fills it.
  4. Enterable buildings must be rotated in multiples of 90°. The grid is
     axis-aligned; a house at 69° gets a staircase of boxes and a door that
     misses its own wall.
  5. Colliders must be built **after** the parent group has a transform, or
     `setFromObject` returns boxes at the world origin and nothing blocks.
  6. A raised floor is a **thin platform**, not a solid slab, or the physics
     reads it as a wall (`b.max.y <= pos.y + 0.55` fails).

  `resolveHorizontal` runs **twice** per frame: one pass resolves in array
  order, so being pushed out of box A can leave you inside box B.

  Terrain is noise-generated with an exactly flat play area
  (`world/Terrain.js`) and is **walkable** — physics samples its height as
  ground with a 0.8 m/step slope limit, and the invisible wall sits at the
  terrain rim, so the hills can be climbed (528 m out, 121 m up). Cars are
  drivable (`entities/Vehicle.js`, E to enter/exit) with hinged doors; the
  pickup model faces **−Z**, so it is wrapped in a group turned 180°.
  Ambient sound is synthesised per room (`core/Sfx.js` `ambient()`), no audio
  files anywhere. Quality is auto/high/mid/low (`core/Quality.js`) —
  pixelRatio is the strongest lever, `heavy` meshes hide at mid, `detail` at
  low. The app reaches all of this through the same `/metaverse?room=<id>`
  WebView, so world work needs no APK rebuild.

  ⚠️ **Measuring clipping**: a sweep that counts "avatar centre inside mesh
  triangles" mostly counts *flush contact*, not pass-through — sealing more
  geometry makes the number go **up**. Trust the direct test instead: run at
  each wall at 8 m/s and check you are blocked, then open the door and check
  you get inside.
- **Metaverse/FPV/Assassin server**: the `metaverse` container on the app EC2
  box (127.0.0.1:8090, behind Caddy at `/mv/*`), not ECS. It **deploys
  automatically** now — `.github/workflows/metaverse-server.yml` builds to ECR
  and rolls out over SSM on every push to `main` touching `server/metaverse/**`,
  with a health-gated rollback to the previous image. `workflow_dispatch`
  redeploys without a code change. No hand rebuild over SSH; if you find
  yourself typing `docker build` on the box, something is wrong with the
  workflow and that is the thing to fix. Verify with
  `curl -s https://gwave.cc/mv/health`.
- **Multiplayer transport**: the client connects to
  **`wss://<current-host>/mv/ws`** (same origin) after any
  `NEXT_PUBLIC_MV_WS_URL` override, rotating candidates on each reconnect.
  Caddy on the EC2 box routes `handle_path /mv/*` → `127.0.0.1:8090`
  (the `metaverse` container). **No `mv.gwave.cc` DNS record is needed** —
  that approach was abandoned. `deploy/Caddyfile` documents the route.
- **FPV Simulator (`/fpv`, LIVE)**: three.js flight sim. Three aircraft types
  with separate physics — 8 FPV quads, 2 fixed-wing planes (airspeed² lift,
  stall, ground roll), 2 helicopters (collective, ~half throttle hovers);
  4 flight modes (acro/freestyle/sport/cinematic, betaflight rate curves at a
  240 Hz fixed substep); 6 maps; 6 game modes (free fly, 3-lap race,
  checkpoint rush, balloon hunt, strike mission, landing challenge); keyboard,
  touch dual-stick and Gamepad-API radios (EdgeTX USB/BT HID) with remappable
  axes. Multiplayer reuses the metaverse WS server via `fpv-*` rooms (own
  anti-cheat envelope: 70 m/s, 220 m ceiling, 320 m radius) and falls back to
  solo against an older server. Strike targets are derelict vehicles and
  balloons only — never human figures.
- **Edu Arcade (`/arcade`, LIVE)**: 10 three.js educational games (math,
  counting, odd/even, animals, fruit, flags, colour names, hex colour, word
  builder, memory match) on a shared engine, plus a daily quest panel.
- **Game progress (`game_progress` — APPLIED on RDS)**: `/api/games/progress`
  stores per-game bests and quest counters for signed-in users
  (`best = greatest(old, new)`, jsonb merge, sealed RLS + service_role).
  Clients stay offline-first on localStorage; guests get 401 and keep working.
- **Web3 (code complete, NOT switched on)**: phases W1–W8 of
  `GWAVE_WEB3_SPEC.md` are implemented but dormant — no contracts are
  deployed and no envs are set, so `createWeb3()` reports disabled and the
  ownership chip is the only visible change. Ownership answers come from the
  `web3_nft_owners` / `web3_balances` mirror when the indexer is fresh,
  falling back to RPC (viem `fallback()` over up to four endpoints, behind a
  circuit breaker). The mint queue reaches `confirmed` only after three
  confirmations. The worker (`WEB3_WORKER=1`, one host, postgres advisory
  lock) runs the sender, confirmer and indexer. Key handling is in
  `docs/WEB3_KEYS.md`. `db/sql/web3.sql` is **APPLIED on RDS** (2026-08-02) — the four tables
  exist with RLS sealed and grants to `service_role` only; nothing mints
  until contracts and envs exist.

- **Light meter (app, Farm & Home)**: reads the ambient-light sensor and
  converts to PPFD/DLI for four crops × growth stage. Refuses to show PPFD
  until a lamp type is chosen (the factor varies 2×), infers a saturated
  sensor from a run of bit-identical readings, has a canopy grid map, CSV
  export, calibration against a real meter, and a red night mode. Phones with
  no sensor get the reference pages instead of a dead screen.
- **Storage cleaner (app, Knowledge & Tools)**: storage breakdown, junk rules,
  duplicate photos (size bucket → MD5 prefix), chat-media folders, unused
  apps. No "RAM boost" — the Help tab explains why. Nothing is deleted that
  was not listed and ticked first; `DCIM/Camera` and `Android/obb` are never
  auto-selected.
- **FPV sim + Edu Arcade in the app**: both open through the metaverse WebView
  shell (signed-in cookie, native bridge, immersive, wake-lock), so there is
  still one implementation of each world. Live class, Replays and Help are
  reachable from the menu too — they existed on the web with no way in from
  the app.

## Known gaps / next candidates

- **Web3 go-live is a decision, not a task.** Before anything is minted:
  apply `db/sql/web3.sql`, transfer contract ownership to a Safe, put the
  minter key in Secrets Manager, and settle the plot-grid mismatch below.
- **The plot grid does not fit the world.** `GwaveLand.sol` fixes `GRID = 32`
  (1,024 plots, 512 m across) but the largest map has `worldRadius = 100`.
  904 plots sit outside the playable world; the metadata generator marks them
  `Status: Reserved`. Either widen the maps or sell only the in-bounds plots.

- FCM push notifications (calls/messages don't ring when the app is closed;
  web-push covers open-browser cases only). Needs a Firebase project.
- Native iOS app (Apple Developer Program, $99/yr, user-side).
- Old Vercel project deletion (user-side).
- **Old AWS IAM access key `AKIASGIRQUTJXBPGOZ6U` is still active** and must
  be deleted (user-side). The replacement key is live and in use; only the
  account owner can remove the old one.

## Changelog

- 2026-08-08 (web, PR pending): **The Taxi District's gates work both ways.**
  Three of its four gates were one-way — you could walk out to Mae Sot,
  Myawaddy or the Hydro-Lab, but none of those rooms had a gate back, so
  returning meant the room menu, which is the same "not connected" feeling
  #580 set out to fix. Each now has a matching signposted gate with an
  arrival point. Gate positions came from a grid scan per room: clear of
  every collider by 2.8 m, ≥12 m from any other portal, ground within 0.8 m
  of flat, 12–34 m from spawn. A city room's `gates` entry accepts an object
  as well as the old `[to, x, z, label, colour]` tuple, so it can carry its
  own `gate` axis and `arrive`. All eight legs verified: right room, right
  hint, arrival on the mark, 0 collider overlaps, walks off immediately.

- 2026-08-08 (web, PR pending): **The two Myanmar figures decimated, and now
  visible on low graphics.** meshoptimizer via gltf-transform, ~53% of the
  triangles gone with no visible change: man 41,044 → 19,440 (784 → 400 KB),
  woman 55,700 → 26,266 (1,451 → 759 KB). ★ A **single ratio breaks them** —
  at 0.30 the gold waistband shatters into fragments and at 0.18 the longyi
  gains a gash, because the gold bands, buttons and thanaka are thin decals
  sitting just above the skin and silk; decimating the surface underneath
  makes them poke through. The ratio is now per material: `skin` 0.35 (47%
  of the man's triangles, and limbs are tubes that survive it), the
  decal-carrying cloth 0.55–0.75, anything under 900 triangles untouched.
  ★ `weld()` before `simplify()` is mandatory — on split vertices the
  simplifier sees no shared edges and removes nothing.
  Static-body NPCs are no longer quality-tracked, so they stay on at low,
  where every tracked building is hidden and the streets were empty of
  people. Verified visible at high/mid/low.

- 2026-08-08 (web, PR pending): **Vehicles read the rest of their contract —
  lights, body lean, taxi fare.** Taken from the uploaded package's own
  `vehicle-system.js`, which we had only partly used. ★ The two models
  express lights **differently** — the pickup by material (`MAT_Light_Head`
  / `MAT_Light_Tail`), the taxi by node (`LIGHT_Head_*` / `LIGHT_Tail_*`) —
  so `rigVehicle()` accepts both. ★ Light materials **must be cloned per
  car**: `scene.clone(true)` shares them, so without the clone one car
  braking lights up every car built from that file (verified
  `sharedMaterial: false`). ★ `rotation.order` must be `YXZ` before leaning:
  under the default XYZ the heading is applied after the roll and the car
  leans about the wrong axis. Also reads `forward` from the model's extras
  instead of hard-coding the 180° shell (pickup says `"-Z"`; the taxi omits
  it and defaults to the same). Taxi exit prints the fare from the model's
  own `fareBase` 500 / `farePerKm` 450.
  ★ Kept **our** speed tuning, not the model's: extras ask for `maxSpeed:
  42` (151 km/h), which is wrong for a city street and would undo the
  handling fix from PR #576.

- 2026-08-08 (web, PR #581): **Taxi District — a ring-road city with three
  taxis you can drive.** The uploaded `npc-taxi.glb` packed the city block,
  three taxis and four portal pads into one ~400-mesh scene. A car buried
  inside a map never reaches `room.cars`, so `E` does nothing on it — the
  file is split into `taxi.glb` (60 → 21 meshes, 64 KB; `WHEEL_*`/`DOOR_*`
  keep their pivots) and `taxi_district.glb` (177 → 31 meshes, 137 KB; each
  `BLD_n` stays its own group so MapLoader derives one collider per
  building, roads/kerbs/markings carry `NOCOL_`). `addBuilding({ kind:
  'taxi' })` now drops a drivable taxi in any room — `Buildings.js` keys the
  vehicle path off a `VEHICLE_LABELS` table instead of a literal `'pickup'`
  check. Measured: 33 colliders, 3 rigged cars, drove 45.3 m with the wheels
  turning, all five gate crossings land with 0 collider overlaps.
  The Myanmar man figure (127 → 14 meshes, 0.78 MB) stands in Cyber-Yangon,
  Mae Sot and the Taxi District. ★ The registry claims `"rigged": true` with
  seven motions, but **both** figure exports contain 0 skins and 0
  animations — they can only be `staticBody` NPCs, never walking avatars.

- 2026-08-08 (web, PR #580): **Yangon ↔ Mae Sot joined by a real border
  gate.** The portal pair already worked (headless run: `E` on the Mae Sot
  pad lands you in Yangon) — what was missing was everything that makes two
  places feel joined. Portals now carry an `arrive` point threaded through
  `WorldManager.switchTo(roomId, arriveAt)`, so crossing puts you in front
  of the matching gate instead of at the room spawn, and `gate: 'x' | 'z'`
  draws posts, a lintel and a name board. ★ The arch has **no collider** on
  purpose — posts sit 2.4 m either side of the pad and colliding them would
  narrow the crossing back into the "can't get in" bug class. ★ The first
  Yangon arrival tried (`z −15`) sat inside the block spanning
  `x −23.3…−8.7, z −18.5…−9.9` and physics shoved the avatar 3.7 m on
  landing; it moved to `z −23`. Name labels now shrink to fit their canvas —
  at a fixed 52 px the gate board read `…yber-Yangon`.

- 2026-08-08 (web, PR #576): **Solid buildings, climbable hills, a car that
  drives the right way.** Five reported problems; three turned out to be
  caused by earlier work here, and each was measured before being called
  fixed.
  · *Walking through houses.* The GLB colliders came from the model's
    bounding box: `x[-50.0,-29.9]` against real walls at `x[-44.1,-31.9]` —
    5.9 m out, so the house was thin air. That was the previous "can't enter
    buildings" fix; it opened the door by deleting the house. New
    `world/Occupancy.js` rasterises the model's triangles into a 0.35 m grid
    and emits one box per run of occupied cells. Every side of every house is
    now blocked at 8 m/s.
  · That sealed them completely, because the models ship with doors closed —
    printing the grid showed the front wall as an unbroken run of `#`. The
    doorway is now **cut** into the wall that borders interior space and
    filled with our hinged leaf: 3.3–5.0 m inside with the door open. Two
    bugs on the way, both found by printing a map rather than reading code:
    the "is there a room behind this wall" score counted free cells *outside*
    the building, and the inward direction was written `-step` when the wall
    had been found scanning in the `step` direction.
  · *Props with no collider at all*: every NPC in every room, all 18 Phuket
    palms, every small stupa's body (only the plinth was solid), and
    Cyber-Yangon's 16.6 × 8.6 m Open Wall (0.00 m push at its centre).
  · *Mountains were unreachable* — terrain had no collision and the invisible
    wall sat at the edge of the flat area. Terrain now exposes its height
    function, physics samples it with a 0.8 m/step slope limit, and the wall
    moved to the terrain rim. City centres stay exactly flat.
  · *The pickup drove backwards with its doors open* — rendering it from +Z
    and −Z showed the grille on −Z and both doors modelled swung open.
    Wrapped 180°, doors hinged at the body seam, closed at rest.
  · *All five cities had zero portals and zero stations* — the
    friendship-bridge gate was scenery.
  Physics 0.015 → 0.10 ms per frame, colliders 85 → 648 in Cyber-Yangon:
  0.6% of a 60 fps budget.

- 2026-08-08 (web, PR #574): **Five cities, buildings you can enter, cars you
  can drive, doors that swing.** Myawaddy, Three Pagodas Pass, Chiang Mai,
  Bangkok and Phuket join the room list, each with a landmark, layout and
  NPCs, built from the new `CityKit.js`. Its central rule — **no solid
  blocks** — also fixed the existing world, and every claim below was
  measured before and after rather than assumed:
  · buildings could not be entered (9.85 m push-out at the centre of a stilt
    house, 9.47 m in the colonial house) because one AABB wrapped the whole
    model. `hollowShell()` now emits four wall boxes with the front split
    around a door gap → **0.00 m**.
  · stilt houses keep the space *underneath* walkable — a solid 0→2.2 m slab
    reads as a wall to the physics (`b.max.y <= pos.y + 0.55` fails), so the
    deck is a thin platform at 2.0–2.2 m with stairs up.
  · the pagoda could not be climbed (11.85 m push from one 23×23×26 box) →
    terrace ring, thin plinth, three approach steps inside the 0.55 m limit.
  · cars were scenery. `entities/Vehicle.js`: E to enter, drive, E to exit;
    engine pitch tracks speed through one oscillator. Two bugs found only by
    measuring: the vehicle system was handed its room *after* the first room
    was entered so it saw zero cars, and the obstacle probe compared a point
    at y=0.6 against a car at y=0.03, so every frame looked like a collision.
  · the world was silent — `Sfx.ambient()` adds city hum, sea swell and wind,
    still synthesised.
  · doors now swing (`Door.js`). Closed → in `room.colliders`; open → spliced
    out. Measured: 0.47 m push closed, 82.8° and 0.00 m open. `nearestDoor()`
    measures **horizontal** distance because stilt-house doors sit on the
    deck at y=2.2 while the player walks up at y=0 — the same shape of bug as
    the car probe.
  Also: the re-uploaded colonial house replaces the old one at a quarter of
  the triangle cost, and the 264 m Shwedagon complex 250 m outside the play
  area (unreachable behind the boundary wall) is gone — Cyber-Yangon drops
  487k → 244k triangles with *more* usable buildings than before.
  Collider sweep across every room reports only boundary-wall and Chiang Mai
  city-wall corners, which overlap by design.

- 2026-08-08 (web, PR #573): **Real terrain.** `world/Terrain.js` generates
  hills and ridges from value + ridged noise with a per-palette shade ramp,
  fog at 220/800 and boundary walls. A radial mask keeps the play area
  exactly flat, and `flatSpots` levels the ground under placed landmarks so
  buildings never float or sink.

- 2026-08-08 (web+mobile, PR #572): **One world at a time, and a real menu.**
  Entering the metaverse from the app ran **two** room instances at once,
  burning CPU for nothing: the Dart side carried a stale `_allowedRooms`
  whitelist that silently rewrote the requested room, so the shell opened one
  room while the web client switched to another. `_safeRoom()` is now a regex
  and `_worldOpen` guards against a second WebView. The floating/slide menu
  on the start page is replaced by a dedicated page — `welcome-hub.tsx` on
  web (used by both `/` and `/start`), `start_screen.dart` in the app —
  eight destinations plus the full directory. Graphics quality gained a
  low/mid/high button **and** an auto mode (`core/Quality.js`) that samples
  frame time in 2 s windows, drops immediately below 26 FPS and needs three
  good windows plus 30 s of calm before it climbs back.

- 2026-08-07 (web): **Hash deep links into the Open World.**
  `/metaverse#shop`, `#rooms`, `#feed`, `#quests`, `#board`, `#arena`, `#live`
  … open that panel (or switch that room) directly. The handler reads the
  `openers` map rather than a hardcoded list, so all sixteen openers work and
  new ones are covered automatically; unknown hashes are ignored. `hashchange`
  is handled too, so links work without a reload. Idea taken from the uploaded
  `gwavemetaversebasev12` base — **the rest of v12 was NOT integrated: every
  file in it predates PRs #561–#570** (its `main.js` is 17.8 KB vs our 40.8 KB,
  it has no `Sfx.js` / `Locomotion.js` / `RoomCatalog.js`, and its rooms still
  inline lights instead of using `addRoomLighting`). Its `hub/index.html`
  duplicates `/start`; its `auth/index.html` would be a second login surface
  next to Cognito. Do not merge a vN drop wholesale without this size check.

- 2026-08-07 (web+mobile): **Everyone is a person, everyone faces forward, and
  login asks where you want to go.**
  *Backwards walking:* avatars turn with `rotation.y = atan2(dx, dz)`, which
  aligns the model's **+Z** with travel — but measuring all ten GLBs showed
  `Soldier.glb` faces **−Z** while the other nine face +Z. Soldier is the body
  every remote player wears, so everyone else appeared to walk backwards.
  Locomotion now measures each model's forward from its foot bones and rotates
  the model 180° when it faces the wrong way, so scanner and Blender rigs stay
  correct too.
  *NPCs:* ဦးလှ, မစန်း, ဒေါ်စိမ်းလဲ့ and ကိုမောင်မောင် were capsules with
  sphere heads. They now wear real rigged bodies, chosen by hashing the name so
  ဦးလှ is the same person every visit, and they walk with the same Locomotion
  as players. The capsule stays as a fallback if the GLB fails.
  *Start gate:* `/` sent every signed-in user to `/metaverse`, so anyone
  opening the app to run their shop had to walk through a 3D world first. New
  `/start` offers eight categories (Metaverse, Social, Shop, Marketplace, POS,
  Live, Games, Dashboard); "remember" writes a `gw_home` cookie and `/` honours
  it, validated against the known list so it can't be used as an open redirect.
  Changeable any time from the ☰ drawer. The Flutter app got the same thing —
  a first-launch sheet stored in SharedPreferences, resettable from Settings →
  ဝင်ရာနေရာ — replacing the unconditional metaverse push on every launch.

- 2026-08-07 (web): **Open World gets sound, room lighting, and an honest fire
  button.** Three reports, three separate causes.
  (1) *"Can't shoot in the shooting rooms"* — the 🔫 touch button was drawn in
  **every** room, but only StrikeRoom has a weapon at all, so in Yangon, Farm
  and Mae Sot pressing it did nothing. Rooms now declare `combat`, the button
  only appears where a weapon exists, and E/jump take its place otherwise.
  Shooting in StrikeRoom was verified working on both touch and desktop, so
  that was never the failure.
  (2) *"No gun or bomb sounds"* — the Open World had **no sound at all**: not
  one AudioContext outside voice chat. New `Sfx.js` synthesises gunshot,
  explosion, hit, reload, footstep, UI blip and room-change whoosh in WebAudio
  — no audio files, so nothing to download and no silent first shot — with a
  🔊 toggle in the top bar, an autoplay-policy unlock on first touch and a
  suspend when the tab is hidden. Wired to player fire, bot fire (attenuated
  by distance), kills, reloads, footsteps and room switches.
  (3) *"Rooms are far too dark"* — every room had one flat ambient plus one
  directional. Worse, `WorldManager` fell back to a night background for any
  room that didn't set one, so the **daylight** STRIKE arena rendered against
  a near-black sky. A shared `addRoomLighting(room, preset)` now gives every
  room hemisphere + ambient + key + fill and sets a matching background.
  Mean screen luminance: STRIKE **21.7 → 128.1**, Cyber-Yangon 19 → 24.8
  (near-black 68.3% → 34.6%), Mae Sot 119 → 129, Farm 120 → 131.

- 2026-08-07 (web): **Walk stride corrected + Cyber-Yangon made visible.**
  The first locomotion pass swung hips 0.62 rad (35°) each with a 1.15×
  knee multiplier, so the avatar walked in a near-splits stance, and the arm
  swing carried a constant ±0.14 rad sideways offset that pushed arms outward
  on T-posed rigs. Stride is now 0.42 rad hip / 0.32 rad arm with no lateral
  offset — a normal human gait. Bone swings also rotate about the **body's**
  left-right axis converted into each bone's local frame rather than about the
  bone's own X; the ten shipped GLBs happen to agree, but scanner and Blender
  rigs will not, and this keeps them correct. The sit crouch now drops the
  hips by 40% of hip height instead of a fixed 0.42 units, so it works on rigs
  authored at any scale. Lighting: the room had only a 0.35 ambient and a 0.6
  directional, which with no tone mapping rendered as a near-black void. Added
  ACES filmic tone mapping, a hemisphere light, brighter moon, a row of street
  lamps down the main axis, and lifted the road, buildings, grid, background
  and fog off pure black. Mean screen luminance went from 11/255 to 19.2/255
  and near-black pixels from 84.2% to 65.9%. Because phone screens and ambient
  light vary so much, a **🔆 brightness control** now sits in the top bar —
  four exposure steps (1.0 / 1.25 / 1.6 / 2.0, measuring 16.7 → 28.1 mean
  luminance, 73% → 28% near-black), remembered in localStorage.
  **Arms no longer stuck out in a T-pose:** all ten shipped GLBs are authored
  T-posed (measured 89–90° from vertical), and procedural mode swung from that
  rest, so eight of the ten walked like scarecrows. The rest pose is now
  corrected at load — arms rotated down to ~8° out from vertical with a 0.22
  rad elbow bend — and the swing starts from there. Which side is "left" is
  read from the rig by comparing the bone's position to the spine rather than
  assumed, because guessing it put the arm across the body. Also fixed a latent
  crash: `restHipY` was only set in the procedural branch, so sitting in clip
  mode (Soldier, Xbot) multiplied `undefined` and made the model vanish.

- 2026-08-07 (web): **Open World avatars actually walk, stand and sit.**
  `Avatar.setModel()` played `animations[0]` on a permanent loop and never
  looked at movement, so Soldier idled while sliding (its Walk and Run clips
  were never touched), Xbot nodded forever, Michelle danced forever, and
  Character3/4/5 — which ship **zero** clips — were frozen statues. Remote
  players had no model at all: a capsule and a sphere gliding across the
  ground. New `Locomotion.js` picks idle/walk/run out of the GLB by name and
  cross-fades on measured ground speed, and when a file has no usable clips it
  animates the `mixamorig` leg/arm bones directly, so every one of the ten
  avatar files now takes steps. Speed comes from distance actually travelled
  rather than key state, so walking into a wall no longer moon-walks on the
  spot. Remote players get the same rigged body (`SkeletonUtils.clone`, shared
  cached GLB) and derive their gait from interpolated screen movement, with
  animation throttled past 35m. Sitting became a posture instead of a
  2.4-second gesture: it holds until you press it again or start walking.
  Emotes were also targeting `group.children[0]` — the placeholder capsule
  that `setModel` only hides — so on any GLB avatar every emote was animating
  an invisible object while the real body stood still; they now target the
  visible model. Verified against all ten GLBs: leg bones animate, idle pose
  differs from walk pose, sit pose differs from idle, no page errors.

- 2026-08-07 (web+mobile): **The old metaverse rooms are back — one room list.**
  When /metaverse became the Open World, the Open World's own rooms (Yangon,
  Hydro-Lab, Mae Sot, Strike) were all that remained; the ten maps from the
  original React scene — ဂွေ့ဗ် မြို့တော်, Gwave City, စိမ်းလန်းချိုင့်ဝှမ်း,
  နှင်းတောင်ထိပ်, ကောင်းကင်ကျွန်းများ, ဝှက်တမ်းဥယျာဉ်, ပွဲကွင်း, Drone
  တောင်ကြား, Champions, Assassin လမ်းကြား — still existed at
  /metaverse/classic but had no door anywhere in the UI. New
  `public/world/src/world/RoomCatalog.js` lists all fifteen in one place and a
  🚪 **အခန်းများ** entry (hotkey **R**) opens them from the dock: engine rooms
  switch in place with no reload and no reconnect, your own Virtual Room loads
  through the keyless `world_load`, and classic maps open as an in-world
  overlay exactly like Live/Shop/Studio — which also pauses the Open World
  renderer, so only one 3D scene is ever running. The world client also reads
  **`?room=<id>`** for the first time: `/metaverse?room=snow` lands in Snow
  Peak, an unknown id toasts instead of failing silently. That param was
  already being sent by the Flutter app on every launch and ignored, so the
  app's default room moved from `city` to `yangon` — otherwise the app would
  now open the classic city overlay on startup instead of the world. While any
  panel is open the touch controls hide (`body.panelOpen`), and bottom sheets
  reserve room for the ☰ button so their last row is no longer under it.

- 2026-08-07 (web): **Open World HUD → floating edge dock, centre always clear.**
  Both previous menu shapes covered the world: the radial arc cut straight
  across the middle, and the grid sheet that replaced it on touch closed off
  the bottom half behind a scrim. The menu is now a slim **floating dock on
  the left edge** — round icon buttons with no panel behind them, so the world
  shows through the gaps, no scrim at all. Labels appear beside the icons on
  wide screens, icons alone under 760px, and three icon columns in landscape.
  It is anchored under the top bar and stops above the touch-control zone, so
  it can never reach the joystick, and it scrolls itself with a fade at the
  bottom rather than growing into the view. The keyboard help block collapsed
  into a **?** chip (was three lines pinned open in the corner), the room name
  became a shrink-to-fit chip instead of a full-width bar, the wallet is an
  icon until 1200px, and the 📰 Feed button moved from the right edge into the
  top bar, where it can no longer collide with the mic/emote rail — which
  itself moved to the right edge, since the left now belongs to the dock.
  Panels (leaderboard, shop, quests, feed, avatar, meeting) dock to the right
  edge on wide screens and are capped at 62vh on phones instead of opening in
  the middle. New **idle fade**: four seconds without input drops the HUD to
  22% opacity (touch controls to 50%) and any input restores it instantly.
  A headless probe now asserts a protected centre box (x 24–76%, y 16–70%) is
  free of HUD at 390×844, 360×780, 932×430, 1024×768 and 1440×900 — all clear,
  zero element overlaps. With the menu **open** the HUD covers 22% of a phone
  screen (was over half); at rest it is 16% on a phone and 2.8% on desktop.

- 2026-08-07 (web+mobile): **Swipe deck + per-user virtual rooms.**
  One gesture rule across the whole system, defined once in `src/lib/deck.ts`
  so web and app cannot drift: **← left = 🌍 Metaverse from anywhere**,
  **→ right = the content deck** (Feed → Reels → Live → Games, cycling),
  **↑ up = every function in a grid sheet**, ↓ down closes it. The web
  `SwipeDeck` mounts in AppShell (not inside the app's WebView, which has its
  own tabs), pushes routes rather than keeping two pages mounted — a real
  pager would leave the metaverse's 3D running behind the feed and undo the
  perf work — and stands down over inputs, canvases, iframes, videos,
  horizontally scrollable rows and anything marked `data-no-swipe`, plus a
  24px dead zone at each screen edge so it never fights the browser's own
  back gesture. Deck position shows as dots above the tab bar and the rule is
  taught once on first run. Inside the Open World a **two-finger** right swipe
  leaves for the feed (one finger is camera + joystick), with a 📰 edge tab for
  anyone who does not find the gesture; it pops the native route inside the
  APK, posts to the parent when embedded, and navigates directly otherwise.
  The Flutter HomeShell gained the matching horizontal swipe. Every profile
  now carries a **🏠 Virtual Room** card: enter, build (B), and a copyable
  visit link — `/api/world/room` returns the signed-in viewer's own world key
  only, never anyone else's, and `?world=me` loads your own world through the
  existing keyless `world_load` path.

- 2026-08-07 (web): **Mobile-responsive UI pass — Open World + site chrome.**
  The Open World HUD was laid out with fixed pixel offsets and no safe-area
  handling, so on a phone the wallet button covered the room name, the
  keyboard help panel sat under the mic/emote buttons, and the 11-spoke radial
  menu (R=118px, arc only 371px long for 682px of items) overlapped itself and
  the joystick/fire buttons. Rebuilt around three zones: a flex `#topBar`
  (room name truncates, wallet becomes a 46px icon button under 520px), a
  middle band that always sits above `--ctrl`, and a touch-control zone with
  ≥12px between every button. The menu is now a 4-column grid sheet on touch
  (3 columns ≤360px, 6 in landscape) and a correctly-sized arc on desktop —
  the radius is computed from the item count and the real angular span, and
  clamped to the viewport. Touch controls moved from inline styles to CSS
  classes so safe-area insets and media queries reach them; they also handle
  `touchcancel` so a button no longer sticks down when a notification
  interrupts. Verified headlessly at 390×844, 360×780, 844×390 and 1440×900:
  zero HUD overlaps, zero menu-item overlaps, nothing offscreen. Site chrome:
  header takes `env(safe-area-inset-top)`, theme + language moved out of the
  cramped mobile header into the ☰ drawer (5 icon buttons → 3), drawer gets
  safe-area padding, and the metaverse arcade overlay now has its own title
  bar instead of floating a ✕ over the embedded page's own top-right controls.

- 2026-08-07 (web): **Runtime cost audit — background work stopped.** The app
  ran ~40 always-on timers and 13 unguarded rAF loops that kept working while
  the tab/app was in the background, which is what made phones hot. Now: a
  shared `useVisibleInterval` hook (clears the timer outright while hidden,
  re-runs once on return) covers 5 pollers; 27 further timers/loops carry a
  `document.hidden` guard (reels watch-tick, ride tracking, GPS family share,
  CCTV motion+face detection, screen-time sync, metaverse peer/board/clock
  polls, arena clock, scan turntable, smart-home timers, voice level meter).
  Live-stage 700ms aspect polls now stop as soon as the video ratio settles
  (max 20 ticks instead of forever). A shared `gpu-budget` helper caps touch
  devices at pixelRatio 1.5 and turns off antialias + shadow maps across all
  6 remaining three.js canvases (~44% fewer shaded pixels). The Open World
  engine gained a blocker-counted `setPaused()`: it renders zero frames while
  hidden or while a function overlay covers it, the overlay is now
  single-instance (a second one used to stack and wedge the pause counter),
  closes on Escape, has a 44px touch target and blanks its iframe on close so
  the page inside is genuinely torn down. Two `setInterval` retry loops in the
  world client that could spin for the whole session are now capped at 40
  tries.

- 2026-08-07 (web): **Studio scan library + Movement Lab.** Scans can now be
  renamed, exported to a single .gwscan.json (frames inlined as data URLs, no
  zip dependency), re-imported on any device (fresh id, so a double import
  never clobbers), and their cover downloaded as an image. New 🏃 Movement
  tab tunes head follow, arm swing/spread, stride, knee bend, lean, breathing
  and tempo on the REAL metaverse body with idle/walk/run preview; the tuning
  saves to the account config (motion, sanitised 0..2 server-side) so the
  metaverse and the Open World move the same way. Studio now has four tabs
  and one menu entry.
- 2026-08-07 (web+app): **One world, one studio.** /metaverse IS the Open
  World now — the page injects the login token and renders the world client
  itself, /world 308-redirects into it, and the old React scene is parked
  unlisted at /metaverse/classic. gwave functions that lived outside the
  world (Live & Replays, Games, Item Shop, Studio, full Feed) open as
  in-world overlays from the radial menu, so nothing left the world. Menus
  collapsed to match: one Metaverse entry (was Metaverse + Open World) and
  one gWave Studio entry (was Avatar Scanner + 3D Scanner + Studio).
- 2026-08-07 (web): **Open World v11 — social layer.** Emote wheel ([G],
  8 procedural emotes, multiplayer-synced so they work on scan avatars too),
  proximity voice chat ([V], WebRTC mesh with the server only relaying
  signaling; volume falls off 4m to 22m, speaking ring under the avatar) and
  Meeting Spaces (Lagoon / Meet Hall / Rooftop, MT-XXXXX codes, ?meet=
  invite links, 12-seat circle with a live speaker screen), plus a Yangon
  Civic Plaza meeting kiosk and a radial entry. Server gained the voice
  signaling relay and space create/join/presence. Our integrations were
  re-applied again (avatar variant, same-origin ws/stats, metaverse gate,
  real feed, jsdelivr, no Google Fonts, import map kept pure JSON).
  Headless check: 8 radial spokes, 8 emotes, meeting panel, no page errors.
- 2026-08-07 (web): **Open World v10 — "Yangon City OS".** Yangon is now a
  city of function kiosks (Avatar Studio, Marketplace, POS, Hall of Fame,
  Quest Board, Projects, Open Wall) you walk up to and open with E, plus a
  radial menu ([M], 7 spokes), an in-world avatar preset picker with Gwave
  3D Scanner GLB upload, a 3D open-wall feed billboard and a profile-room
  stats billboard. Our integrations were re-applied on the new files:
  shared avatar variant, same-origin ws/stats, metaverse gate, the real
  feed API, jsdelivr instead of unpkg and no Google Fonts (CSP). The dead
  StatsAPI instance and the duplicate [L] handler were dropped. Verified in
  a headless browser: 7 radial spokes, 6 panels, feed cards, gate present.
- 2026-08-07 (web+app): **Metaverse-first + in-world Social Hub.** Signing in
  now lands members inside the world instead of the feed: the root page,
  the login form, Google One Tap and the OAuth callback all default to
  /metaverse (an explicit ?redirectTo/state still wins), and the app pushes
  the metaverse once after sign-in (back returns to the shell). New in-world
  🫂 Social Hub with four tabs on the real APIs — Feed (/api/posts),
  ဒီမှာရှိသူ (live room roster), အသိပေးချက် (/api/notifications) and စာများ
  (/api/conversations) — plus 🧭 quick teleport (opens the world map) and
  📸 photo mode that hides every [data-hud] layer until you tap.
- 2026-08-07 (web): **Open World v9 — "ရွှေတံခါး" theme.** Gold-led design
  system (theme/gwave-theme.css), restyled HUD/panels, a cinematic gold-stupa
  intro (camera orbits until "enter" is pressed), an in-world [N] feed panel,
  and a 3D portal landing page at /world/landing.html. Adapted for gwave.cc:
  the Google Fonts @import was dropped (CSP allows no external font host —
  Padauk/system stack instead), unpkg swapped for jsdelivr, and the feed panel
  now reads the REAL feed (/api/posts?scope=feed, same-origin cookie) with the
  demo posts only as fallback. Our integrations were re-applied on top: shared
  avatar variant, same-origin ws/stats defaults and the 🌐 metaverse gate.
  The site homepage was deliberately NOT replaced — the landing is an extra
  page, not the feed's replacement.
- 2026-08-07 (web): **Social Metaverse + Open World are one world.** The
  metaverse gains a 🌏 OPEN WORLD arcade gate and a ⋯ menu action that open
  the Open World as an in-world overlay (no page leave, no token in a
  shareable URL — /world's launcher injects the Cognito idToken itself).
  The Open World gains a 🌐 gate back: postMessage closes the overlay when
  embedded, plain navigation otherwise. Both now render the SAME avatar —
  the Open World reads the realistic variant from localStorage
  (mv:soldier) or /api/metaverse/avatar and loads that Mixamo GLB.
- 2026-08-07 (web+app): **gWave 3D Studio — one workspace for all 3D.**
  The three separate 3D tools are now tabs of a single route `/studio`:
  🧬 Avatar (face/body scan + editor), 🛰 Scanner (room/object), 🧱 World
  (the public/engine builder framed, with an Engine/Studio/World Maker/
  Generator/XR picker). Each tab mounts its heavy three.js bundle only
  when selected, and the tab is reflected in ?tab= so links are shareable.
  /scan, /profile/avatar and /engine now 308-redirect into it, and every
  in-app link (web nav, mobile menu, metaverse arcade landmark, profile
  page, metaverse Avatar Studio) points at the merged route.
- 2026-08-07 (web+app): **APK ↔ website feature parity.** The app menu and
  the web sidebar now carry the SAME nine categories with the same members.
  App gained every web-only feature (Open World, gWave Studio, 3D Scanner,
  Avatar Scanner, GWAVE Drone, Item Shop, Inventory — 3D ones open
  fullscreen); the web nav gained the app-only web routes (Live class,
  Replays, Inventory, Help). Left app-only on purpose: phone-sensor tools
  (light meter, radar, storage cleaner) and features with no web page yet
  (dating, market, books) — each filed under its true category. Automated
  cross-check: 0 web features unreachable in the app, 0 app web-routes
  missing from the web nav.
- 2026-08-07 (web): **Open World v8 — GP economy + worlds + seasons.**
  Upgraded /world (user-authored metaverse-base v6→v8): GP point economy
  (game.wallets/point_ledger/inventory — kill/streak/quest GP, [I] shop
  with 4 skins + VIP tag, skins sync to all players), [Q] daily quests
  (auto-claim), kill streaks (Triple Kill/Rampage broadcasts), leaderboard
  seasons (all-time/weekly/monthly tabs, hourly auto-finalize pays
  500/300/150 GP), GP↔POS redeem (GW-XXXXXX codes, staff page at
  /world/pos-claim.html, POS_KEY env auto-generated on deploy), personal
  buildable worlds ([B] build mode: 5 blocks + 3 GLB props + custom NPCs,
  server-validated, world:<key> rooms are multiplayer, ?world= visits),
  and an NFT scaffold (GwaveSkins.sol + custodial mint, CHAIN_MODE=off by
  default — TESTNET_CHECKLIST.md in deploy/world-server when ready).
  Games hub now shows the live Open World weekly leaderboard widget.
  Adaptations re-applied: jsdelivr importmap, same-origin /world-ws +
  /world-stats, single [L] handler, PG* envs, per-process container PORTs.
- 2026-08-07 (web): **Avatar scanner pro** (/profile/avatar) — multi-frame
  HQ capture (face: 12-frame landmark mean + sharpest-frame texture, 1080p
  camera, adaptive 2048² texture, z-smoothing + depth boost; body: 12-frame
  median), preview rebuilt on createRealisticHuman with motion try-out
  buttons, drag inertia, pinch-zoom spring, spring-damped morphs, soft
  shadows; realistichuman setMorphs now maps all 11 morphs; editor gets an
  18-variant grid + DB status card, and syncs variant through
  /api/metaverse/avatar so profile + metaverse studio are one identity
  (/api/avatar returns updated_at). PR #544. APK build #283 published to
  mobile-latest. Also merged dependabot #483 (postcss 8.5.23) and #499
  (gwave-strike vite 6.4.3 — full workspace build verified locally before
  merge).
- 2026-08-06 (web): **Explainer page** — user-supplied AI-presenter promo
  at /explainer.html (3 scenes + narration); its audio CDN allow-listed in
  media-src. PR #543.
- 2026-08-06 (web): **LiveKit replay pipeline is LIVE end-to-end.** User
  configured `LIVEKIT_EGRESS_S3_*` on EC2 (bucket gwave-ivs-recordings,
  ap-northeast-1, scoped IAM user gwave-livekit-egress) and the egress
  worker now runs on the LiveKit SFU box (52.77.195.25: redis + livekit/
  egress container, room_composite_cpu_cost 1.5). Two test broadcasts
  recorded to S3 with egress_complete. `/api/metaverse/lives` self-heals
  recording_path via listEgress so the SFU webhook is not required.
  PRs #535/#538. ✅ 2026-08-07: both the S3 egress key and
  LIVEKIT_API_SECRET were ROTATED (new key live-tested against S3 before
  swap; SFU livekit.yaml + egress.yaml + web env updated together and all
  services restarted). Owner still has to delete the old deactivated
  access key in the IAM console.
- 2026-08-06 (web): **Live hub host names** — profiles has full_name, not
  display_name; the wrong column errored the whole names query. PR #542.
- 2026-08-06 (web): **GWAVE item economy** — G-Points shop (/items),
  inventory (/inventory), daily reward, sell listings; atomic SQL fns
  (fn_adjust_points/fn_buy_item/fn_claim_daily/fn_equip/fn_list_item) in
  deploy/sql/gwave-economy.sql — **APPLIED on RDS** (8 items seeded).
  RLS-sealed, /api/economy/* via admin client rpc. PR #540.
- 2026-08-06 (metaverse): **Realistic Mixamo avatars replace cartoon kit
  bodies everywhere.** 10 self-hosted bases under public/metaverse/
  realistic/ (Remy, Character3/4/5, Michelle ×2, Clown, Granny — user FBXs
  converted via FBX2glTF + webp — plus Soldier/Xbot from three.js). 18
  variants with tints; hybrid animation (baked idle/walk/run where the GLB
  has clips, measured arms-down rest pose + breathing + weapon-hold
  overlay, procedural locomotion otherwise); facing fixed (Mixamo rigs are
  180° off game forward). One-page **Avatar Studio** (customiser.tsx
  rewritten): variant picker + RPM Photo Avatar + scan links + height
  slider; config.variant roams across devices. AvatarPreview fallback is
  the realistic Soldier. PRs #532/#537/#538/#539.
- 2026-08-06 (metaverse): **📺 Live & Replays hub + end-of-live wrap
  post** (golive stop() returns the ended id; saveLiveWrapPost one-tap).
  PR #535. **📸 Photo Avatar (Ready Player Me)** — selfie → rigged GLB
  body, synced to remotes via new "rpm" net message. PR #533.
- 2026-08-06 (web): **🛰 3D Scanner suite** at /scan — Room/Object orbit
  capture with LiDAR-style UI (wireframe mesh overlay, coverage %, ⏺/⏹,
  "Pre-Process now?" dialog), IndexedDB library, drag-orbit viewer; avatar
  scanners adopt the pro RecordButton. Nav + en/my messages. PR #536.
- 2026-08-06 (drone): **Mobile ☰ menu + one-tap drone presets** — touch
  drawer (fly/garage/online/leaderboard/settings), 5 preset loadouts with
  "switch & fly", 🚁/💥 FABs, prompt() skipped on touch. PR #534.
- 2026-08-06 (ops): PR #541 (user-merged dev→main) verified harmless —
  the APK workflow only triggers on the dev branch, so no duplicate
  builds; mobile/ now also exists on main. GitHub Actions runs were
  auto-cancelled for a stretch in the evening (billing/minutes suspected;
  user reports resolved).

- 2026-08-06 (engine): **gWave Studio suite** — integrated the uploaded
  gwave3d package as pages under /engine (NOT as the standalone nginx
  installer it shipped with, which would fight Caddy for port 80 and
  violate the one-app rule): `/engine/studio.html` (full world & game
  creator: templates, GLB/OBJ/HDRI import, GLTF export, bloom, share
  links), `/engine/avatar.html` + `avatar-builder.js` (procedural
  avatar customizer, localStorage `gwave_avatar`), `/engine/xr.html`
  (WebXR VR/AR viewer of shared scenes). Studio's Colyseus multiplayer
  was rewired to the existing gwave-engine-server plain-ws protocol
  (/engine-ws, gw_at auth) — no second multiplayer server; its /acct
  accounts service was replaced by the gwave session (`/api/engine/me`)
  and cloud world saves by `/api/engine/worlds` (+ `[id]`) on the new
  RLS-sealed `engine_worlds` table (`deploy/sql/engine-worlds.sql`,
  admin-client + code-enforced ownership, private/public visibility).
  The package's python accounts/scanner/TripoSR-GPU services stay
  undeployed (gwave auth covers accounts; GPU backend documented in
  /engine/generator.html as not deployed).
- 2026-08-06 (engine): **Phase 6 — quality tiers (roadmap complete).**
  detectQuality(): ?lowfx=1 or coarse-pointer+dpr>2 → "low" tier
  (pixelRatio clamp 1.5, no antialias, no shadows) so mid-range phones
  hold 60fps; the header chip shows the tier. WebGPU: probed
  (?webgpu=1 && navigator.gpu reports "webgpu: ready") but the render
  path stays WebGL2 — three 0.168's WebGPURenderer isn't reliably
  loadable through the CDN importmap; the actual renderer swap is the
  documented §20 P6+ follow-up. Web Worker physics also deferred with
  reason: Rapier WASM in a worker wants SharedArrayBuffer, which needs
  COOP/COEP headers the site doesn't serve (would break embedded
  iframes like the metaverse Game Zone scanner). Engine roadmap
  Phases 1–6 all shipped.


- 2026-08-06 (engine): **Phase 5 — plugin API.** window.gwaveEngine
  surface (registerBehavior/registerAction/registerSystem + world/
  events/hud/audio), plugin behaviors join the editor palette and the
  BehaviorSystem falls through to the plugin registry for unknown
  types; actions.run checks the plugin action registry; ?plugin=
  same-origin ES-module loader (comma-separated, install(api) export).
  Docs public/engine/PLUGINS.md + worked example
  plugins/example-bouncer.js (trampoline behavior + confetti action).


- 2026-08-06 (engine): **Phase 4 — asset pipeline.** Draco geometry
  decompression + KTX2/Basis texture transcoding wired into the shared
  GLTFLoader (decoders from the same three@0.168 CDN, KTX2 GPU-format
  detection hooked from main). Distance streaming: MeshRef.cullDistance
  hides objects beyond the radius (editor number field, persisted).
  THREE.LOD support: MeshRef.lod = [{url, distance}] loads each GLB
  level and switches per camera distance. RenderSystem now takes the
  camera for LOD/culling.

- 2026-08-06 (engine): **Phase 3 — multiplayer.** New gwave-engine-server
  workspace (plain ws matching the drone-server pattern): rooms with
  auto-create/GC, 20Hz snapshots, envelope speed validation (teleports
  snap back with a correct message), chat relay, /health on the same
  :8789 port, AUTH_MODE off/gwave/dev/cognito reused from the drone
  server's auth.js. deploy-engine-server.yml (ECR gwave-engine-server →
  SSM rollout of the `engine-server` container, 127.0.0.1:8789).
  Client net/net.js NetSystem: 20Hz state up (pos/ry/anim from the
  animator), remote players as runtime capsule entities interpolated
  100ms behind, server corrections applied to the local Transform,
  chat via HUD. 🌐 Online button (auto-starts play; same-origin
  wss /engine-ws default) + chat input. Local smoke: 2-client join,
  snapshot sync, teleport rejection, chat relay all pass. EC2 pending
  (user): Caddy /engine-ws route — deploy/gwave-engine/README.md.

- 2026-08-06 (engine): **Phase 2 — animator + spatial audio + input.**
  character/animator.js: idle↔walk↔run↔jump↔fall state machine with
  crossfade, fuzzy clip aliases, graceful fallbacks, and a shared
  animation-library GLB loader (Mixamo clips retarget by bone name —
  editor gained an "Anim GLB" field on characters, persisted in the
  scene file, carried onto the play-mode player). audio/audio3d.js:
  procedural SFX now play through HRTF PannerNodes with the listener
  riding the play camera — positional coins/hurt/steps (footstep cadence
  from the player system), UI sounds stay 2D. input: rebindable action
  map (localStorage gwe:keys) + ⌨ Controls panel with press-to-bind
  capture; gamepad/touch unchanged on the same action surface.

- 2026-08-06 (engine): **Phase 1 — ECS core refactor shipped.** /engine
  is now the modular engine (public/engine/src/): core (World/Entity/
  System/EventBus + fixed-timestep loop with alpha interpolation),
  physics (Rapier CDN + KinematicCharacterController with autostep/
  snap-to-ground, AABB-lite fallback, one shared api), script (actions
  + BehaviorSystem: Rotator/Floater/MovingPlatform(waypoints+dx/dz)/
  Collectible(respawn)/Hazard(knockback)/Goal/Checkpoint/TriggerZone/
  NPCDialogue), render (RenderSystem mirrors ECS→three, async GLB with
  auto-normalize + AnimationMixer), input (kb/touch/gamepad → one axis),
  camera (third-person spring), ui (event-bound HUD + WebAudio SFX),
  serialize (.gwave.json v2 + v1 auto-upgrade), editor (palette,
  raycast pick, TransformControls writing BACK into components,
  hierarchy/properties/behavior panels, ★ player start, save/load).
  Play = snapshot → physics bodies + player spawn + 3 play systems;
  Stop = exact snapshot restore. Old single-file seed kept at
  /engine/mvp.html. Next: Phase 2 animator/audio polish → Phase 3
  Colyseus multiplayer.

- 2026-08-05 (engine): **gWave Game Engine MVP live at gwave.cc/engine.**
  Uploaded gwave3d seed integrated as static pages: /engine (editor +
  play — object palette, TransformControls gizmo, hierarchy/properties/
  behavior panels, behaviors Rotator/Floater/MovingPlatform/Collectible/
  Hazard/Goal/Checkpoint/TriggerZone/NPCDialogue, win conditions
  collectAll/reachGoal/survive, HUD, kinematic physics + Rapier CDN
  probe, GLB import incl. animated characters, save/load .gwave.json),
  /engine/world-maker.html (world maker MVP), /engine/character-demo
  .html (third-person controller demo), /engine/generator.html (image→
  3D viewer; GPU TripoSR backend NOT deployed — note added, API URL
  field manual), character schema JSONs. /engine 308 redirect route.
  Engineering spec (ECS/Rapier/Colyseus roadmap) received — Phase 1
  refactor to follow on top of this seed.

- 2026-08-05 (metaverse): **Dedicated game rooms.** Each Game Zone
  cabinet now teleports into its game's own room and auto-joins the
  mini-game lobby on connect (pendingGameRef → onInit): 🚁 drone-race
  → "Drone တောင်ကြား" map (hills valley, enterable hangar + control
  tower, 5 launch pads with 6 drones, lake; auto-join droneRace); 🏁
  champions → "Champions ပြိုင်ကွင်း" (grandstands, enterable pit
  building, start/finish arch pillars at the final checkpoint, lamps
  along the racing line, 4 cars + 2 drones; auto-join race); 🎯
  assassin-alley → "Assassin လမ်းကြား" (night palette, fog default,
  city-block alley maze with 3.2m walls, sparse lamps + fire barrels;
  auto-join assassin); 🔫 STRIKE keeps the arena combat room. Server:
  3 new social room defs (drone-race/champions 32p, assassin-alley
  16p); client: 3 new MapDefs registered, MAP_LIST + MapId extended.

- 2026-08-05 (metaverse): **In-world games — Game Zone cabinets now play
  IN the engine (user feedback: iframes rejected).** Two new server
  mini-games (games.js, logic server-side, cheat-proof, lobby/score/
  leaderboard framework): 🚁 droneRace — 7 aerial checkpoint rings with
  heights (y ≤ 13 so the marker beam stays connected), 3D distance
  check means you must ride a 🛸 drone vehicle (3 parked at the Game
  Zone); 🎯 assassin — ring target assignment, tag your target within
  2.2m to eliminate + inherit their target, 8m-grid position hints,
  last-alive wins. GameObjective gained optional y (client marker ring
  floats at that height). Cabinet actions are now in-world: DRONE →
  droneRace lobby, STRIKE → arena room switch, ASSASSIN → assassin
  lobby, DRONE CHAMPIONS → race lobby; 🧬 Scan Studio stays an overlay
  (camera utility). games menu Game Zone section triggers the same
  actions. Tests: 2 new (3D ring gating, assassin elimination/win),
  counts updated — 241 pass.

- 2026-08-05 (metaverse): **🕹 Game Zone — all games playable INSIDE the
  metaverse.** New arcade plaza behind spawn (z=20): 4 neon arcade
  cabinets (GWAVE DRONE, GWAVE STRIKE, Assassin, Drone Champions) with
  emissive canvas screens + accent marquees + colliders, a 🧬 3D SCAN
  STUDIO pod (emissive pad + stand-in torus scan ring) and a GAME ZONE
  arch. Walk up → pulsing HUD button → game opens in a same-origin
  overlay iframe over the world (never leaves the metaverse; ✕ returns
  in place). Closing the Scan Studio re-applies the avatar immediately
  (applyAvatar in game rooms, avatarNonce rebuild elsewhere). 🎮 games
  menu gained a "Game Zone" section listing all five. Enabler:
  frame-ancestors 'none'→'self' + X-Frame-Options DENY→SAMEORIGIN
  (cross-origin framing still blocked). Landmark type gained
  `overlay?: boolean`.

- 2026-08-05 (game): **GWAVE DRONE Phase 5–7 (multiplayer + garage + gwave
  integration).** gwavegamep7final package integrated. Client
  (public/drone/): drone garage/configurator ([B], part catalog →
  physics applyBuild + colors), drone combat P6 (signal/jammer zones,
  FPV static noise, payload arming, kamikaze, target marking), NPC
  "ဦးလှ" ([T], canned replies; OpenClaw endpoint via ?ai=), online
  multiplayer (ONLINE btn → 16-player rooms, 20Hz state sync, 100ms
  interpolation, remote avatars+drones, PvP with server-validated
  hits, chat, kill feed, leaderboard [L]). New workspace
  gwave-drone-server/ (ws :8787 + api :8788, one `drone` container,
  deploy-drone-server.yml → ECR gwave-drone-server, SSM, health-gated):
  auth patched with AUTH_MODE=gwave verifying the web session's gw_at
  ES256 data token against APP_JWT_PUBLIC_JWK (identity = profiles.id;
  service_role rejected); api uses GAME_DATABASE_URL (RDS ssl) with
  in-memory fallback; /health added; client auto-targets same-origin
  /drone-api + wss /drone-ws with gw_at cookie. wss://gwave.cc added
  to CSP connect-src. Migration: gwave-drone-server/migrations/
  001_game_schema.sql (schema `game`). EC2 setup pending (user):
  migration + GAME_* envs + Caddy routes — deploy/gwave-drone/README.md.

- 2026-08-05 (game): **GWAVE DRONE Phase 3+4 (soldier FPS + combat).**
  Uploaded gwavedronep4 package (superset of p2/p3) replaces the
  first-pass Phase 2 code in public/drone/: AVATAR↔FPV mode toggle
  ([F] deploys the drone), soldier controller (sprint/crouch/jump,
  pointer-lock FPS + 3rd person [V]), 3-slot weapon system with ADS/
  recoil/reload + target range, enemy AI waves ([P], Burmese captions),
  explosions + chain-reacting barrels/cars, fire grid burn damage,
  traps (mine/tripwire/C4), HP/regen/vignette, refactored RaceSystem/
  CollisionSystem/DroneAudio (gate & arm beeps, next-gate highlight,
  optional GLB drone via ?drone= / assets/drone.glb). Best lap now
  persisted per-track in localStorage (added on top of the package).

- 2026-08-05 (game): **GWAVE DRONE live at gwave.cc/drone (P1+P2).**
  Uploaded FPV sim package (240Hz acro/angle physics, FeelFPV-parity
  rates UI, gamepad/ELRS/touch, WebXR, scan-avatar pilot) integrated
  as a static app in public/drone/ (CDN three is CSP-allowed; /drone
  redirect route added). Phase 2 implemented on top: gate lap timing
  with strict checkpoint order + best lap, obstacle crash colliders
  (barrels/trees/gate posts), physics-driven 4-motor sound + crash +
  low-battery beeps, 20Hz ghost replay of the best lap, JSON track
  format (public/drone/tracks/). Spec docs: GWAVE_METAVERSE_COMBAT.


- 2026-08-05 (iot): **GWAVE Home platform (unified IoT engine).** New
  gwave-home/ workspace (from the user's uploaded platform+engine
  packages, reviewed & fixed: aedes 1.x createBroker init, "state"
  trigger type): device registry + traits + permissions, EMBEDDED MQTT
  broker (aedes, per-device sha256 creds + topic ACL, port 1883),
  auto-discovery, sensor time-series, rules engine (if/then/cooldown),
  provisioning API. Deployed as the `gwave-home` container
  (gwave-home.yml, ECR→SSM, health-gated). Web UI at gwave.cc/iot
  (trait-driven dashboard, 24h SVG charts, Burmese rule builder,
  ESP32 wizard) through the session-checked /api/home/* proxy. The
  older /home smart-home page is untouched. Needs user-side rollout:
  migrations on RDS + GH_* envs + SG 1883 (deploy/gwave-home/README).

- 2026-08-05 (game): **GWAVE STRIKE live at gwave.cc/strike.** Rehomed
  from the never-provisioned game.gwave.cc plan onto the app box: one
  `strike` container (127.0.0.1:8095) serves the vite-built client
  (base=/strike/) AND Colyseus matchmaking/WS via its express
  fall-through; deploy-strike.yml now mirrors metaverse-server.yml
  (ECR gwave-strike → SSM, health-gated rollback). Caddy needs the
  `/strike` redir + handle_path route on the box (deploy/Caddyfile,
  README-strike.md) — added user-side at rollout.

- 2026-08-05 (web): **Camera Bridge server side.** Router-less/CGNAT
  cameras: the Android app relays the camera's local RTSP OUT to a
  MediaMTX on the prod box (deploy/cctv-bridge/), republished as HLS
  at gwave.cc/hls/*. POST /api/mobile/cctv/bridge mints a path-scoped
  24h HMAC publish token (CAMERA_VENDOR_TOKEN_KEY_V1) + owns the
  camera row; /api/cctv/bridge/auth is the MediaMTX auth webhook
  (fail-closed). Inert until CCTV_BRIDGE_PUBLISH_BASE +
  CCTV_BRIDGE_HLS_BASE are set on EC2. App side ships on the mobile
  branch.

- 2026-08-05 (web): **Tapo guided RTSP wizard.** Picking Tapo in Add
  Camera opens a 3-step Burmese wizard (Camera Account ≠ cloud email,
  Device Info IP, HD/SD) composing the rtsp:// URL live — no hand-
  editing templates. Vendor-cloud step 2 was investigated and shelved:
  TP-Link has no official third-party API and the design doc forbids
  reverse-engineering; the bridge above is the router-less answer.
  PR #501.

- 2026-08-04 (game): **GWAVE STRIKE Phases 1–5.** Isolated workspace
  gwave-strike/ (three.js + Rapier client, Colyseus 0.17 authoritative
  server, shared sim constants): open-world FPS with server-side
  hitscan + lag comp, bots, offline fallback, PWA client, deploy kit
  for game.gwave.cc (deploy-strike.yml; goes live when STRIKE_EC2_*
  secrets + DNS exist). PRs #498 + #500.

- 2026-08-04 (web): **LiveKit replays actually play.** /recordings
  now knows the LiveKit egress bucket (LIVEKIT_EGRESS_S3_*) with a
  CDN 302 fallback — feed cards and the app can stream saved lives.
  PR #496.

- 2026-08-04 (web): **Metaverse Go Live records for replay.** Streams
  now create with record:true — with LIVEKIT_EGRESS_S3_* envs set (see
  deploy/livekit-egress-replay-env.md, user-side) every broadcast
  auto-saves an MP4 replay; without them the flag is a no-op. PR #495.

- 2026-08-04 (web): **Go Live provider fix + mobile chat re-home.**
  Root cause of "Go Live does nothing": prod default provider is IVS
  but the metaverse publishes via LiveKit — create now honors
  provider:"livekit". Touch chat moved to mobile-FPS layout: read-only
  lines above the joystick, 💬 opens a top-anchored composer the
  keyboard can't cover. PR #494.

- 2026-08-04 (web+mv): **Scan faces in rooms (avatar Phase 4).** Social
  room avatars wear their owner's scanned face GLB — own face from the
  metaverse avatar API, remotes via the public /api/avatar?userId=
  read (authed metaverse ids are profile ids), URL+model caches with
  a 16-entry GPU cap. Arena keeps soldier bodies. Phase 4 PR.

- 2026-08-04 (web): **Body scan (avatar Phase 3).** Front A-pose
  capture with self-hosted pose_landmarker_lite: visibility-gated
  measurements → anthropometric-referenced [-1,1] morph weights,
  optional real height input, "Reset to scan" in the Body tab.
  PR #492.

- 2026-08-04 (web): **Face scan (avatar Phase 2).** Fully client-side
  MediaPipe face scan (self-hosted WASM+model, consent-gated presigned
  upload): canonical-topology mesh from the front capture, projected
  1024² texture, GLTFExporter GLB on the avatar's head with
  hard-delete. PR #491.

- 2026-08-04 (web): **Avatar scan system Phase 1.** mv_scan_avatars /
  avatar_assets / avatar_inventory schema (applied on RDS),
  /api/avatar + /upload (presigned, consent-gated) + /assets routes,
  zustand store, /profile/avatar editor (turntable preview, 11 morph
  sliders, skin palette, body-style grid). PR #490.

- 2026-08-04 (web+mv): **Go Live fix + camera PiP + befriend UX +
  HUD declutter.** Go Live errors now surface as toasts (root cause of
  "button does nothing"); compositor pipeline adds face/back-camera
  PiP to the stream (APK v1.0.272 grants WebView camera); NPC
  befriending got a proximity context button + always-on failure
  feedback (server FRIEND_RANGE 5); game HUD collapsed behind ⋯ with
  a slimmer killfeed. PR #489, APK 272.

- 2026-08-04 (web): **In-world screens play phone lives (phase 2b).**
  attachLiveKitScreen connects the city screen as a LiveKit viewer
  (stage token, proximity connect/disconnect) so app Go Live broadcasts
  play as VideoTexture — no more "app ထဲ ကြည့်ပါ" placeholder when a
  LiveKit live is on. Board API returns the live id for it. PR #487.

- 2026-08-04 (web): **Burmese voice lines via device TTS.** voicelines.ts
  speaks my-MM lines (match start/win/kill/wrong-kill/death/respawn/
  pickup) through speechSynthesis with per-line + global throttles;
  bandit NPCs answer in a lower pitch when befriended ("ကောင်းပြီ
  သူငယ်ချင်း…") or shot ("သတ္တိရှိရင် လာခဲ့"). Silent no-op on devices
  without a Burmese voice. PR #486.

- 2026-08-04 (web+mv): **Arena high-rise towers + platform physics.**
  Maps gain walkable platforms; world.groundAt + scene physics give
  landing, auto step-up and edge falls. Two 6x6 firing towers at
  (0,±10) with switchback stairs up to open y=6 floors for cross-tower
  sniping; server y clamp raised 6 → 14. PR #485.

- 2026-08-04 (web): **Rigged GLB avatars arena-wide + combat anims.**
  Every arena avatar (self, remotes, bandits) renders as a kit soldier
  character (stable per-player variant); shots play
  holding-right-shoot / melee clips, kills play the die clip with a
  1.5s corpse hold. Social rooms keep the customizable procedural
  body. PRs #482 + #484.

- 2026-08-04 (tooling): **scripts/merge-animations.mjs** — gltf-transform
  based GLB animation merger (user-contributed, hardened with
  ALL_EXTENSIONS + clip-name dedupe); confirmed the shipped kit
  characters carry 27 animation clips each. PR #481.

- 2026-08-04 (web): **Hikvision brand removed** (product decision —
  partner application on hold): connector stub, env plumbing, and the
  RTSP preset deleted; the vendor-cloud framework stays vendor-agnostic
  and Hikvision hardware still works via generic ONVIF/RTSP. PR #480.

- 2026-08-04 (web): **Metaverse Go Live → newsfeed.** New golive.ts
  publishes the WebGL canvas (30fps) + mic through the existing LiveKit
  Go Live pipeline (create → stage token → goLive → end); 🔴 chips in
  game/social HUD with off/starting/live states; broadcast ends cleanly
  on room change or teardown. Appears in the feed Live rail like any
  live and is announced on the in-world screens. PR #479.

- 2026-08-04 (web): **GWAVE LIVE screens play current lives.** The city
  screen polls /api/metaverse/board every 60s — IVS lives play via HLS
  VideoTexture (auto-swap on start, placeholder on end), LiveKit phone
  lives are announced by title ("app ထဲ ကြည့်ပါ"). PR #478.

- 2026-08-04 (web+mv): **NPC balance (user feedback).** NPCs are now
  peaceful until the avatar shoots first (proximity mugging removed,
  grudge 25s), damage scaled to 60%, HP 70, aim error doubled, fire
  rate halved, chase speeds reduced. PR #477.

- 2026-08-04 (web+mv): **Avatar profile pictures with show/hide.** New
  presence `pic` message (server-validated https URL, hide = server
  never sends it); nametags render a round photo above the name with a
  client-side origin allowlist; 🖼 toggle chips persist in
  localStorage. PR #476.

- 2026-08-04 (web): **Arena feel pack.** Bomb knockback fling (impulse +
  vertical pop + strong vibration, collision-checked), glass-shatter
  debris after explosions + sniper echo tail, and a 🔋 eco mode (30fps
  cap, pixelRatio 1, shadows off, persisted). PR #475.

- 2026-08-04 (web+mv): **Arena NPC dogs.** Two befriendable wild dogs
  (npc-only bite weapon, procedural dog model with diagonal gait) that
  follow and pack-attack for their friend; melee targeting closes to
  bite range. PR #474.

- 2026-08-04 (web+mv): **Arena bandit bot NPCs + weapon drops.** New
  server-side AI (`server/metaverse/bots.js`, 150ms ticker): 3 named
  bandit bots wander the arena, hold a 60s grudge against anyone who
  shoots them (chase + fire through the same server-authoritative
  handleFire path, distance-scaled aim error), mug non-friends who come
  within 6u, and can be befriended with the new 🤝 wave chip — a friend
  bot follows its player and returns fire at their attackers; shooting
  it breaks the friendship. Bots stay out of the assassin target ring
  and scoring; the reward for killing one is its dropped weapon. Any
  death now drops the victim's weapon (half mag, 30s TTL) rendered as a
  spinning 3D mesh; walking over it auto-picks it up (ammo capped at
  2× mag) with a Burmese toast. 9 new tests (252 total). PR #473.

- 2026-08-04 (web+mv): **Weapon realism pass.** Realistic wide sniper
  scope (bright 41vmin view, mil-dot hairlines, no more black cutout),
  chest-high armed hold pose for avatars in TP (human.ts `armed` state),
  knife is true melee (slash animation, no tracer), and grenades got a
  standard fuse: server emits aThrown (client arcs the projectile) and
  detonates 900ms later via new assassin.detonate() with damage computed
  from positions at detonation time — dodgeable. PR #472.

- 2026-08-04 (web): **Arena HP bar + rules guide + haptics.** Bottom-
  center HP bar with % and colour states plus 🎯score·☠️kills chip; 📜
  rules card (assassin scoring, weapons roles, hide-and-seek rules,
  live killsToWin); vibration feedback for fire/hit/damage/kill/death/
  explosion/win; game-room chip row moved down to clear the app WebView
  back arrow (accidental exits); avatar customiser re-applies live
  without restarting the scene. PR #471.

- 2026-08-04 (mv): **Stale-socket clobber fix.** A heartbeat-killed old
  socket's cleanup was deleting the reconnected player from the room and
  assassin match, killing weapon switch + HP display ("သေနတ်ပြောင်းမရ").
  drop() now verifies it owns the current registration first. PR #470.

- 2026-08-04 (web): **Minimal floating game HUD.** Game rooms replace
  the status panel box with icon-only floating chips (🏆📣👤📜❓🏙),
  compact fps pill, and hidden social rows — the game view is almost
  entirely unobstructed on phones. PR #469.

- 2026-08-04 (web): **Arena environment v2.** Brighter palette, factory
  skyline backdrop outside the walk area, market stalls/carts/tanks/
  rocks as new cover (with colliders), NPC villager statues, lantern
  ring, clear-sky default. PR #468.

- 2026-08-04 (web): **HUD zone design standard + real weapon icons + held
  3D weapons.** Documented six HUD zones (top-left panel, top-center
  weapons, top-right minimap/menu, bottom-left joystick/chat, bottom-center
  readouts, bottom-right combat cluster) and enforced them: game rooms hide
  the verbose keybind text behind a ❓ ခလုတ်များ toggle (the long help line
  was overlapping the weapons strip), hide the ownership chip, and narrow
  the chat box so nothing covers anything in either orientation. Weapon
  buttons now show real weapon silhouettes (inline SVG per weapon — pistol,
  knife, sniper, bomb, SMG, shotgun, revolver) instead of text-only chips.
  The avatar physically holds the selected weapon: new weapons3d.ts builds
  blocky 3D models attached to a new right-hand attach point (human.ts),
  swapped live on weapon change; first-person gets a camera viewmodel with
  fire-kick recoil; remote players' hands sync from aShot events. PR #467.

- 2026-08-04 (web): **Arena HUD precision layout + weapon crosshairs +
  avatar picker in game rooms.** Screenshots showed the right-side action
  cluster colliding with the minimap/Menu/ownership chip in landscape and
  the fire button clipped at the screen edge — combat buttons are now
  individually placed (🔫 left of jump, 🔄 above it, 🎯 above jump, 🧎
  between fire and joystick) and 🏆/📣/🏙 moved into the top-left panel as
  a compact row joined by a new 👤 ရုပ်ပြင် button that opens the existing
  metaverse AvatarCustomiser (full body/colour/outfit selection) straight
  from game rooms. Per-weapon crosshairs (gap cross for pistols, wide for
  SMG, circle for shotgun, fine for sniper, dot/◎ for knife/bomb; ADS
  tightens the gap), an iron-sight edge-dim vignette for non-sniper ADS,
  hit motion graphics on victims (impact sparks + red ring, dark-red kill
  ring — new combatfx.impact), FP head-bob while walking and a sprint FOV
  widen (+5°) for movement feel. Movement fix from the follow-up report
  ("walking reversed / anatomy wrong"): in the arena the body now always
  faces the aim direction even in third person (PUBG convention) instead
  of spinning 180° to run at the camera when back-pedalling, and
  human.ts gained a `backward` state that reverses the leg-swing cycle so
  back-pedalling no longer moonwalks (applied to self and remotes).
  PR #466.

- 2026-08-04 (web): **Arena PUBG-standard combat.** The real "can't shoot"
  root cause: the server rays from the *player's eye* (combat.js EYE_Y) but
  the client sent the *camera's* direction — in third person the camera sits
  behind and above, pitched down, so the server ray dove into the ground and
  never hit anyone. Fire now converges the crosshair ray to the player eye
  (accurate in both FP and TP). Grenades were also exploding at the
  thrower's own feet because the client never sent the aFire target x,z —
  now throws to the aimed point (15u), and the previously-unhandled aBoom
  event renders a double shockwave ring + flash + distance-scaled screen
  shake. PUBG-style controls: hold-to-auto-fire at each weapon's server
  fireMs (client pre-cooldown), right-click-hold / 🎯 button = ADS with
  per-weapon FOV zoom (sniper 18° + full scope overlay with reticle lines),
  aim sensitivity scales with FOV, per-weapon camera recoil kick, mouse
  wheel cycles weapons in-arena (Q = previous, 1-7 direct), 🧎 crouch
  toggle for touch, damage numbers (-34) beside the crosshair, and a red
  direction arrow showing where incoming fire came from. Esc/pointer-lock
  exit clears held fire + ADS. Controls documented in the HUD help panel.
  PR #465.

- 2026-08-04 (web+server): **Arena playability overhaul — walk fix, combat
  feedback, keyboard controls, scoreboard, team play.** Root cause of
  "can't walk in arena": every game-layer teleport (assassin spawn on
  aJoin, respawn, round reset) moved the client without updating presence,
  so the next `update` tripped the anti-cheat speed check and rubber-banded
  the player back (`syncPresence` in server.js now syncs presence on all
  three teleport paths). Per-room `worldR` override added (gwave-city 120)
  because its walkRadius 114 exceeded the global 90 bound — walking the
  city edge no longer rubber-bands. Combat feel: new pooled combatfx.ts
  (tracers, muzzle flash light, spawn rings) + the assassin Web-Audio sfx
  (shots per weapon, hit markers, hurt, kill/win jingles, empty-click,
  reload) wired into the metaverse arena — local fire feedback is instant,
  remote aShot events render tracers from the shooter. HUD rebuilt so no
  pointer-events-auto container ever covers the joystick: weapons strip
  (1-7 numbered) top-center, ❤️/ammo read-only bottom-center (emote bar
  hidden in game rooms), fire/reload/scoreboard/invite/exit as a
  thumb-reach cluster above the jump button; hit-marker ✕, red damage
  vignette, center kill/win/respawn banners, hold-Tab (or 🏆) scoreboard.
  Keyboard: click=fire (auto first-person on arena entry), R=reload,
  1-7=weapon switch, Tab=scoreboard, documented in the HUD help panel.
  Team play: 📣 invite button shares a `/metaverse?room=` deep link (the
  scene now honors `?room=`), scoreboard doubles as a roster, chat/voice
  stay available in game rooms. PR #464.

- 2026-08-04 (web+server): **Gwave City — Kenney 3D kit showcase world.**
  The map engine gained GLB model support (`MapDef.models` + a lazy
  GLTFLoader in world.ts: per-URL cache, clones, shadows, instant AABB
  colliders so walls work before downloads finish, progressive pop-in,
  broken files skipped without killing the world). New 🌆 Gwave City world
  (room `gwave-city`, social): two commercial avenues + a skyscraper
  skyline, an industrial district (factories, chimneys, tanks), a fantasy
  market quarter (fountain, stalls, carts, wind/water mill, lanterns) and
  a statue plaza of 10 blocky characters — 103 CC0 Kenney GLBs under
  public/metaverse/kits (~9 MB, license note included). Every placement
  width comes from a measured manifest (gltf-transform scan), laid out by
  shelf-packing along streets — models are never stretched. Domino pack
  had no GLB export and the animated character packs are FBX-only rigs;
  both noted for a later conversion pass.

- 2026-08-04 (web): **Hide-and-seek became a full metaverse world + Gwave
  branded loading.** 🙈 ဝှက်တမ်းဥယျာဉ် (room `hide-1`) is now the 6th
  world in the map picker — garden-maze map (hedges, huts, pond, trees),
  full standard functions (avatars, chat, presence, weather, day cycle)
  because it IS a metaverse room; the hide game layer rides the same
  socket via gJoin/gState/gEvent (positions come from normal presence —
  the server already syncs them into the match). HUD: phase banner with
  live countdown, seeker/hider role chip, seeker blind-phase blackout,
  tag button (nearest player, server re-checks TAG_RANGE), feed, exit.
  The amber /games/arena portal in the picker was removed (superseded by
  the world entry). Every world/game entry now shows a Gwave-branded
  loading screen (logo + GWAVE wordmark + Burmese tagline) until the
  socket is live — shared component also used by the standalone
  /games/arena page.

- 2026-08-04 (web+server): **Arena joined the hub world (Roblox model).**
  The metaverse map picker now carries a 5th world — ⚔️ ပွဲကွင ်း (`arena`
  room, type `game`, 18+, gameMode assassin). One server (same WS), one
  avatar (the player's metaverse avatar walks into the arena), one Cognito
  login, no page reload — the combat layer (aJoin/aMove/aFire over the SAME
  socket via the new `sendRaw`/`onRaw` game-layer hooks in net.ts) is
  simply added on top of the normal presence protocol, and combat stays
  server-authoritative (A4 ray resolution + applyMove anti-cheat).
  In-scene HUD: crosshair, weapon row, hp/ammo, fire/reload (touch + CS
  pointer-lock click), kill feed, target chip, death state, and a
  return-to-city button; 18+ denial (WS close 4005/4006) renders a proper
  gate screen instead of a silent retry loop. Social rooms keep ZERO combat
  (server refuses combat messages by room type — unchanged). The separate
  /games/assassin page still works (rooms assassin-1..3 are distinct from
  `arena` so the two client protocols never share a match); retiring it is
  the spec's later phase.

- 2026-08-04 (web): **CCTV vendor-cloud playback sessions (PR 3 of 4).**
  `src/lib/cctv/camera-service.ts` is now the ONE authorization + dispatch
  path for playback: resolve camera → `canViewCamera` (owner / public
  window / share token; vendor-cloud cameras stay owner-only unless the
  provider's `publicSharingAllowed` capability is explicitly true — the
  owner's public toggle cannot override vendor terms) → per-type session.
  New routes, all rate-limited + `no-store`: `POST
  /api/cctv/cameras/[id]/stream` (short-lived normalized session; never a
  vendor token or raw RTSP), `GET .../snapshot` (owner-only, capability-
  gated — what camera walls should poll instead of auto-live), `POST
  .../ptz` (owner-only + explicit ptz capability). Client:
  `VendorCameraPlayer` renews 30s before expiry, bounded backoff (2/4/8s
  then manual retry), relink/offline/gateway states; camera detail page
  dispatches vendor cameras to it; the wall keeps showing an open-tile for
  them (no auto vendor sessions). 10 new playback unit tests (public-share
  matrix) + 2 more e2e guards. Behind the same OFF flag as PR 1-2.

- 2026-08-04 (web): **CCTV vendor-cloud account linking (PR 2 of 4).**
  Routes: `/api/cctv/vendors` (list), `[provider]/connect` (state + PKCE in
  an HTTP-only cookie bound to user+provider, 10-min expiry),
  `[provider]/callback` (every validation failure is a hard stop; connected=1
  only after the DB writes), `[provider]/cameras` (fresh-token discovery
  with a 60s cache + refresh-race protection), `[provider]/import`
  (candidates re-validated against the account, sanitized data only) and
  `[provider]/disconnect` (revoke → delete secrets → mark disconnected).
  UI: "Connect vendor account" section in the add-camera form (self-hiding
  while the flag is off), `/cameras/vendors/[provider]` import page with
  capabilities badges and the local-gateway recommendation. en+my strings.
  All endpoints FAIL CLOSED when the `cctv_vendor_cloud` flag is off or
  unreadable — 5 new Playwright guard tests pin that; 10 new oauth-state
  unit tests cover the CSRF/login-CSRF/expiry failure modes. No schema
  change (PR 1's migrations already applied on RDS). Still nothing
  user-visible in production until the flag is switched on AND a provider
  is configured (fake = dev only, Hikvision = stub until partner approval).

- 2026-08-04 (web): **CCTV vendor-cloud framework (PR 1 of 4) + post-RLS
  regression fix.** Groundwork for linking approved camera-vendor cloud
  accounts (docs/tasks/VENDOR_CLOUD_CAMERA_INTEGRATION.md): `vendor_cloud`
  camera type, `camera_vendor_connections` (owner-readable metadata, zero
  client write paths) + `camera_vendor_secrets` (sealed: RLS with no
  policies, grants revoked, AES-256-GCM ciphertext keyed by
  `CAMERA_VENDOR_TOKEN_KEY_V1` in `/etc/gwave-web.env`), vendor columns on
  `user_cameras`, connector interface + registry mirroring the health
  providers, a deterministic fake connector (dev/test only, hard-rejected in
  production) and a Hikvision typed stub that stays disabled until approved
  partner credentials + a signed-off docs/cctv/VENDOR_FEASIBILITY.md exist.
  Feature flag `cctv_vendor_cloud` seeded OFF. Routes/UI come in PR 2-3.
  **Applying the three new migrations on RDS is pending (user-side, then
  `sudo docker restart postgrest`).** While validating, the RLS audit caught
  a real regression: `20260711110000_fix_post_rls.sql` had rewritten the
  posts INSERT policy and dropped the suspension / group-membership /
  page-owner guards — suspended users could post again.
  `20260804092000_restore_post_insert_guards.sql` restores all three
  (audit now fully green on a scratch replay of every migration).

- 2026-08-04 (ship): **PR #456 squash-merged to main (`fea470c`) and deployed.**
  Assassin hit registration is now **server-authoritative** (Arena spec A4):
  the client sends only its camera-ray direction (`aFire {dx,dy,dz}`);
  `server/metaverse/combat.js` casts the ray from the server's own shooter
  position + eye height against hitboxes pinned to the client toon model
  (head sphere r0.28 @ y1.62, body capsule 0.33–1.23 r0.34, no legs box).
  `targetId`/`hitPart` claims from the client are ignored, so hit-part
  spoofing, shooting through your own back and origin spoofing are dead —
  a mutation test proves the guard is load-bearing. Also on this train:
  Arena groundwork A1/A2/A3/A5 (game-room types, arena map, match lifecycle,
  20 Hz snapshots + interest management), hide-and-seek mode (`hide-1/2`,
  no combat), and the `/games/arena` client (prediction/reconciliation/
  interpolation, three.js scene). Web deploy + metaverse container rollout
  both succeeded on `fea470c`; health checks green. APK **v1.0.269**
  published to `mobile-latest`.
- 2026-08-02 (ship): **PR #451 squash-merged to main (`02aaf31`) and deployed.**
  FPV drone mesh + chase camera + calibration wizard + aerodynamics + DJI
  Avata 2/O3/O4, metaverse category settings menu, car wheel hub groups and
  the steering sign fix, native Help screen, `gw_embed` cookie that hides site
  chrome inside the app's WebViews, and the `service_role` probe that now
  gates `/api/health` plus per-stream `/api/live/[id]/diagnose`. Deploy run
  succeeded (ECR image + `gwave-redeploy` via SSM). APK **v1.0.266**.
  `db/sql/web3.sql` applied on RDS the same day. **The `metaverse` container
  still needs a manual rebuild** — the Assassin match server lives in
  `server/metaverse/**`, and that path only deploys by hand (see above).
- 2026-08-02 (web+server): **Web3 phases W1–W8 implemented, still dormant.**
  The mint queue used to stop at `sent`, which only means "handed to the
  chain" — a reverted, dropped or reorged transaction looked successful
  forever; it now waits for three confirmations and retries reverts and
  mempool drops. `viem` was never a dependency of the metaverse server, so
  Web3 had been silently disabled in production. Ownership now answers from
  an RDS mirror built by a `Transfer` indexer (12-block reorg buffer,
  resumable) with RPC fallback behind a circuit breaker. Onboarding adds
  Coinbase Smart Wallet passkeys, lazy-imported. SIWE messages carry domain
  and chain id, nonces expire in five minutes, one wallet links to one
  account, and unlinking is possible. The ownership UI is a gold-on-blue
  layer with a bottom sheet, staged progress and Burmese copy that never
  says wallet/sign/gas/mint (a test enforces it). `db/sql/web3.sql` is
  **APPLIED on RDS** (4 tables, RLS sealed, `service_role` grants only);
  nothing mints until contracts and envs exist.
- 2026-08-02 (web): **FPV Simulator gets aircraft types + game modes.** Three
  airframes with distinct physics — quads, fixed-wing planes (airspeed² lift,
  airspeed-scaled control authority, stall, low-friction ground roll) and
  helicopters (linear collective so ~half throttle hovers) — each with its own
  procedural model. Six game modes: free fly, 3-lap race with gate markers,
  checkpoint rush, balloon hunt, timed strike mission, landing challenge; each
  drives a mission bar and a results overlay, and final scores sync via
  `/api/games/progress`. The Controller tab documents binding an EdgeTX radio
  over USB/BT HID, why ELRS/Crossfire are RF links a browser cannot read, and
  HDMI-in goggle options. (#446, #447)
- 2026-08-02 (web+db): **Cross-device game progress + daily quests.** New
  `game_progress` table (sealed RLS, service_role only — **APPLIED on RDS**)
  behind `/api/games/progress`, upserting `best = greatest(old, new)` with a
  jsonb merge so a stale device can never lower a score. Four daily quests
  span Edu Arcade, FPV and the metaverse, counters merged by max, offline-first
  on localStorage with guests unaffected. (#445)
- 2026-08-02 (web): **Edu Arcade — 10 three.js educational games at
  `/arcade`.** One engine (emoji/text canvas textures, tap raycast for mouse
  and touch, confetti, shake, WebAudio synth) hosts math, counting, odd/even,
  animal/fruit/flag matching, colour names, hex colour, word builder and
  memory match. Replaces the dated HTML learning games. (#444)
- 2026-08-02 (web): **FPV Simulator shipped at `/fpv`.** 240 Hz fixed-substep
  quad physics with betaflight rate curves, 8 drones, 4 flight modes, 6 maps,
  keyboard/touch/Gamepad input, and multiplayer over `fpv-*` rooms on the
  metaverse WS server. (#442)
- 2026-08-02 (web+infra): **Metaverse multiplayer works without a new DNS
  record.** The client now falls back to `wss://<host>/mv/ws` and Caddy routes
  `/mv/*` to the metaverse container on the same box, so `mv.gwave.cc` is no
  longer needed. Landscape phones regained the joystick (touch detection, not
  width), the left HUD became a non-overlapping accordion, first-person view
  and CS-style movement (default run, Shift walk, Ctrl crouch, pointer-lock
  aim) landed. (#441)
- 2026-08-02 (ci): **Deploys stopped reporting false failures.** The redeploy
  step used `aws ssm wait`, which gives up after ~100 s while a fresh image
  pull is still running; it now polls the invocation for up to 12 minutes and
  exits on any terminal status. (#443)
- 2026-08-02 (web): **Metaverse — phases 9-13, weather, water, fire, vehicles,
  CI.** Rain and snow follow you inside a 30×20×30 box that recycles particles
  out the bottom and back in the top, so 4 000 points cover a 200-metre world
  instead of the millions real coverage would need; storms flash the ambient
  light every 5-15 seconds; the sky islands get an aurora. **The weather is the
  server's**, sent in `init` and re-rolled every 5-15 minutes per room from
  that map's allowed list — a client rolling its own would put two people
  standing together in different weather. Water is a real obstacle (wading
  halves your speed, boats will not climb ashore, cars will not drive in) and
  fire flickers its light on two sine waves plus noise, because a steady glow
  reads as a torch, not a fire; rain halves it. Six vehicles — car, boat,
  horse, drone, snowmobile, balloon — built from primitives, no physics engine,
  arcade numbers, and **no turning while stopped**. The driver's own client
  computes the position and the server relays it with a speed cap and a
  one-driver lock; losing your connection frees the vehicle.
  **A 40% frame-rate cliff, found by measuring**: adding this phase took two of
  the four maps from 20 fps to **0**. Three causes, all real on phones —
  `computeVertexNormals()` on every water vertex every frame; six fire
  PointLights lighting every pixel at once (now the nearest two); and PBR
  `MeshStandardMaterial` on map-spanning transparent rivers and on a hills
  mesh drawn *on top of* the ground disc it was supposed to replace. All four
  maps are back at 20 fps in software GL.
  `.github/workflows/metaverse-server.yml` builds, pushes and deploys on
  changes under `server/metaverse/**` using **OIDC, not access keys**, waits
  for the service to stabilise and then curls `/health` — a green tick that
  did not check would be worse than none. `docs/METAVERSE-TESTING.md` is the
  pre-deploy checklist. 35 server tests pass.

- 2026-08-02 (web): **Metaverse — phase 8, four worlds from data files.** The
  world engine no longer knows anything about Gwave City. `world.ts` reads a
  `MapDef` and builds it; what is in a map lives only in
  `src/components/metaverse/maps/*.ts`. Adding a fifth world means writing one
  data file and registering it — the engine is never touched again.
  Four maps ship: 🏙️ မြို့တော် (neon city, live screen), 🌾 စိမ်းလန်းချိုင့်ဝှမ်း
  (rolling farmland, greenhouse wired to the hydroponic dashboard), ❄️
  နှင်းတောင်ထိပ် (snow peaks, thick fog that is both a mood and a frame-rate
  saving), and ☁️ ကောင်းကင်ကျွန်းများ (seven islands floating in a pink sky).
  A 🌍 button switches between them; each is a separate server room, so the
  people in one cannot see the people in another, and the choice is remembered.
  Twenty rooms are enterable — walls built as a shell with the doorway left out
  of the collider, so you walk straight in with no loading screen — and their
  furniture only renders within 25 m.
  **Two things the screenshots caught that types could not**: the sky map drew
  the full ground disc under the islands, so seven floating islands read as
  rocks on a lawn — the giveaway that the whole point of the map was gone; and
  the live screen was built into every map, so a 16-metre advertising hoarding
  stood on the snow peak. Both fixed, plus a walkable radius so you cannot
  stroll off a floating island into open sky (island-to-island travel is drones,
  phase 11).

- 2026-08-02 (web): **Metaverse — phase 7, Web3 as a side door.** Wallets are
  an addition, never a requirement: with no wallet, no RPC and no contracts
  the world is exactly as complete as before — verified by walking it with
  none of them configured. Signed-in users get a "Wallet ချိတ်မယ်" button that
  runs the four-step SIWE flow: the server mints a single-use nonce, the wallet
  signs a **readable Burmese sentence** (not an opaque hex blob — teaching
  people to sign things they can't read is how they get drained), the server
  recovers the address with viem and compares it, then closes the nonce with
  `update … where used_at is null` so two simultaneous requests can't both win.
  Gwave never sees a private key or seed phrase.
  Token-gated rooms are decided **only on the server**: `room=vip` looks up the
  wallet linked to the account in the database — never one the client sends,
  or anyone could claim someone else's NFT — and asks the chain. No wallet is
  4003, no NFT is 4004, and if the RPC is missing or down it refuses rather
  than admits, because a gate that opens when the check fails is not a gate.
  Five new tests connect straight to the WebSocket with `room=vip`, which is
  what an attacker would do rather than pressing a hidden button.
  `GwaveLand.sol` (ERC-721, `tokenId = gx*32 + gz`, so a plot can never be
  minted twice) and `GwaveItems.sol` (ERC-1155) are in `contracts/`, undeployed.
  **Deviation from the spec, deliberate**: it specifies wagmi + @web3modal;
  this uses the injected EIP-1193 provider instead. WalletConnect needs a cloud
  project id nobody has yet and could not be tested here, the three packages
  add ~300 KB for a feature most people won't touch, and the wallets actually
  used around Mae Sot are MetaMask/Trust/Coinbase in-app browsers, which inject
  `window.ethereum` already. Only `connect()` would change if WalletConnect is
  added later — the nonce → sign → verify flow is untouched.
  Verified with real secp256k1 keys: a valid signature passes, another
  wallet's signature for the same address fails, a one-character change to the
  nonce invalidates it, and claiming the same nonce twice returns nothing the
  second time. **Not deployed**: no contracts on chain, no `WEB3_*` env set —
  `contracts/README.md` has the Foundry commands, testnet first.

- 2026-08-02 (web): **Metaverse — phase 6, performance and scale.** The old
  phone in Mae Sot is the target, not the desktop. Distant avatars stop
  animating past 45 m and stop drawing past 90 m; nametags are DOM elements
  moved with `transform` (never `left`/`top`, which would reflow the page 500
  times a second) and fade out between 28 m and 40 m; shadows have a switch;
  and if the frame rate stays under 25 for three consecutive seconds the world
  turns bloom and shadows off and drops to pixel ratio 1 by itself, says so,
  and offers a button to undo it. The automatic downgrade never overwrites the
  player's own saved preference — a better phone next time gets their choice
  back.
  **The measurement that mattered**: a 200-bot load test pinned a whole core
  at 98%. Every player's move was its own message to every other player —
  n², 562 629 sends per second. Batching positions into one `updates` array
  per room per 15 Hz tick took the same 200 bots to **9.4% CPU and 4 059
  messages/s**, and 800 bots now sit at 70%. One task holds roughly 600
  players, not the 200 the spec assumed. `node server/metaverse/loadtest.js`
  reproduces it.
  Beyond one task, `REDIS_URL` (ElastiCache) shares room state: each task
  subscribes to `mv:{room}`, republishes its own player list every 5 seconds —
  without that a task starting fresh would never see anyone standing still —
  and drops players it has not heard about for 15 seconds, so a task dying
  does not leave ghosts. Redis being down degrades to single-task, never to a
  dead world. Five new tests run two servers against a real Redis and check
  they see each other, chat across, and still keep rooms apart.
  **User-side**: create the ElastiCache cluster and put `REDIS_URL` in Secrets
  Manager (`gwave/MV_REDIS_URL`) — the task definition already references it —
  then register the autoscaling target and the 65% CPU policy. Commands in
  `server/metaverse/README.md`.

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
- 2026-08-01 (web): **Browser lives are recorded on their channel, like every
  other broadcast.** Writing the replay straight from the composition never
  worked once on this account: every composition carrying both a channel and an
  S3 destination came back channel `ACTIVE`, S3 `FAILED` with no `startTime` —
  rejected before it began, with and without a bucket policy, sharing an
  encoder configuration and not. Channel recording has been working the whole
  time (it is where phone broadcasts' replays come from), and the composite
  already arrives at the watch channel — so that channel is now created with
  the recording configuration attached when the host asked for a replay, the
  S3 destination is gone, and the existing sweeper links stage rows exactly
  like any other. One mechanism, both kinds of live.
- 2026-08-01 (web): **The host could not see their phone viewers.** The web
  viewer count came only from a Realtime presence channel, which the Flutter
  app never joins — so a host broadcasting from a browser read "1 viewer" while
  two phones watched. `live_heartbeat()` already *returns* the real count (both
  clients call it; it counts presence rows from the last 25s) and the return
  value was being discarded. The badge now shows the larger of the two.

- 2026-08-01 (web): **The recording destination can have its own encoder.**
  A composition with a channel destination and an S3 destination sharing one
  encoder configuration came back with the channel `ACTIVE` and the S3
  destination `FAILED` — no `startTime`, so rejected before it began, with the
  same encoder working for the channel a second later. The only composition
  that ever recorded successfully had a single destination. Optional
  `IVS_RT_S3_ENCODER_CONFIG_ARN` points the recording at a second encoder
  configuration; unset, nothing changes.

- 2026-08-01 (web): **Three compositions on one stage.** `goLive` runs every
  time the host's browser joins — a reload, a reconnect, a second tab — and
  each run started another IVS composition on the same stage. IVS composites a
  stage once: the first keeps working, every later one FAILS outright.
  Production had three inside a minute from a single broadcast. goLive now
  starts one only when the row has none.

- 2026-08-01 (web): **A composition ARN is not a composition.** `StartComposition`
  returning an ARN says only that IVS accepted the call. Start one a second too
  early — before the host's camera is publishing — and IVS looks at the stage,
  finds nothing to compose, and gives up within a couple of seconds. The row
  keeps the ARN of something that no longer exists, so the sweeper's
  "start compositions for stages that have none" pass skips it forever: the
  broadcast plays fine and is recorded nowhere. The sweeper now asks IVS what
  each live stream's composition is actually *doing* and clears the ARN when it
  is FAILED or gone, so the next pass starts a fresh one — with a host who is
  by then definitely publishing.

- 2026-08-01 (web): **Two buckets, and only one of them was ever read.** IVS
  writes channel recordings to `IVS_RECORDING_BUCKET` and composite
  (browser-broadcast) recordings to whatever the Real-Time *storage
  configuration* names — a different bucket. Nothing said so, so every browser
  replay was looked for in the channel bucket, where it had never been. The
  composite bucket is now resolved by asking `GetStorageConfiguration` (cached;
  storage configurations are immutable), so there is no second env var to keep
  in sync and the read always follows whatever `IVS_RT_STORAGE_CONFIG_ARN`
  points at. `/recordings/[...path]` picks the bucket from the key's own shape:
  `ivs/…` is a channel recording, anything else is a composite.

- 2026-08-01 (web): **The replays were in S3 the whole time; nothing could
  name them.** IVS hands back the recording's S3 prefix when a composition
  starts and then deletes the composition record shortly after it stops — so
  the sweeper's `GetComposition` answered `Resource: ...composition/tcs3RASP3Asy
  not found`, four broadcasts running, and every one of them had recorded
  correctly. The prefix is now written to `live_streams.ivs_recording_prefix`
  the moment the composition starts, and stop/sweep read the manifest straight
  from it. Rows that predate the column fall back to `GetComposition` and then
  to searching the stage's own subtree in S3, so the stranded ones are
  recoverable too. The prefix is written in its own statement, never bundled
  with `ivs_composition_arn`: losing the ARN costs the whole broadcast its HLS
  output, losing the prefix costs one replay.
  Needs `supabase/migrations/20260801020000_live_ivs_recording_prefix.sql` on
  RDS + `docker restart postgrest`.

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
