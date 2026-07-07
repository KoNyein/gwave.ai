# Phase 9 Report — Hardening, Testing & Launch

Phase 9 closes out the implementation plan: security hardening, an RLS
audit, automated end-to-end tests, load testing, operational endpoints,
and a launch checklist. `pnpm typecheck`, `pnpm lint` and `pnpm build`
all pass; the smoke E2E suite is green (9/9) against the production
build.

## 1. Security hardening

### HTTP security headers — `next.config.mjs`

All routes now ship:

| Header | Value |
| --- | --- |
| `Content-Security-Policy` | `default-src 'self'`; scripts/styles self (+inline for Next), images self/blob/data + `*.supabase.co`, connect self + `*.supabase.co` (https & wss) + `api.stripe.com`, `frame-ancestors 'none'` |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | camera/mic/geolocation disabled |

Verified by an automated E2E test (see §4).

### Auth rate limiting — `src/lib/rate-limit.ts`

In-memory sliding-window limiter (per key, 15-minute window) wired into
the auth server actions: **10 login attempts** and **5 registrations**
per window per identity. Server actions return a friendly "too many
attempts" error instead of hitting Supabase. The launch checklist also
enables Supabase Auth's own rate limits as a second layer; a
Redis-backed limiter is listed as a post-launch follow-up for
multi-instance deployments.

### XSS / injection posture (audited)

- All user content is rendered as plain text through React escaping;
  the only `dangerouslySetInnerHTML` in the codebase is the
  **server-generated** PromptPay QR SVG (no user input in the markup).
- All inputs to server actions are Zod-validated; all SQL goes through
  supabase-js/PostgREST parameter binding — no string-built SQL.
- API keys stored as SHA-256 hashes; service-role key confined to
  `server-only` modules; Stripe webhook signature-verified.

## 2. RLS audit — `scripts/rls-audit.sql`

A single transactional (always rolled back) script that provisions two
users on a scratch database and asserts every forbidden operation is
denied and every allowed one succeeds:

- private post invisible to a stranger; friends-only visibility flips
  after friendship accepted
- cannot update another user's profile / post, cannot escalate own
  `role` (denied by trigger or with-check — both accepted)
- cannot read another user's notifications, subscriptions, API keys
- cannot insert readings for another owner's device
- non-member cannot see store products; POS RPC enforces membership
- anon can read knowledge (strains) but cannot write

Run: `psql "$DB_URL" -v ON_ERROR_STOP=1 -f scripts/rls-audit.sql` —
ends with **"RLS audit passed — every forbidden operation was
denied."** (verified locally against the full migration chain 0001→0009
on a scratch PostgreSQL 16 with a Supabase shim; 11 OK assertions).

## 3. Operational endpoints

- **`GET /api/health`** (`src/app/api/health/route.ts`) — pings the
  database with a 2-second timeout; returns
  `{ status: "ok", db: "up", version }` (200) or
  `{ status: "degraded", db: "down" }` (503). No-store, safe for uptime
  monitors and the Coolify container health check.
- **`src/app/global-error.tsx`** — root error boundary with a branded
  recovery screen; if `NEXT_PUBLIC_SENTRY_DSN` is set it reports the
  error via a minimal Sentry envelope POST (no SDK weight). The full
  `@sentry/nextjs` wizard is noted in the checklist as a follow-up.

## 4. End-to-end tests (Playwright)

`playwright.config.ts` boots the production build (`pnpm start`) unless
`E2E_BASE_URL` is set; `PW_CHROMIUM_PATH` allows pinned/pre-installed
browsers. `pnpm e2e` runs the suite.

### `e2e/smoke.spec.ts` — 9/9 passing

Runs against any environment, even a dummy Supabase URL:

1. `/` redirects unauthenticated visitors to `/login`
2. login form renders 3. register form renders
4. `/feed` `/tools` `/farm` `/pos` `/admin` all bounce to
   `/login?redirectTo=…`
5. `/membership` pricing page is public
6. `/api/v1/openapi.json` serves a valid 3.1 spec
7. `/api/v1/posts` → **401** without an API key
8. security headers present (CSP, HSTS, nosniff, DENY)
9. `/api/health` responds with `ok`/`degraded`

### `e2e/flows.spec.ts` — full flows (gated by `E2E_FULL=1`)

Post → react → comment; navbar strain search; POS open-shift → cash
sale; developer API-key creation → authenticated `/api/v1/strains`
call. Requires a real Supabase stack with migrations + demo seed.

## 5. Load test — `scripts/load-test-feed.js`

k6 script ramping 0→10→50 VUs over 2 minutes against
`/api/posts?scope=feed`, following the keyset cursor to page 2.
Thresholds: **p95 < 800 ms**, error rate < 1%. The feed is a single
keyset query with embedded relations (no N+1); the checklist documents
which indexes to inspect if p95 degrades.

## 6. Launch checklist — `LAUNCH_CHECKLIST.md`

Six sections covering: database & security (migrations, knowledge seed
only, RLS audit, storage policies, Supabase Auth settings), Coolify
environment variables, services (EMQX with anonymous access disabled +
TLS, iot-bridge, Edge Function schedules, Stripe webhook), verification
(gates, smoke + full E2E, k6, header checks), monitoring & backups
(uptime probe, Sentry, PITR + nightly `pg_dump`), and post-launch
follow-ups (known scope cuts).

## Files added / changed

| File | Change |
| --- | --- |
| `next.config.mjs` | security headers |
| `src/lib/rate-limit.ts` | new — sliding-window limiter |
| `src/app/(auth)/actions.ts` | login/register rate-limit guards |
| `src/app/api/health/route.ts` | new — health probe |
| `src/app/global-error.tsx` | new — root error boundary (+ optional Sentry) |
| `scripts/rls-audit.sql` | new — behavioral RLS audit |
| `scripts/load-test-feed.js` | new — k6 load test |
| `playwright.config.ts`, `e2e/smoke.spec.ts`, `e2e/flows.spec.ts` | new — E2E suite |
| `LAUNCH_CHECKLIST.md` | new — go-live runbook |
| `package.json` | `@playwright/test` dev dep, `e2e` script |
| `.gitignore` | ignore Playwright artifacts |

## Verification

- `pnpm typecheck` ✅  `pnpm lint` ✅  `pnpm build` ✅ (dummy env)
- `npx playwright test e2e/smoke.spec.ts` → **9 passed**
- `psql -f scripts/rls-audit.sql` → **RLS audit passed** (11 OK)

With Phase 9 complete, all nine phases of the implementation plan are
done. `LAUNCH_CHECKLIST.md` is the remaining human runbook for
production go-live.
