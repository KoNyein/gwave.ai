#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# LiveKit SFU (media server) for gwave.ai co-host Live.
#
# A small set of publishers (host + approved co-hosts) send camera/mic; LiveKit
# fans those streams out to thousands of viewers. The Next.js app mints access
# tokens with the same API key/secret configured here.
#
# Run on a fresh Ubuntu 22.04 EC2 (t3.large+ recommended), as root (sudo -i).
# Point a DNS record (e.g. live.yourdomain.com) at the Elastic IP first.
# Open in the security group:
#   TCP  443            (signaling over TLS via Caddy → :7880)
#   TCP  7881           (ICE/TCP fallback)
#   UDP  50000-60000    (media)
#   UDP  3478, TCP 5349 (embedded TURN, optional)
# ---------------------------------------------------------------------------
set -euo pipefail

DOMAIN="${1:?usage: livekit-setup.sh live.yourdomain.com you@email [API_SECRET]}"
EMAIL="${2:?usage: livekit-setup.sh live.yourdomain.com you@email [API_SECRET]}"
API_KEY="${API_KEY:-APIgwave}"
API_SECRET="${3:-$(head -c 48 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 40)}"

echo ">>> Installing LiveKit + Caddy TLS for ${DOMAIN}"
apt-get update -y
apt-get install -y curl debian-keyring debian-archive-keyring apt-transport-https

# --- LiveKit server ---------------------------------------------------------
curl -fsSL https://get.livekit.io | bash

install -d /etc/livekit
# Render deploy/livekit.yaml with the real domain + generated secret.
sed -e "s/live.yourdomain.com/${DOMAIN}/g" \
    -e "s/APIgwave: REPLACE_WITH_A_LONG_RANDOM_SECRET/${API_KEY}: ${API_SECRET}/" \
    "$(dirname "$0")/livekit.yaml" > /etc/livekit/livekit.yaml

cat >/etc/systemd/system/livekit.service <<'UNIT'
[Unit]
Description=LiveKit Server
After=network.target
[Service]
ExecStart=/usr/local/bin/livekit-server --config /etc/livekit/livekit.yaml
Restart=always
User=root
[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now livekit

# --- Caddy: HTTPS/WSS reverse proxy in front of signaling (:7880) -----------
# Browsers require secure WebSocket (wss://) to a non-localhost origin.
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | tee /etc/apt/sources.list.d/caddy-stable.list
apt-get update -y && apt-get install -y caddy

cat >/etc/caddy/Caddyfile <<CADDY
${DOMAIN} {
  tls ${EMAIL}
  reverse_proxy localhost:7880
}
CADDY
systemctl restart caddy

echo ""
echo ">>> Done. LiveKit is live at wss://${DOMAIN}"
echo ">>> Set these in the app environment (ECS task / Secrets Manager):"
echo "    NEXT_PUBLIC_LIVEKIT_URL=wss://${DOMAIN}"
echo "    LIVEKIT_API_KEY=${API_KEY}"
echo "    LIVEKIT_API_SECRET=${API_SECRET}"
echo ""
echo ">>> Keep LIVEKIT_API_SECRET private — it can mint publish tokens."
