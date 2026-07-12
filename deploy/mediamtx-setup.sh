#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# MediaMTX media server for gwave.ai — self-hosted CCTV + Live streaming.
#
# Handles:
#   • CCTV  : pull RTSP from IP cameras → serve HLS to the browser player.
#   • Live  : ingest RTMP from a host (OBS / phone) → serve HLS to viewers.
#
# Run on a fresh Ubuntu 22.04 EC2 (t3.medium+), as root (sudo -i).
# Open in the security group:  TCP 8554 (RTSP), 1935 (RTMP), 8888 (HLS),
#                              8189/udp + 8000/udp (WebRTC/RTP), 443 (TLS).
# Point a DNS record (e.g. media.yourdomain.com) at the Elastic IP first.
# ---------------------------------------------------------------------------
set -euo pipefail

DOMAIN="${1:?usage: mediamtx-setup.sh media.yourdomain.com you@email}"
EMAIL="${2:?usage: mediamtx-setup.sh media.yourdomain.com you@email}"
MTX_VERSION="${MTX_VERSION:-1.9.3}"

echo ">>> Installing MediaMTX ${MTX_VERSION} + Caddy TLS proxy for ${DOMAIN}"
apt-get update -y
apt-get install -y curl tar debian-keyring debian-archive-keyring apt-transport-https

# --- MediaMTX ---------------------------------------------------------------
cd /opt
curl -fsSL -o mediamtx.tar.gz \
  "https://github.com/bluenviron/mediamtx/releases/download/v${MTX_VERSION}/mediamtx_v${MTX_VERSION}_linux_amd64.tar.gz"
mkdir -p /opt/mediamtx && tar -xzf mediamtx.tar.gz -C /opt/mediamtx
rm -f mediamtx.tar.gz
install -m 0644 /dev/stdin /opt/mediamtx/mediamtx.yml < "$(dirname "$0")/mediamtx.yml" 2>/dev/null \
  || cp "$(dirname "$0")/mediamtx.yml" /opt/mediamtx/mediamtx.yml

cat >/etc/systemd/system/mediamtx.service <<'UNIT'
[Unit]
Description=MediaMTX
After=network.target
[Service]
ExecStart=/opt/mediamtx/mediamtx /opt/mediamtx/mediamtx.yml
Restart=always
User=root
[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now mediamtx

# --- Caddy: HTTPS reverse proxy in front of HLS (8888) ----------------------
# Browsers require HTTPS to play HLS from a non-localhost origin, and the app's
# CSP allow-lists this exact origin (NEXT_PUBLIC_CCTV_HLS_ORIGINS).
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | tee /etc/apt/sources.list.d/caddy-stable.list
apt-get update -y && apt-get install -y caddy

cat >/etc/caddy/Caddyfile <<CADDY
${DOMAIN} {
  tls ${EMAIL}
  # HLS playback (and the built-in player page) served by MediaMTX on :8888
  reverse_proxy localhost:8888
}
CADDY
systemctl restart caddy

echo ""
echo ">>> Done. Media server is live at https://${DOMAIN}"
echo ">>> Set these in the app environment:"
echo "    NEXT_PUBLIC_CCTV_PLAYER_ORIGIN=https://${DOMAIN}"
echo "    NEXT_PUBLIC_CCTV_HLS_ORIGINS=https://${DOMAIN}"
echo "    CCTV_MEDIA_API_URL=https://${DOMAIN}/v3   (MediaMTX control API)"
echo ""
echo ">>> Live host publishes to:  rtmp://${DOMAIN}:1935/live/<streamKey>"
echo ">>> Viewers watch HLS at:     https://${DOMAIN}/live/<streamKey>/index.m3u8"
echo ">>> CCTV: add each camera's RTSP under 'paths' in mediamtx.yml."
