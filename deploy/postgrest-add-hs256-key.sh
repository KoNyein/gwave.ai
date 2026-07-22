#!/usr/bin/env bash
# Teach the self-hosted PostgREST to accept the app's Cognito-bridge tokens.
#
# WHY THIS EXISTS
# ---------------
# gwave runs its OWN PostgREST + Realtime over RDS (the /sb gateway) — there is
# no hosted Supabase, only the open-source servers. Login is Amazon Cognito, so
# there are no GoTrue sessions; instead the app mints a short-lived JWT (role
# "authenticated", sub = the user's profiles.id) and hands it to PostgREST — see
# src/lib/auth/tokens.ts, used by src/lib/data/server.ts. NOTE: the app now mints
# ES256 tokens against APP_JWT_PRIVATE_KEY; the HS256 path below is the earlier
# scheme, kept because the legacy anon key is still an HS256 JWT.
#
# But this deployment's PostgREST validates JWTs against a *JWKS file*
# (PGRST_JWT_SECRET=@/etc/postgrest/jwks.json) that only contains **asymmetric
# EC / ES256** keys. An HS256 token can never verify against an EC key, so every
# authenticated read/write was rejected with 401 "JWSError JWSInvalidSignature"
# — surfacing in the app as a redirect loop on /feed (profile read fails) and
# "Could not send SOS" / "Could not create channel" (writes fail).
#
# The fix is additive: drop one symmetric ("oct", HS256) key into the same JWKS
# so PostgREST accepts the HS256 token *as well as* the EC/ES256-signed tokens
# already in the JWKS. Nothing about the existing EC keys changes.
#
# WHAT THIS SCRIPT DOES (idempotent)
#   1. Back up /etc/postgrest/jwks.json.
#   2. Generate a random 32-byte secret (or reuse $SUPABASE_JWT_SECRET if set).
#   3. Add/replace an "oct" key (kid "gwave-hs256", alg HS256) whose `k` is the
#      base64url of that secret's UTF-8 bytes — matching how mint-token.ts uses
#      the raw secret string as the HMAC key.
#   4. Validate the JSON and restart PostgREST.
#   5. Print the secret's fingerprint and remind you to set the SAME value as
#      SUPABASE_JWT_SECRET on the web container (deploy/gwave.override.env).
#
# The JWKS lives on a host bind-mount (/etc/postgrest), so the change persists
# across `docker restart`. Re-run this after rebuilding the server from scratch.
#
#   sudo bash deploy/postgrest-add-hs256-key.sh
#   # then put the printed secret into deploy/gwave.override.env and redeploy:
#   #   SUPABASE_JWT_SECRET=<printed value>
#   sudo bash deploy/ecr-redeploy.sh
set -euo pipefail

JWKS="${JWKS:-/etc/postgrest/jwks.json}"
CONTAINER="${POSTGREST_CONTAINER:-postgrest}"
KID="${SUPABASE_JWT_KID:-gwave-hs256}"

if [ ! -f "$JWKS" ]; then
  echo "!! $JWKS not found. Set JWKS=... if PostgREST reads its key elsewhere" >&2
  echo "   (check: docker inspect $CONTAINER | grep PGRST_JWT_SECRET)." >&2
  exit 1
fi

# Reuse an existing secret if the operator supplies one; otherwise mint a fresh
# 64-hex-char secret (no special characters, so it survives docker --env-file).
SECRET="${SUPABASE_JWT_SECRET:-$(openssl rand -hex 32)}"

echo ">>> Backing up $JWKS ..."
cp -a "$JWKS" "${JWKS}.bak.$(date +%s)"

echo ">>> Adding oct/HS256 key (kid $KID) to the JWKS ..."
python3 - "$JWKS" "$SECRET" "$KID" <<'PY'
import base64, json, sys
path, secret, kid = sys.argv[1], sys.argv[2], sys.argv[3]
doc = json.load(open(path))
keys = doc.setdefault("keys", [])
k = base64.urlsafe_b64encode(secret.encode()).rstrip(b"=").decode()
# Idempotent: replace any prior key with the same kid.
keys[:] = [x for x in keys if x.get("kid") != kid]
keys.append({"kty": "oct", "k": k, "alg": "HS256", "use": "sig", "kid": kid})
json.dump(doc, open(path, "w"))
print(f"    keys in set now: {len(keys)}")
PY

echo ">>> Validating JSON ..."
python3 -c "import json,sys; json.load(open('$JWKS')); print('    JSON OK')"

echo ">>> Restarting $CONTAINER ..."
docker restart "$CONTAINER" >/dev/null
for _ in 1 2 3 4 5 6 7 8; do
  sleep 1
  docker ps --filter "name=$CONTAINER" --format '{{.Status}}' | grep -q Up && break
done
docker ps --filter "name=$CONTAINER" --format '    {{.Names}} {{.Status}}'

FP="$(printf %s "$SECRET" | sha256sum | cut -c1-12)"
echo ">>> Done. PostgREST now also trusts the HS256 key '$KID'."
echo "    Secret fingerprint: $FP  (length ${#SECRET})"
echo
echo "    NEXT: set this exact secret on the web container and redeploy —"
echo "      echo 'SUPABASE_JWT_SECRET=$SECRET' >> /home/ubuntu/app/gwave.ai/deploy/gwave.override.env"
echo "      sudo bash /home/ubuntu/app/gwave.ai/deploy/ecr-redeploy.sh"
echo "    (mint-token.ts signs HS256 with this raw value; no rebuild needed.)"
