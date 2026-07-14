#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# One-command deploy of the gwave.ai app on your own AWS server.
#
# Pulls the latest code from GitHub, rebuilds the app image, and (re)starts the
# app + Caddy (auto-HTTPS for gwave.cc). Re-run it any time to ship an update —
# this is the "GitHub -> AWS" step you drive from the box (e.g. via Claude).
#
# First-time setup on the box:
#   git clone https://github.com/KoNyein/gwave.ai.git && cd gwave.ai
#   cp deploy/.env.server.example .env      # fill it in
#   # DNS: gwave.cc + www.gwave.cc  A records -> this box's public IP
#   # Firewall: open inbound TCP 80 and 443
#   bash deploy/server-deploy.sh
# ---------------------------------------------------------------------------
set -euo pipefail

cd "$(dirname "$0")/.."   # repo root

if [ ! -f .env ]; then
  echo "!! .env not found. Run: cp deploy/.env.server.example .env  (then fill it in)" >&2
  exit 1
fi

echo ">>> Pulling latest from GitHub ..."
git pull --ff-only || echo "(skipping git pull — not a fast-forward or no remote)"

echo ">>> Building + starting app + Caddy ..."
docker compose --env-file .env -f deploy/docker-compose.prod.yml up -d --build

echo ">>> Cleaning old images ..."
docker image prune -f

echo ""
echo ">>> Done. The app is live behind Caddy at https://gwave.cc"
echo ">>> Watch TLS/logs:  docker compose -f deploy/docker-compose.prod.yml logs -f caddy"
