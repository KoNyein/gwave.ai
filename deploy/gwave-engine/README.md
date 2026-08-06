# gWave Engine world server — EC2 runbook

Multiplayer for the gWave Game Engine (`/engine`): one `engine-server`
container, ws + `/health` on `127.0.0.1:8789`, deployed by
`.github/workflows/deploy-engine-server.yml` (ECR `gwave-engine-server` →
SSM, health-gated with rollback), sharing `/etc/gwave-web.env`.

Protocol: join → welcome/snapshots at 20Hz, envelope speed validation
(teleports snap back), chat relay. Rooms auto-create and GC when empty.
`AUTH_MODE` (off | gwave | dev | cognito) comes from the shared env —
`gwave` verifies the web session's `gw_at` token like the drone server;
`off` (default) allows anonymous sandbox play.

## One-time setup

Caddy route (inside the `gwave.cc {}` site block):

```caddyfile
handle_path /engine-ws* {
  reverse_proxy 127.0.0.1:8789
}
```

then `sudo systemctl reload caddy`. The client auto-targets
`wss://gwave.cc/engine-ws` when not on localhost (`?server=` overrides).

## Verify

```bash
curl -s http://127.0.0.1:8789/health          # {"ok":true,"service":"gwave-engine",...}
curl -s https://gwave.cc/engine-ws/health      # same, through Caddy
```

In the engine: 🌐 Online button → "🌐 Online — room: world"; a second
browser shows the first player as a moving capsule with chat.
