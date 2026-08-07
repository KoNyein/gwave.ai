# Gwave Open World — server pair (`world` container)

The Open World client lives in `public/world/` (gwave-metaverse-base v5,
user-authored framework: Cyber-Yangon night market, Hydro-Lab, Mae Sot GLB
map, STRIKE PvP arena) and is served by the web app at `/world`
(`src/app/world/page.tsx` fetches a Cognito idToken from
`/api/world/token`, then opens `/world/index.html?token=…`).

This folder is the backend pair it talks to, built into ONE container:

| port | process            | Caddy route                     |
|------|--------------------|---------------------------------|
| 8787 | `server/server.js` | `wss://gwave.cc/world-ws`       |
| 8788 | `api/server.js`    | `https://gwave.cc/world-stats/*`|

- **Game server** — room-aware presence sync (15 Hz), server-authoritative
  PvP (150 ms lag rewind, movement/fire-rate validation), Cognito JWT auth
  (`AUTH_MODE=cognito`, JWKS), kill reports to the stats API.
- **Stats API** — kill/XP into RDS Postgres `game.*` tables (self-migrating
  on boot; memory fallback without DB). `GET /leaderboard` is public.

## Deploy

`.github/workflows/deploy-world.yml` (ECR → SSM, mirrors deploy-strike.yml)
runs on every push to `main` touching this folder. The FIRST deploy also:

1. bootstraps `/etc/gwave-world.env` on the box — Cognito ids come from
   `/etc/gwave-web.env`, the DB password from `/root/gwaveadmin_newpw.txt`,
   `GAME_KEY` is freshly generated. No secret ever leaves the machine.
2. inserts the two Caddy routes next to the existing `handle_path /strike/*`
   handler (validate + reload, restores the backup on failure).

Nothing manual is required. To force new env values, delete
`/etc/gwave-world.env` on the box and re-run the workflow.

## Local dev

```bash
cd server && npm install && npm start            # ws :8787, AUTH_MODE=off
cd api && npm install && npm start               # http :8788, memory mode
npx serve ../../public/world                     # client, then open
#   http://localhost:3000?server=ws://localhost:8787
```
