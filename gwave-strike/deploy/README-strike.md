# GWAVE STRIKE — deployment (gwave.cc/strike, same app EC2 box)

STRIKE runs as the `strike` docker container on the SAME EC2 box as the web
app — no separate host, no game.gwave.cc DNS, no extra GitHub secrets. The
original separate-EC2/nginx plan below was dropped in favor of this.

- **Pipeline**: `.github/workflows/deploy-strike.yml` — on every `main` push
  touching `gwave-strike/`, builds the Dockerfile (client with vite
  `base=/strike/` + Colyseus server serving those static files), pushes to
  ECR `gwave-strike`, and rolls it out over SSM with a health-gated rollback
  (mirror of `metaverse-server.yml`).
- **Container**: `strike`, `127.0.0.1:8095`, `PORT=8095`. No secrets needed.
- **Caddy** (one-time, on the box — already in `deploy/Caddyfile`):

  ```
  redir /strike /strike/ permanent
  handle_path /strike/* {
      reverse_proxy 127.0.0.1:8095
  }
  ```

  Add inside the `gwave.cc { … }` block of `/etc/caddy/Caddyfile`, then
  `sudo systemctl reload caddy`.
- **Health**: `https://gwave.cc/strike/health` → `{"ok":true,...}`. The
  workflow warns (not fails) when only this domain check misses — that means
  the Caddy route above hasn't been added yet.
- **Client/WS routing**: the page, `/matchmake/*` and the room WebSockets all
  ride the same `/strike` prefix; `handle_path` strips it and the container
  sees clean paths. Offline (server down) the client falls back to local
  bots automatically.

## Optional asset work (unchanged)

- Mixamo soldier model: `tools/merge-animations.md`, then flip `SOLDIER_URL`
  in `client/src/main.ts` to `/assets/soldier.min.glb` (BASE-prefixed
  automatically).
- CDN offload for heavy GLBs: build with `VITE_ASSET_BASE` once needed.
