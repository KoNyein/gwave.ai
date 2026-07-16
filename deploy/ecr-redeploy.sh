#!/usr/bin/env bash
# Pull the freshly-built web image from ECR and swap the running gwave-web
# container onto it — preserving every runtime secret the current container
# already has, plus anything you add to the override env file (see below).
#
# The web container was started with `docker run` (no compose/SSM), so we can't
# just `compose up`. Instead we snapshot the live container's environment, let
# an override file add/replace keys (e.g. SUPABASE_JWT_SECRET for the Cognito
# auth fix), then recreate it on the new image with the same port + restart
# policy.
#
# Run it on the server after a new image is in ECR:
#   sudo bash /home/ubuntu/app/gwave.ai/deploy/ecr-redeploy.sh
# The GitHub Actions "Build & deploy web image (ECR)" workflow runs it for you
# over SSH when the DEPLOY_* secrets are set.
set -euo pipefail

REGION="${AWS_REGION:-ap-southeast-1}"
REGISTRY="150897468627.dkr.ecr.ap-southeast-1.amazonaws.com"
IMAGE="$REGISTRY/gwave-web:gwave"
CONTAINER="gwave-web"
# Add or override env vars here (one KEY=value per line). Survives redeploys.
# Put SUPABASE_JWT_SECRET=... in this file to switch on the Cognito auth fix.
OVERRIDE_ENV="/home/ubuntu/app/gwave.ai/deploy/gwave.override.env"

echo ">>> Logging in to ECR (skipped if already logged in via the pipeline) ..."
if command -v aws >/dev/null 2>&1; then
  aws ecr get-login-password --region "$REGION" \
    | docker login --username AWS --password-stdin "$REGISTRY" || true
fi

echo ">>> Pulling $IMAGE ..."
docker pull "$IMAGE"

if ! docker inspect "$CONTAINER" >/dev/null 2>&1; then
  echo "!! No running '$CONTAINER' container to copy env from. Aborting so we" >&2
  echo "!! don't start it without its secrets. Start it once manually first." >&2
  exit 1
fi

echo ">>> Snapshotting current environment (keeps all secrets) ..."
ENV_FILE="$(mktemp)"
trap 'rm -f "$ENV_FILE"' EXIT
# Drop container/system vars that must not be pinned onto the new container.
docker inspect "$CONTAINER" --format '{{range .Config.Env}}{{println .}}{{end}}' \
  | grep -vE '^(PATH|HOME|HOSTNAME|PWD|TERM|SHLVL|NODE_VERSION|YARN_VERSION|_)=' \
  > "$ENV_FILE"
# Overlay operator additions/overrides (docker keeps the last value per key).
if [ -f "$OVERRIDE_ENV" ]; then
  echo ">>> Applying overrides from $OVERRIDE_ENV"
  grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "$OVERRIDE_ENV" >> "$ENV_FILE" || true
fi

echo ">>> Recreating $CONTAINER on the new image ..."
docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
docker run -d \
  --name "$CONTAINER" \
  --restart unless-stopped \
  -p 3000:3000 \
  --env-file "$ENV_FILE" \
  "$IMAGE"

echo ">>> Cleaning up old images ..."
docker image prune -f >/dev/null 2>&1 || true

echo ">>> Done. gwave-web is now running the latest image."
docker ps --filter "name=$CONTAINER" --format '  {{.Names}}  {{.Image}}  {{.Status}}'
