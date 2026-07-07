# gwave.ai — Launch Checklist

Work through this top-to-bottom before pointing `social.gwave.cc` at
production traffic.

## 1. Database & security

- [ ] Apply all migrations to the production Supabase project:
      `supabase db push` (chain 0001 → 0010).
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
- [ ] Verify the two storage-policy blocks applied (media, slips); if the
      migration skipped them (`insufficient privilege` notice), create
      them in the dashboard as documented in the migration files.
- [ ] Confirm XSS posture: user content is rendered as plain text (React
      escaping) everywhere; the only `dangerouslySetInnerHTML` is the
      server-generated PromptPay QR SVG. Keep it that way — never render
      user HTML without a sanitizer.
- [ ] Supabase Auth: enable email confirmations, set rate limits, add
      the production callback URL, enable the Google provider.

## 2. Environment (Coolify app)

- [ ] `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` (server only — never expose)
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
      `MQTT_PASSWORD`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TZ`.
- [ ] Deploy + schedule Edge Functions:
      `supabase functions deploy cleanup-stories deliver-webhooks`
      with hourly (`0 * * * *`) and per-minute (`* * * * *`) schedules.
- [ ] Stripe dashboard: add the production webhook endpoint and copy its
      signing secret; send a test event.

## 4. Verification

- [ ] `pnpm typecheck && pnpm lint && pnpm build` on the release commit.
- [ ] Smoke E2E against staging:
      `E2E_BASE_URL=https://staging... pnpm e2e -- e2e/smoke.spec.ts`
      (all 9 tests green — checks auth guards, security headers,
      public API 401, health endpoint).
- [ ] Full flows against a seeded staging stack:
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
- [ ] Backups: enable Supabase PITR (Pro plan) **and** schedule a
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
