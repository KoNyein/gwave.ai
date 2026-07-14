# deploy/

AWS deployment scripts for gwave.ai. Full walkthrough: **`docs/AWS_DEPLOY.md`**.

| File | Purpose |
| --- | --- |
| `mediamtx-setup.sh` | Install MediaMTX + Caddy TLS on an EC2 — self-hosted **Live (RTMP→HLS)** + **CCTV (RTSP→HLS)**. |
| `mediamtx.yml` | MediaMTX config (paths for live keys + CCTV cameras). |
| `coturn-setup.sh` | Install coturn TURN/STUN on an EC2 — messenger **audio/video calls** through NATs. |
| `livekit-setup.sh` | Install the **LiveKit SFU** + Caddy TLS on an EC2 you already have. |
| `livekit-cloudformation.yaml` | **One-click AWS**: EC2 + Elastic IP + security group + LiveKit auto-installed. |
| `livekit-aws-deploy.sh` | Wrapper that deploys the CloudFormation stack from your machine. |
| `livekit.yaml` | LiveKit server config (ports, keys, embedded TURN). |
| `app-tls-setup.sh` | Put **HTTPS (Caddy)** in front of the app on a raw EC2/Lightsail box for a custom domain. |
| `docker-compose.prod.yml` | **App + Caddy (auto-HTTPS)** in one stack — the whole app on your own AWS server. |
| `Caddyfile` | Caddy config used by the prod compose (TLS for gwave.cc, www→apex). |
| `.env.server.example` | All server env (build args + secrets) for the prod compose. Copy to `.env`. |
| `server-deploy.sh` | One command: `git pull` + rebuild + restart app & Caddy (GitHub → AWS). |
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
