#!/usr/bin/env bash
#
# Reproducible launcher for the self-hosted Supabase Realtime container.
#
# Realtime runs as a plain `docker run` on the box (NOT docker-compose), so its
# config — including the RDS password and API_JWT_SECRET — lives only inside the
# running container. If the box is lost, that state is gone. This script recreates
# the container faithfully from an operator-provided env file, so the box is
# rebuildable and secrets are never committed.
#
# Secrets live ONLY in deploy/.env.realtime (gitignored) — never in this repo.
#
# ── First-time capture (writes the gitignored env file from a running container):
#     docker inspect realtime --format '{{range .Config.Env}}{{println .}}{{end}}' \
#       | grep -vE '^(PATH|LANG|LANGUAGE|LC_ALL)=' > deploy/.env.realtime
#     chmod 600 deploy/.env.realtime
#
# ── Launch / relaunch:
#     sudo bash deploy/realtime-run.sh
#
# The API_JWT_SECRET in the env file MUST match the app's SUPABASE_JWT_SECRET and
# the PostgREST oct key (see docs/OPERATIONS_RUNBOOK.md — "the one invariant").
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$HERE/.env.realtime"
IMAGE="supabase/realtime:v2.34.47"
# Host bind mount carrying the tenant/runtime config the image reads at boot.
RUNTIME_EXS="/etc/realtime/runtime.exs"
RUNTIME_DST="/app/releases/2.34.47/runtime.exs"

[ -f "$ENV_FILE" ] || {
  echo "Missing $ENV_FILE — see the header for how to capture it from a running container." >&2
  exit 1
}
[ -f "$RUNTIME_EXS" ] || {
  echo "Missing $RUNTIME_EXS on the host (realtime tenant config)." >&2
  exit 1
}

echo ">>> Recreating realtime from $ENV_FILE ..."
docker rm -f realtime 2>/dev/null || true
docker run -d --name realtime --restart unless-stopped --network bridge \
  -p 127.0.0.1:4000:4000 \
  -v "${RUNTIME_EXS}:${RUNTIME_DST}:ro" \
  --env-file "$ENV_FILE" \
  "$IMAGE"

sleep 5
echo ">>> Status:"
docker ps --filter name=realtime --format '{{.Names}} {{.Status}}'
echo ">>> Recent logs (look for 'Running RealtimeWeb.Endpoint' and no DB auth errors):"
docker logs --tail 15 realtime 2>&1 | tail -15
