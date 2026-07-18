#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# LiveKit Egress — auto-save Live recordings for gwave.ai.
#
# Egress records each room composite (host + co-hosts + overlay effects — the
# exact frame viewers see) and uploads it to S3 as MP4. The app starts/stops the
# recording and passes the S3 destination in each request (see startRoomRecording
# in src/lib/livekit.ts), so this worker only needs to reach the LiveKit server
# (over Redis) and, at upload time, S3.
#
# Run on the SAME host as the LiveKit server (deploy/livekit-setup.sh), as root.
# It: installs Redis + Docker, points the LiveKit server at Redis (egress needs
# it), renders the egress config, and runs the egress worker container.
#
#   sudo API_KEY=APIgwave deploy/livekit-egress-setup.sh <LIVEKIT_API_SECRET>
#
# The API secret must match keys: in /etc/livekit/livekit.yaml and the app's
# LIVEKIT_API_SECRET.
# ---------------------------------------------------------------------------
set -euo pipefail

API_KEY="${API_KEY:-APIgwave}"
API_SECRET="${1:?usage: sudo API_KEY=APIgwave livekit-egress-setup.sh <LIVEKIT_API_SECRET>}"
HERE="$(cd "$(dirname "$0")" && pwd)"

echo ">>> Installing Redis + Docker"
apt-get update -y
apt-get install -y redis-server docker.io
systemctl enable --now redis-server docker

# --- Point the LiveKit server at Redis (egress talks to it over this bus) ----
if ! grep -q '^redis:' /etc/livekit/livekit.yaml; then
  echo ">>> Adding Redis to /etc/livekit/livekit.yaml and restarting LiveKit"
  cat >>/etc/livekit/livekit.yaml <<'REDIS'

# Added for Egress (Live recording). Egress and the server share this Redis bus.
redis:
  address: 127.0.0.1:6379
REDIS
  systemctl restart livekit
else
  echo ">>> LiveKit already has a redis: block — leaving it as-is"
fi

# --- Render the egress worker config ----------------------------------------
install -d /etc/livekit
sed -e "s/^api_key:.*/api_key: ${API_KEY}/" \
    -e "s#^api_secret:.*#api_secret: ${API_SECRET}#" \
    "${HERE}/livekit-egress.yaml" > /etc/livekit/egress.yaml
chmod 600 /etc/livekit/egress.yaml

# --- Run the egress worker ---------------------------------------------------
# --network host so it reaches Redis + the LiveKit server on localhost.
# --shm-size=1g because the room-composite renderer is headless Chrome.
echo ">>> Starting the livekit-egress container"
docker pull livekit/egress:latest
docker rm -f livekit-egress 2>/dev/null || true
docker run -d --name livekit-egress \
  --restart unless-stopped \
  --network host \
  --shm-size=1g \
  -e EGRESS_CONFIG_FILE=/etc/livekit/egress.yaml \
  -v /etc/livekit/egress.yaml:/etc/livekit/egress.yaml:ro \
  livekit/egress:latest

echo ""
echo ">>> Egress is running. Check it with:  docker logs -f livekit-egress"
echo ">>> Now set these on the APP (ECS task / Secrets Manager) and redeploy:"
echo "      LIVEKIT_EGRESS_S3_BUCKET=<your recordings bucket>"
echo "      LIVEKIT_EGRESS_S3_ACCESS_KEY=<IAM key with s3:PutObject on it>"
echo "      LIVEKIT_EGRESS_S3_SECRET=<its secret>"
echo "      LIVEKIT_EGRESS_S3_REGION=ap-southeast-1"
echo "      LIVEKIT_EGRESS_S3_PREFIX=live-recordings"
echo "      NEXT_PUBLIC_LIVEKIT_EGRESS_BASE=https://<cloudfront-or-s3-website-for-that-bucket>"
echo ""
echo ">>> Also add the egress_ended webhook to /etc/livekit/livekit.yaml under"
echo "    webhook.urls (the app stores the finished recording from it) — the"
echo "    existing https://gwave.cc/api/live/livekit-webhook URL already handles it."
