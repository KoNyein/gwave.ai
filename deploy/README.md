# deploy/

AWS deployment scripts for gwave.ai. Full walkthrough: **`docs/AWS_DEPLOY.md`**.

| File | Purpose |
| --- | --- |
| `mediamtx-setup.sh` | Install MediaMTX + Caddy TLS on an EC2 — self-hosted **Live (RTMP→HLS)** + **CCTV (RTSP→HLS)**. |
| `mediamtx.yml` | MediaMTX config (paths for live keys + CCTV cameras). |
| `coturn-setup.sh` | Install coturn TURN/STUN on an EC2 — messenger **audio/video calls** through NATs. |
| `ecs-task-definition.json` | ECS Fargate task definition template for the Next.js app. |

The app image is built from the repo-root **`Dockerfile`** (Next.js standalone).
`NEXT_PUBLIC_*` values must be passed as `--build-arg` (they are inlined into the
client bundle); server secrets are injected at runtime from Secrets Manager.

Usage (each script prints the env values to set afterwards):

```bash
sudo bash mediamtx-setup.sh media.yourdomain.com you@email.com
sudo bash coturn-setup.sh <ELASTIC_IP> gwave <STRONG_SECRET> gwave.ai
```
