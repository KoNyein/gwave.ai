# GWAVE DRONE multiplayer server — EC2 runbook

The drone game's online layer is one container (`drone`) on the same app box:

- `:8787` — authoritative ws game server (rooms, lag-comp hit validation,
  16 players/room), published to `127.0.0.1` only
- `:8788` — REST api (`/health`, `/leaderboard`, `/me`, `/me/drone-config`,
  `/report`), published to `127.0.0.1` only

Deployed by `.github/workflows/deploy-drone-server.yml` (ECR
`gwave-drone-server` → SSM, health-gated with rollback), sharing
`/etc/gwave-web.env`.

## One-time setup

1. **RDS migration** — run `gwave-drone-server/migrations/001_game_schema.sql`
   against the `gwave` db (dockerised psql pattern; see docs/STATUS.md).
   Creates schema `game`: players, matches, match_players, items, inventory,
   drone_builds + leaderboard view.

2. **Env** (`/etc/gwave-web.env`):
   - `AUTH_MODE=gwave` — verifies the web session's `gw_at` data token
     against `APP_JWT_PUBLIC_JWK` (already present for the web app);
     identity = profiles.id
   - `GAME_DATABASE_URL=postgres://gwaveadmin:<pw>@<rds-host>:5432/gwave`
   - `GAME_KEY=<random 32 chars>` — game-server → api shared secret for
     `/report`
   - `API_URL=http://127.0.0.1:8788` (in-container default already correct)

3. **Caddy routes** (inside the `gwave.cc {}` site block):

   ```caddyfile
   handle /drone-ws {
     reverse_proxy 127.0.0.1:8787
   }
   handle_path /drone-api/* {
     reverse_proxy 127.0.0.1:8788
   }
   ```

   then `sudo systemctl reload caddy`.

4. Re-run the deploy workflow (or `docker rm -f drone` + re-deploy) after env
   changes — `docker restart` does NOT re-read `--env-file`.

## Client wiring

`public/drone/` auto-targets the same origin when not on localhost:
api `/drone-api`, ws `wss://gwave.cc/drone-ws`, token from the `gw_at`
cookie (falls back to `?token=` / localStorage `gwave_token`). Overrides:
`?server=` and `?api=` URL params.

## Verify

```bash
curl -s http://127.0.0.1:8788/health          # {"ok":true,"service":"gwave-drone","authMode":"gwave"}
curl -s https://gwave.cc/drone-api/health      # same, through Caddy
curl -s https://gwave.cc/drone-api/leaderboard # [] until players exist
```

In the game: ONLINE button (top right) → "Online ဝင်ပြီး — Room: valley".
