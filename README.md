# gwave.ai

GreenWave — a Facebook-style social super-app for growers, built as a single
Next.js 14 application with Supabase as the backend. Social feed, groups,
messenger, a strain/mineral knowledge base, paid memberships, grower
calculators, IoT smart-farm monitoring, a point of sale, and a public REST
API — all in one codebase.

## Features

| Area | Routes | Highlights |
| --- | --- | --- |
| Social core | `/feed`, `/u/[username]`, `/friends`, `/notifications` | Posts (text/media, visibility levels), reactions, nested comments, shares, friends & follows, realtime notifications |
| Community | `/groups`, `/pages`, `/messages`, stories bar | Groups with roles, business Pages, realtime Messenger (typing, read receipts, images), 24 h Stories |
| Knowledge | `/strains`, `/minerals`, navbar search | Leafly-style strain + mineral encyclopedias, full-text + trigram search |
| Membership | `/membership`, `/membership/checkout` | Stripe Checkout + PromptPay QR with slip review, member role sync, members-only content |
| Grower tools | `/tools/*` | EC/PPM, VPD, unit & currency converters, profit calculator; member-only nutrient mixing + yield estimator; share results as posts |
| Smart farm | `/farm`, `/home` | MQTT devices via EMQX + bridge service, realtime sensor dashboard, automation rules with cooldowns, alerts, scenes & schedules |
| Point of sale | `/pos/*` | Multi-store, product/inventory management, shifts, atomic sale/refund RPCs, 80 mm receipts, reports, CSV export |
| Admin | `/admin/*` | Moderation queue, user suspension, membership review, audit logs, site settings |
| Developer | `/dev/*`, `/api/v1/*` | Hashed API keys with scopes + rate limits, public REST API + OpenAPI 3.1, HMAC-signed outgoing webhooks, feature flags, Coolify redeploy panel |

Per-phase implementation notes live in `PHASE_REPORT*.md` (Phases 1–9).

## Tech stack

- **Next.js 14** (App Router) + **TypeScript** (strict mode)
- **Tailwind CSS** + **shadcn/ui** primitives, **Zustand** for client state
- **Supabase** — Postgres (RLS on every table), Auth, Storage, Realtime
- **next-intl** for i18n (English UI, Burmese `my` scaffolding)
- **Stripe** + **PromptPay** payments; **EMQX** MQTT broker + Node bridge
- **pnpm**; Docker (standalone output) via Coolify on AWS EC2

## Getting started

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Fill in your Supabase project URL and keys. See `.env.example` for the full
list (Stripe, PromptPay, Coolify variables are optional in development).
`SUPABASE_SERVICE_ROLE_KEY` is server-only — never expose it to the client.

### 3. Apply database migrations

Migrations live in `supabase/migrations` as plain SQL (chain `0001 → 0009`).
With the Supabase CLI:

```bash
supabase db reset   # local: applies migrations + seed
# or push to a linked project:
supabase db push
```

Seeds: `supabase/seed/seed.sql` (demo users/content — **development only**)
and `supabase/seed/knowledge_seed.sql` (200 strains + 100 minerals — safe for
production; regenerate with `node scripts/generate-knowledge-seed.mjs`).

### 4. Run the dev server

```bash
pnpm dev
```

Open http://localhost:3000.

### 5. Optional services

- **IoT**: `docker compose up emqx iot-bridge`, then
  `node scripts/simulate-devices.mjs` to stream fake sensor data
  (see `services/iot-bridge/README.md`).
- **Edge Functions**: `supabase functions deploy cleanup-stories
  deliver-webhooks` (hourly / per-minute schedules).

## Scripts

| Command          | Description                                     |
| ---------------- | ----------------------------------------------- |
| `pnpm dev`       | Start the dev server                            |
| `pnpm build`     | Production build (standalone)                   |
| `pnpm start`     | Serve the production build                      |
| `pnpm lint`      | ESLint                                          |
| `pnpm typecheck` | `tsc --noEmit`                                  |
| `pnpm format`    | Prettier                                        |
| `pnpm e2e`       | Playwright E2E (smoke suite; `E2E_FULL=1` for full flows) |

## Live streaming (Mux)

Facebook-Live-style broadcasting at `/live` is powered by
[Mux](https://www.mux.com). One-time setup:

1. Create a Mux account and, under **Settings → Access Tokens**, generate a
   token with **Mux Video** permission. Put the ID/secret in
   `MUX_TOKEN_ID` / `MUX_TOKEN_SECRET` (server-only env vars — on Vercel:
   Project → Settings → Environment Variables).
2. Under **Settings → Webhooks**, add an endpoint pointing at
   `https://<your-domain>/api/live/webhook` and copy its **signing secret**
   into `MUX_WEBHOOK_SECRET`. The webhook flips streams between
   idle → live → ended; every request is signature-verified.
3. Apply the `20260708120000_live_streaming.sql` migration and redeploy.

Hosts create a stream at `/live/new`, paste the RTMP URL + private stream
key into OBS (Settings → Stream), and go live. The stream key is stored in
its own host-only RLS table (`live_stream_keys`) and is never readable by
viewers. Viewers get HLS playback, realtime chat (postgres_changes),
floating reactions (broadcast) and a presence-based viewer count.

## Testing & audits

- **Smoke E2E** (`e2e/smoke.spec.ts`) — auth guards, public pages, security
  headers, API auth, health probe. Runs against the production build with
  dummy Supabase env; also runs in CI.
- **Full flows** (`e2e/flows.spec.ts`) — post/react/comment, search, POS
  sale, API keys. Needs a real seeded Supabase stack: `E2E_FULL=1 pnpm e2e`.
- **RLS audit** — `psql "$DB_URL" -v ON_ERROR_STOP=1 -f scripts/rls-audit.sql`
  asserts every forbidden cross-user operation is denied (rolls back).
- **Load test** — `k6 run -e BASE_URL=... scripts/load-test-feed.js`
  (feed keyset pagination, p95 < 800 ms at 50 VUs).

## Docker

Build and run the production container locally:

```bash
docker compose up --build
```

The `Dockerfile` is multi-stage and emits a standalone Next.js server. Public
`NEXT_PUBLIC_*` variables are inlined at build time via build args. The
compose file also defines `emqx` and `iot-bridge` services for the smart-farm
stack.

## Roles & access control

Roles are stored in `profiles.role` (`user`, `member`, `moderator`, `developer`,
`admin`, `super_admin`) and enforced by Postgres RLS plus the `requireRole()`
server helper in `src/lib/auth.ts`. Privileged operations use the service role
key only from server actions / route handlers (`src/lib/supabase/admin.ts`).
Public API access uses per-key scopes (`read:*`, `write:posts`, …) checked in
`src/lib/api-auth.ts`.

## Deploying

Follow `LAUNCH_CHECKLIST.md` — it covers migrations, storage policies, Coolify
environment variables, EMQX/bridge/Edge Function deployment, the Stripe
webhook, verification (E2E + k6), monitoring and backups.
