# deploy/

AWS deployment scripts for gwave.ai. Full walkthrough: **`docs/AWS_DEPLOY.md`**.

| File | Purpose |
| --- | --- |
| `mediamtx-setup.sh` | Install MediaMTX + Caddy TLS on an EC2 — self-hosted **Live (RTMP→HLS)** + **CCTV (RTSP→HLS)**. |
| `mediamtx.yml` | MediaMTX config (paths for live keys + CCTV cameras). |
| `coturn-setup.sh` | Install coturn TURN/STUN on an EC2 — messenger **audio/video calls** through NATs. |
| `livekit-setup.sh` | Install the **LiveKit SFU** + Caddy TLS on an EC2 — **co-host Live** scaled to thousands of viewers. |
| `livekit.yaml` | LiveKit server config (ports, keys, embedded TURN). |
| `ecs-task-definition.json` | ECS Fargate task definition template for the Next.js app. |

The app image is built from the repo-root **`Dockerfile`** (Next.js standalone).
`NEXT_PUBLIC_*` values must be passed as `--build-arg` (they are inlined into the
client bundle); server secrets are injected at runtime from Secrets Manager.

Usage (each script prints the env values to set afterwards):

```bash
sudo bash mediamtx-setup.sh media.yourdomain.com you@email.com
sudo bash coturn-setup.sh <ELASTIC_IP> gwave <STRONG_SECRET> gwave.ai
sudo bash livekit-setup.sh live.yourdomain.com you@email.com
```

The LiveKit script prints `NEXT_PUBLIC_LIVEKIT_URL`, `LIVEKIT_API_KEY`, and
`LIVEKIT_API_SECRET` — set them in the app environment. When they're present,
co-host Live uses the SFU; when absent, it falls back to the peer-to-peer mesh.
