#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Put HTTPS in front of the gwave.ai app on a raw EC2 / Lightsail box.
#
# The Next.js app listens on HTTP (default :3000). The app sends HSTS +
# `upgrade-insecure-requests`, so the browser demands HTTPS for every asset —
# without TLS the page breaks (blank, ERR_CONNECTION_REFUSED). This installs
# Caddy as an auto-TLS reverse proxy: it fetches a Let's Encrypt certificate
# for your domain and forwards traffic to the local app. www -> apex redirect.
#
# Run on the Ubuntu 22.04 box that hosts the app, as root (sudo -i).
# BEFORE running:
#   1) DNS: point  gwave.cc  and  www.gwave.cc  A records at THIS box's public IP.
#   2) Firewall: open inbound TCP 80 and 443
#      (Lightsail: Networking -> IPv4 Firewall;  EC2: the security group).
#   3) The app must be running and listening on the port below (default 3000).
#
# Usage:
#   sudo bash app-tls-setup.sh gwave.cc you@email.com [APP_PORT]
# ---------------------------------------------------------------------------
set -euo pipefail

DOMAIN="${1:?usage: app-tls-setup.sh <domain> <email> [app_port]}"
EMAIL="${2:?usage: app-tls-setup.sh <domain> <email> [app_port]}"
APP_PORT="${3:-3000}"

echo ">>> Installing Caddy (auto-HTTPS) for ${DOMAIN} -> localhost:${APP_PORT}"
apt-get update -y
apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl

curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | tee /etc/apt/sources.list.d/caddy-stable.list
apt-get update -y && apt-get install -y caddy

# Serve the apex over HTTPS and 301-redirect www -> apex. Caddy provisions and
# renews the TLS certificate automatically (needs ports 80 + 443 reachable).
cat >/etc/caddy/Caddyfile <<CADDY
${DOMAIN} {
  tls ${EMAIL}
  encode gzip zstd
  reverse_proxy localhost:${APP_PORT}
}

www.${DOMAIN} {
  tls ${EMAIL}
  redir https://${DOMAIN}{uri} permanent
}
CADDY

systemctl restart caddy
systemctl enable caddy

cat <<DONE

>>> Done. https://${DOMAIN} now terminates TLS and proxies to your app.

Checklist:
  - DNS:  ${DOMAIN}  and  www.${DOMAIN}  A records -> this box's public IP
  - Firewall: inbound TCP 80 and 443 open
  - App running on localhost:${APP_PORT}
  - In the app environment set NEXT_PUBLIC_SITE_URL=https://${DOMAIN} and rebuild

Watch Caddy get the certificate (first request may take ~30s):
  journalctl -u caddy -f
DONE
