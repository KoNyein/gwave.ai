# gwave.ai — Launch Checklist

Work through this top-to-bottom before pointing `social.gwave.cc` at
production traffic.

> **⚠️ `scripts/deploy-production.sh` is OBSOLETE** — it drove the hosted
> Supabase project that gwave no longer has (migrated to AWS on 2026-07-17) and
> now refuses to run. Migrations go to **RDS** with `psql`; the app is rolled out
> with `deploy/ecr-redeploy.sh` (`sudo gwave-redeploy` on the box).

## 1. Database & security

- [ ] Apply all migrations to the production **RDS** database with `psql`
      (`supabase/migrations/` — the directory name is historical; there is no
      Supabase project and no `supabase db push` target).
- [ ] Run the knowledge seed once:
      `psql "$PROD_DB_URL" -f supabase/seed/knowledge_seed.sql`.
      Do **NOT** run `supabase/seed/seed.sql` (demo users) in production.
- [ ] Run the wellness seed once:
      `psql "$PROD_DB_URL" -f supabase/seed/wellness_seed.sql`
      (replace the placeholder radio URLs with licensed streams).
- [ ] Publish real Terms of Service + Privacy Policy documents and bump
      the versions in `src/lib/consent.ts` when they change.
- [ ] Run the RLS audit against a staging copy:
      `psql "$DB_URL" -v ON_ERROR_STOP=1 -f scripts/rls-audit.sql`
      — must end with "RLS audit passed".
- [ ] Storage is on **S3 + CloudFront** (AWS), not on database storage
      policies — access is enforced by the bucket policy plus server-side
      uploads/presigned URLs. The historical `media`/`slips` storage-policy
      blocks in the migrations no longer govern file access.
- [ ] Confirm XSS posture: user content is rendered as plain text (React
      escaping) everywhere; the only `dangerouslySetInnerHTML` is the
      server-generated PromptPay QR SVG. Keep it that way — never render
      user HTML without a sanitizer.
- [ ] **Amazon Cognito** (auth): email confirmation, rate limits, the
      production callback URL, and the Google identity provider are configured
      in the Cognito user pool / Hosted UI — **not** in a Supabase dashboard.
      The old hosted-Supabase Google OAuth client is dead; do not debug it.

## 2. Environment (Coolify app)

- [ ] `NEXT_PUBLIC_DATA_API_URL`, `NEXT_PUBLIC_DATA_API_KEY`
      (renamed from `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`;
      both old names still work as a runtime fallback — see `src/lib/env.ts`)
- [ ] `APP_JWT_PRIVATE_KEY` / `APP_JWT_PUBLIC_JWK` + the `COGNITO_*` values
      (server only — never expose)
- [ ] `NEXT_PUBLIC_SITE_URL=https://social.gwave.cc`
- [ ] `STRIPE_SECRET_KEY` (live), `STRIPE_WEBHOOK_SECRET` (from the
      dashboard webhook pointing at `/api/webhooks/stripe`)
- [ ] `PROMPTPAY_ID`
- [ ] `COOLIFY_API_URL`, `COOLIFY_API_TOKEN`, `COOLIFY_APP_UUID`
      (for the /dev redeploy panel), `GIT_COMMIT_SHA` from CI
- [ ] Optional: `NEXT_PUBLIC_SENTRY_DSN` (see §5)

## 3. Services

- [ ] Deploy EMQX (Coolify service): **disable anonymous access**,
      create a bridge user, enable TLS on 8883 for real devices.
- [ ] Deploy `services/iot-bridge` with `MQTT_URL`, `MQTT_USERNAME`,
      `MQTT_PASSWORD`, `DATA_API_URL`, `DATA_API_SERVICE_KEY`, `TZ`
      (renamed from `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`; the old names
      are still accepted as a fallback).
- [ ] Edge Functions (`cleanup-stories`, `deliver-webhooks`) ran on the hosted
      Supabase project and are **not deployable on AWS** — there is no Edge
      Functions runtime here. Schedule the equivalent work another way if
      needed.
- [ ] Stripe dashboard: add the production webhook endpoint and copy its
      signing secret; send a test event.

## 4. Verification

- [ ] `pnpm typecheck && pnpm lint && pnpm build` on the release commit.
- [ ] Smoke E2E against staging:
      `E2E_BASE_URL=https://staging... pnpm e2e -- e2e/smoke.spec.ts`
      (all 9 tests green — checks auth guards, security headers,
      public API 401, health endpoint).
- [ ] Full flows against a seeded staging database + data API:
      `E2E_FULL=1 pnpm e2e` (post/react/comment, strain search,
      POS sale, API key + authenticated call).
- [ ] Load test: `k6 run -e BASE_URL=... -e COOKIE=... scripts/load-test-feed.js`
      — p95 < 800 ms at 50 VUs. The feed is a single keyset query with
      embedded relations (no N+1); if p95 degrades, check the
      `posts_created_idx` and `sensor_readings` BRIN health first.
- [ ] `curl https://social.gwave.cc/api/health` → `{"status":"ok"}`.
- [ ] Security headers: `curl -I` shows CSP, HSTS, nosniff, DENY.

## 5. Monitoring & operations

- [ ] Point an uptime monitor at `/api/health` (expects 200).
- [ ] Error tracking: the root error boundary reports to
      `NEXT_PUBLIC_SENTRY_DSN` if set; for full tracing run
      `npx @sentry/wizard@latest -i nextjs` as a follow-up.
- [ ] Coolify health check on the container: path `/api/health`.
- [ ] Backups: enable **RDS** automated backups / PITR **and** schedule a
      nightly logical dump:
      `pg_dump "$PROD_DB_URL" -Fc -f backup-$(date +%F).dump`
      shipped off-box (cron on the EC2 host or a GitHub Action).
- [ ] Log retention: EMQX + iot-bridge logs to Coolify's log drain.

## 6. Post-launch follow-ups (known scope cuts)

- [ ] Rotate device MQTT secrets UI; camera stream support.
- [ ] Message/reaction writes for suspended users (posts/comments are
      already blocked).
- [ ] Stripe customer portal for self-serve card management.
- [ ] Redis-backed rate limiting if API traffic outgrows the
      Postgres sliding window.
- [ ] Monthly partitioning for `sensor_readings` if BRIN scans slow.
