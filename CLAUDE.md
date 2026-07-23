# Gwave — rules for every Claude session

Gwave is a live production super-app: https://gwave.cc (Next.js) plus a native
Flutter Android app (`mobile/`). Real users are on it. Every Claude session —
CLI, web, or otherwise — MUST follow these rules so sessions never diverge or
undo each other's work.

## Coordination protocol (read this first)

1. **Read `docs/STATUS.md` before starting work.** It holds the live system
   state, in-flight work, and known issues. Update it (state + changelog) when
   you finish anything significant.
2. **Check open PRs before starting a feature** — someone (or another session)
   may already be on it. Never run a parallel effort on the same feature.
3. **One app, one pipeline, one release.** The mobile app is `mobile/`, built
   only by `.github/workflows/build-flutter-apk.yml`, published only to the
   rolling `mobile-latest` release. Never scaffold a second app, workflow, or
   release channel.
4. Talk to the user in Burmese; write code/comments/commits in English.

## Branch & deploy model

- **`main`** is the source of truth. Server changes go on short-lived branches
  off `main` → PR → squash-merge **only after** the "Lint, Typecheck & Build"
  and "Smoke E2E" checks pass (a Vercel preview alone is NOT green).
- **`claude/phase-1-implementation-7ysxtj`** is the active mobile dev branch
  (= main + mobile commits). Mobile work is committed there directly; merge
  `origin/main` into it periodically to keep it current.
- Merging to `main` auto-deploys: the deploy workflow builds the image to ECR
  and runs `/usr/local/bin/gwave-redeploy` on the EC2 box via SSM.
- **Runtime server env lives in `/etc/gwave-web.env`** on EC2 (the file
  `deploy/gwave.override.env` is legacy — the prod redeploy script does NOT
  read it). `NEXT_PUBLIC_*` vars are baked at image build time; everything
  else is read at runtime, so env-only changes need just `sudo gwave-redeploy`.

## Data layer

- Postgres on RDS behind **self-hosted PostgREST** (`gwave.cc/sb`) and
  **self-hosted Realtime** — this is NOT Supabase cloud; `SUPABASE_*` names
  are historical.
- The Claude container cannot reach gwave.cc or RDS. All server SQL runs on
  EC2 by the user:
  `DBPASS=$(sudo cat /root/gwaveadmin_newpw.txt)` + dockerised `psql`
  (never hardcode the password), then `sudo docker restart postgrest` after DDL.
- **Never use PostgREST resource embeds in hot-path client queries** — a stale
  schema cache 500s them and features die silently (messenger, notifications,
  call ring verification all hit this). Use flat queries and assemble in code.
- Auth is Cognito (pool ap-southeast-1_krSbdHFs9). `custom:profile_id` is the
  authoritative account link. **Never back-fill it when a lookup FAILS** —
  only when it is definitively absent (helpers return `undefined` = failure,
  `null` = absent). Violating this has already destroyed user accounts once.

## Mobile app (Flutter, `mobile/`)

- Signed with the `gwave-upload` keystore via `ANDROID_KEYSTORE_BASE64` /
  `ANDROID_KEYSTORE_PASSWORD` secrets; CI falls back to debug signing with a
  warning if they're absent.
- `versionCode` = CI run number; `--dart-define=APP_BUILD=<run>` powers the
  in-app update banner; the Settings screen footer shows `Gwave v1.0.<build>`
  — always ask users for that number when debugging.
- Users download from `gwave.cc/welcome` (`/download/apk?abi=...` streams the
  release assets through the domain).

## Realtime features

- **Calls**: WebRTC with Realtime-broadcast signaling (`calls:{userId}` ring
  inbox, `call:{callId}` per-call). ICE config comes from `/api/webrtc/ice`
  at call time — runtime envs `TURN_URL` / `TURN_USERNAME` / `TURN_CREDENTIAL`
  point at the coturn container on the EC2 host (ports 3478 udp+tcp, relay
  49160-49200 udp — these are open in the security group). Without TURN,
  carrier-NAT calls connect but stay silent.
- **Live**: browser Go Live publishes to LiveKit Cloud (`livekit_room`); the
  app broadcasts via IVS RTMPS; the app watches LiveKit lives through
  `/api/mobile/live/token`, which also self-heals stale `live` rows when the
  host has left the room.
- **Presence**: `profiles.last_seen_at` heartbeat (app 60s timer, web
  `/api/heartbeat`); online = seen within 2 minutes.

## Commands

- Server typecheck: `npx tsc --noEmit` (worktree needs `node_modules`
  symlinked from the main checkout).
- Never commit conflict markers — after any merge run `git grep '^<<<<<<< '`.
