#!/usr/bin/env bash
# gwave.ai — one-command production deploy (database side).
#
# Automates the DB/functions portion of LAUNCH_CHECKLIST.md:
#   1. Links the Supabase project and applies migrations 0001 → 0010
#   2. Runs the production-safe seeds (knowledge + wellness)
#   3. Deploys the Edge Functions (cleanup-stories, deliver-webhooks)
#   4. Verifies the live app if NEXT_PUBLIC_SITE_URL is reachable
#
# Usage (from the repo root, on YOUR machine — not CI):
#
#   SUPABASE_PROJECT_REF=kspkzanfdblcjxgzzdjq \
#   PROD_DB_URL='postgresql://postgres:<db-password>@db.kspkzanfdblcjxgzzdjq.supabase.co:5432/postgres' \
#   ./scripts/deploy-production.sh
#
# Get the DB password from: Supabase dashboard → Project Settings → Database.
# The script never runs supabase/seed/seed.sql (demo users) and is safe to
# re-run: migrations are tracked, seeds are guarded by row counts.

set -euo pipefail

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
ok()   { printf '  \033[32m✔\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m⚠\033[0m %s\n' "$*"; }
die()  { printf '  \033[31m✘ %s\033[0m\n' "$*"; exit 1; }

# ── 0. Prerequisites ────────────────────────────────────────────────────────
bold "0/4 Checking prerequisites"
command -v supabase >/dev/null || die "supabase CLI missing — install: https://supabase.com/docs/guides/cli (brew install supabase/tap/supabase)"
command -v psql >/dev/null || die "psql missing — install the postgresql client package"
[ -d supabase/migrations ] || die "run this from the repo root (supabase/migrations not found)"
: "${SUPABASE_PROJECT_REF:?set SUPABASE_PROJECT_REF (e.g. kspkzanfdblcjxgzzdjq)}"
: "${PROD_DB_URL:?set PROD_DB_URL (Supabase dashboard → Project Settings → Database → connection string)}"
psql "$PROD_DB_URL" -Atc "select 1" >/dev/null || die "cannot connect with PROD_DB_URL — check the password/host"
ok "supabase CLI, psql, and database connection"

# ── 1. Migrations ───────────────────────────────────────────────────────────
bold "1/4 Applying migrations ($(ls supabase/migrations/*.sql | wc -l | tr -d ' ') files)"
supabase link --project-ref "$SUPABASE_PROJECT_REF"
supabase db push
ok "migration chain applied"

# ── 2. Seeds (production-safe only) ─────────────────────────────────────────
bold "2/4 Seeding knowledge + wellness content"
strains=$(psql "$PROD_DB_URL" -Atc "select count(*) from public.strains" 2>/dev/null || echo 0)
if [ "$strains" -gt 0 ]; then
  warn "strains already seeded ($strains rows) — skipping knowledge seed"
else
  psql "$PROD_DB_URL" -v ON_ERROR_STOP=1 -f supabase/seed/knowledge_seed.sql >/dev/null
  ok "knowledge seed (200 strains + 100 minerals)"
fi
wellness=$(psql "$PROD_DB_URL" -Atc "select count(*) from public.wellness_items" 2>/dev/null || echo 0)
if [ "$wellness" -gt 0 ]; then
  warn "wellness already seeded ($wellness rows) — skipping"
else
  psql "$PROD_DB_URL" -v ON_ERROR_STOP=1 -f supabase/seed/wellness_seed.sql >/dev/null
  ok "wellness seed"
fi
# Never seed.sql: demo users do not belong in production.

# ── 3. Edge Functions ───────────────────────────────────────────────────────
bold "3/4 Deploying Edge Functions"
supabase functions deploy cleanup-stories
supabase functions deploy deliver-webhooks
ok "cleanup-stories + deliver-webhooks deployed"
warn "schedule them in the dashboard: cleanup-stories hourly (0 * * * *), deliver-webhooks per-minute (* * * * *)"

# ── 4. Verify the live app (if already deployed on Coolify) ─────────────────
bold "4/4 Verifying the app"
SITE="${NEXT_PUBLIC_SITE_URL:-https://social.gwave.cc}"
if health=$(curl -fsS -m 10 "$SITE/api/health" 2>/dev/null); then
  echo "  $SITE/api/health → $health"
  case "$health" in
    *'"status":"ok"'*) ok "app is up and connected to the database" ;;
    *) warn "app responded but reports degraded — check Coolify env vars" ;;
  esac
else
  warn "$SITE not reachable yet — deploy the app on Coolify, then re-run this step:"
  echo "      curl $SITE/api/health"
fi

bold "Remaining manual steps (dashboards — see LAUNCH_CHECKLIST.md)"
cat <<'EOF'
  Coolify   → env vars: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
              (sb_publishable_...), SUPABASE_SERVICE_ROLE_KEY (sb_secret_...),
              NEXT_PUBLIC_SITE_URL, Stripe keys; health check path /api/health
  Supabase  → Auth: add callback URL <site>/auth/callback, enable email
              confirmations + Google provider; Storage: verify media/slips policies
  Stripe    → webhook endpoint <site>/api/webhooks/stripe, copy signing secret
  Optional  → EMQX + services/iot-bridge on Coolify (smart-farm features)
EOF
