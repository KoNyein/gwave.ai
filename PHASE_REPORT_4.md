# Phase 4 — Membership & Payments

Adds the Free / Pro / Business membership system with Stripe subscriptions,
a PromptPay QR flow for Thai users, member gating across the app, and an
admin membership-management dashboard.

## What was built

### Data layer

- **Migration** `supabase/migrations/20260705150000_membership.sql`:
  - Enums: `subscription_status` (pending/active/past_due/canceled/expired),
    `payment_provider` (stripe/promptpay/manual), `payment_status`
    (awaiting_review/pending/succeeded/failed/rejected/refunded).
  - `membership_plans` — seeded Free ($0) / Pro ($9.99) / Business
    ($29.99) with feature-limit `jsonb`; publicly readable, admin-managed.
  - `subscriptions` — one *live* subscription per user enforced by a
    partial unique index; `payments` (with `slip_path` for PromptPay
    slips and an indexed review queue); `invoices` (auto-issued by
    trigger whenever a payment succeeds, numbered `INV-YYYY-000001`).
  - **Role sync trigger**: activating a subscription promotes
    `user → member`; ending the last live one demotes `member → user`;
    staff roles are never touched.
  - **`members` post visibility**: new `post_visibility` enum value;
    `can_view_post()` extended (enum compared as text so the value is
    usable in the same migration) — members-only posts are visible to
    any role above `user`.
  - **RLS**: users see only their own subscriptions/payments/invoices
    and can only *create pending PromptPay* rows — activation is
    strictly admin/webhook territory (verified: a user's self-`UPDATE`
    to active affects 0 rows). Admins manage everything. Private
    `slips` storage bucket: owners upload/read their own, admins read
    all (for review), served via signed URLs.

### Stripe

- `src/lib/stripe.ts` — lazy server-only client (build never needs the
  key). Checkout uses inline `price_data` so no Stripe dashboard setup
  is required (a `stripe_price_id` column is honored when set).
- `createStripeCheckout` server action → Checkout session (subscription
  mode, user/plan in metadata) → redirect.
- **Webhook** `POST /api/webhooks/stripe` (signature verified, service
  role): `checkout.session.completed` activates the subscription and
  records the payment (canceling any abandoned PromptPay pending row),
  `invoice.paid` extends the period and records renewals (deduped),
  `customer.subscription.updated/deleted` sync status and
  `cancel_at_period_end`.
- Test with the Stripe CLI:
  `stripe listen --forward-to localhost:3000/api/webhooks/stripe`, then
  `stripe trigger checkout.session.completed`.

### PromptPay

- `/membership/promptpay/[plan]` renders a real PromptPay EMVCo QR
  (`promptpay-qr` payload + server-side SVG via `qrcode`) for
  `PROMPTPAY_ID` with the THB amount (fixed display rate for now).
- User uploads the transfer slip (client-compressed) to the private
  `slips` bucket → `submitPromptPayPayment` creates the pending
  subscription + `awaiting_review` payment.
- Admin approves (payment → succeeded, subscription → active for 30
  days, role sync fires, invoice issued) or rejects (pending
  subscription canceled).

### Member gating

- `requireMembership()` in `src/lib/auth.ts` (redirects non-members to
  `/membership`) — ready for Phase 5's member-only tools.
- `MemberBadge` (green check) on post cards and profile headers;
  `AuthorSummary` now carries `role`.
- "Members only" audience option in the post composer and share dialog.

### Pages

- **`/membership`** (public pricing): three plan cards with feature
  lists, Stripe + PromptPay buttons, current-subscription card with
  renewal date, pending-review notice, checkout success/cancel banners,
  cancel-at-period-end (Stripe cancellation propagated via API).
- **`/admin/membership`** (admin/super_admin only, own `(admin)`
  layout): stat cards (active members, pending reviews, revenue this
  month), 12-month revenue bar chart, PromptPay review queue with
  signed slip links + approve/reject, manual grant form
  (username/plan/duration — uses the service role), member table with
  search and extend/revoke actions, CSV export at
  `/api/admin/members.csv`.

### Environment

`.env.example` gains `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`PROMPTPAY_ID`. All are optional at build time; features degrade with
clear messages when unset.

## Quality gates

```bash
pnpm typecheck   # OK
pnpm lint        # no warnings or errors
pnpm build       # compiled successfully
```

Migration chain (0001 → 0005) applied to a scratch PostgreSQL 16
instance with asserts: plan seeding + public reads, user cannot
self-activate a subscription (RLS), admin approval activates and
promotes the role to `member`, invoice auto-issued with sequential
number, members-only post visible to a member and hidden from a plain
user, revoke demotes back to `user`, and payments are private to their
owner.

## How to test manually

1. Apply the migration; set `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`
   (test mode) and `PROMPTPAY_ID` in `.env.local`.
2. **Pricing**: open `/membership` logged out (public), then logged in.
3. **Stripe**: subscribe with card `4242 4242 4242 4242` via test mode;
   with `stripe listen` forwarding, confirm the subscription activates,
   the member badge appears, and `/membership` shows the renewal date.
4. **PromptPay**: choose "Pay with PromptPay QR", scan/upload any image
   as a slip; as an admin open `/admin/membership`, view the slip
   (signed URL) and approve; the user's role flips to member.
5. **Gating**: post with the "Members only" audience from a member
   account; verify a free account cannot see it; check the badge on
   posts and profile.
6. **Admin**: grant a membership by username, extend/revoke from the
   member table, download the CSV.

## Notes / follow-ups

- The USD→THB display rate for PromptPay is a fixed constant (36);
  Phase 5's admin-editable currency table will replace it.
- Stripe customer-portal integration (self-serve card updates) and
  proration are out of scope; cancellation is at period end.
- Subscription expiry currently relies on Stripe events / admin action;
  a scheduled Edge Function marking overdue `current_period_end` rows
  as expired is a good Phase 9 hardening item.
- Calculator tools (with member-only gating via `requireMembership`)
  are Phase 5.
