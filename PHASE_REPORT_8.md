# Phase 8 — Admin + Developer Dashboards

Adds the admin console (overview, user management, moderation queue, site
settings, audit log) and the developer platform (hashed API keys, public
REST API with scopes and rate limits, usage logs, HMAC-signed webhooks,
feature flags, OpenAPI docs, Coolify deploy panel).

## What was built

### Data layer

- **Migration** `supabase/migrations/20260705190000_admin_dev.sql`:
  - **Moderation**: `reports` (post/comment target, reason, status
    pending/removed/dismissed); `profiles.suspended_until/suspend_reason`
    with `is_suspended()` wired into the post/comment insert policies —
    suspended users can read but not write.
  - **`audit_logs`** (admin-read only; written from admin server actions
    via the service role).
  - **`site_settings`** (public read, admin write; seeded with the site
    name) and **`feature_flags`** (public read, developer+ write via
    `is_developer()`).
  - **`api_keys`** — only the SHA-256 **hash** and a display `prefix`
    are stored; scopes array + per-minute `rate_limit`; developer-owned
    via RLS. **`api_logs`** (BRIN on created_at, owner-read).
  - **`webhooks`** (url, event array, HMAC secret) and
    **`webhook_deliveries`** with attempt/next-attempt bookkeeping;
    SECURITY DEFINER triggers enqueue deliveries on `post.created`
    (author's hooks), `sale.completed` (store owner's) and
    `alert.triggered` (device owner's).

### Public REST API (`/api/v1/*`)

- `src/lib/api-auth.ts`: `Authorization: Bearer gw_<prefix>_<secret>` →
  SHA-256 lookup → revocation + scope checks → **per-key sliding-window
  rate limit** (requests logged in the last 60 s vs `rate_limit`) →
  request logged with status + latency, `last_used_at` updated.
- Endpoints (all read-only): `/posts` (public posts, `read:posts`),
  `/strains` + `/minerals` (`read:knowledge`, with search filters),
  `/sensors` (**key owner's** device readings, `read:sensors`),
  `/pos/products` (**key owner's** store, `read:pos`), plus an
  unauthenticated `/openapi.json`.

### Admin console (`/admin`, admin/super_admin)

1. **Overview** — user/post/member stat cards, 14-day signup and post
   bar charts, monthly revenue chart.
2. **Users** — search, inline **role select** (super admins untouchable,
   self-change blocked), **suspend/unsuspend** with duration + reason —
   every action lands in the audit log.
3. **Moderation** — pending report queue with reporter, reason and
   content preview; **Remove content** (deletes via service role) or
   **Dismiss** — audit logged. A **Report post** item now appears in the
   post-card menu for non-authors (dialog with reason).
4. **Settings** — site name, feature-flag editor, currency-rate link,
   and the **audit log viewer** (actor, action, target, detail).

### Developer platform (`/dev`, developer+)

1. **API keys** — create (name, scope picker, rate-limit tier) → the
   full key is displayed **exactly once** with copy-to-clipboard;
   list shows prefix, scopes, limit, last-used; **revoke** and
   **rotate** (revoke + reissue with the same settings).
2. **Usage logs** — requests-by-endpoint bars + the last 200 requests
   (status, latency, key, age).
3. **Webhooks** — register URL + events (signing secret shown once),
   enable/disable, delete, and a delivery log (status, attempts).
   Delivery worker: `supabase/functions/deliver-webhooks` — HMAC-SHA256
   `X-Gwave-Signature`, 10 s timeout, exponential backoff (1/4/9/16 min,
   max 5 attempts), meant to be scheduled every minute.
4. **Feature flags** — toggle/create UI (shared with admin settings) +
   `useFeatureFlag(key)` client hook (public read).
5. **API docs** — endpoint cards generated from the OpenAPI spec with
   parameter chips and copy-ready curl examples.
6. **Deploy** — shows the running commit (`GIT_COMMIT_SHA`) and a
   **Redeploy** button calling the Coolify API
   (`COOLIFY_API_URL/API_TOKEN/APP_UUID`; the panel degrades gracefully
   when unset).

## Quality gates

```bash
pnpm typecheck   # OK
pnpm lint        # no warnings or errors
pnpm build       # compiled successfully (5 admin, 6 dev, 6 /api/v1 routes)
```

Migration chain (0001 → 0009) applied to a scratch PostgreSQL 16
instance with asserts: webhook delivery enqueued on post insert,
reporters cannot resolve their own reports while moderators see the
queue, suspended users are blocked from posting by RLS, plain users
cannot write flags/keys while developers can, and API keys/audit logs
are invisible to other users.

## How to test manually

1. Apply the migration. Make yourself `super_admin` in the profiles
   table (or use the seeded `demo1@gwave.ai`).
2. **Moderation**: from a second account report a post (⋯ menu); in
   `/admin/moderation` remove it and watch it disappear from the feed;
   check `/admin/settings` → audit log.
3. **Users**: change a test account's role; suspend it and confirm it
   can no longer post; unsuspend.
4. **API**: in `/dev` create a key with `read:knowledge`; then
   `curl -H "Authorization: Bearer <key>" localhost:3000/api/v1/strains?q=dream`.
   Hit it 60+ times to see 429s; watch `/dev/logs` fill in. Revoke and
   confirm 401.
5. **Webhooks**: register a webhook (e.g. a webhook.site URL) for
   `post.created`; deploy + schedule `deliver-webhooks`; create a post
   and verify the signed delivery and the log entry.
6. **Flags**: create `pos_v2` in `/dev/flags`; read it anywhere with
   `useFeatureFlag("pos_v2")`.
7. **Deploy**: set the three Coolify env vars and click Redeploy.

## Notes / follow-ups

- Suspension currently blocks post/comment creation; blocking messages
  and reactions the same way is a small Phase 9 addition if desired.
- The audit log records admin/moderation actions; expanding it to
  membership grants is straightforward (same helper).
- Rate limiting counts logged requests, so bursts inside the same
  second share the window — good enough at this scale; a token bucket
  in Redis is the scale-up path.
- Phase 9 (hardening & launch checklist) is the final phase.
