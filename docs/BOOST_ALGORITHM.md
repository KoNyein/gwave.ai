# Boost / Promotion System — Design & Algorithm

**Boost** lets a user pay (with their **G-Pay** play-money wallet) to promote
their own **post**, **shop product**, or **POS product** so it appears as
*Sponsored* content across the app's feeds. This document describes the money
model, the data model, and — in detail — the ad-serving algorithm.

> ဗမာ: Boost ဆိုတာ ကိုယ့် **post / shop ပစ္စည်း / POS ပစ္စည်း** ကို **G-Pay** နဲ့
> ငွေပေးပြီး "ကြော်ငြာ" အဖြစ် feed တွေမှာ ပိုမြင်အောင် တွန်းတင်တဲ့ စနစ်ပါ။ အောက်မှာ
> ငွေစီးဆင်းပုံနဲ့ ရွေးချယ်ပြသတဲ့ algorithm ကို အသေးစိတ် ရေးထားပါတယ်။

---

## 1. Money model — escrow, spend, refund

All money is the same play-money MMK used by G-Pay. Balances change **only**
inside `SECURITY DEFINER` functions that flip the `gpay.allow_ledger` flag, so
no client can charge another user or refund itself.

```
create_boost(budget)                     ┌───────────────────────────┐
   │  debit wallet by `budget` (escrow)  │  G-Pay wallet             │
   ▼                                     │  balance -= budget        │
boost.budget_mmk = budget                └───────────────────────────┘
boost.spent_mmk  = 0                          (money is now "held")

record_boost_impression()  ── per served view ──▶ boost.spent_mmk += charge
                                                  (NO wallet movement —
                                                   already escrowed)

when spent_mmk == budget_mmk  ──▶ status = 'completed'

cancel_boost()   refund = budget_mmk − spent_mmk  ──▶ wallet.balance += refund
                 budget_mmk := spent_mmk           (only the unspent part)
```

**Invariant:** the owner's real cost is always exactly `spent_mmk`. Escrowing
the full budget up front guarantees the funds to pay for every impression the
auction serves actually exist — the campaign can never "spend money it doesn't
have", and the advertiser can walk away any time and get the rest back.

### Pricing (CPV — cost per view)

| Event | Billed? | Amount |
|-------|---------|--------|
| **Impression** (first serve to a viewer, per Yangon-day) | ✅ | `bid_mmk` (advertiser-chosen, ≥ 1 MMK) |
| Repeat serve to the same viewer that day | ❌ | 0 (only bumps `shows` for the frequency cap) |
| **Click** | ❌ | 0 — free engagement signal that feeds pCTR |

Charging **once per unique viewer per day** (not per pixel-render) is what makes
the spend predictable and bot-resistant, and it's enforced by the primary key
`(boost_id, viewer_id, day)` on `boost_impressions`.

Minimums: budget ≥ 100 MMK, daily cap between 50 MMK and the budget, bid ≥ 1 MMK,
flight length 1–90 days.

---

## 2. Data model

```
boosts
  id, owner_id, target_type('post'|'shop_product'|'pos_product'), target_id
  headline
  budget_mmk, spent_mmk, daily_cap_mmk, bid_mmk       -- money / auction
  audience (jsonb: {adult, region, tags})             -- targeting
  start_at, end_at, status                            -- schedule / state
  impressions, reach, clicks                          -- counters
boost_impressions  (billing ledger + frequency cap)
  PK (boost_id, viewer_id, day)
  shows, clicked, charge_mmk
```

`status ∈ active | paused | completed | cancelled | rejected`.

**RLS:** owners/admins read their own `boosts`; nobody reads a competitor's
budget/spend. The serving path never selects the table directly — it goes
through `get_feed_boosts` (SECURITY DEFINER) which returns only viewer-safe
columns for *eligible* campaigns.

---

## 3. The serving algorithm

Serving happens in two layers: **eligibility** (SQL, in `get_feed_boosts`) and
**ranking** (TypeScript, in `src/lib/ads/rank.ts`).

### 3.1 Eligibility filter (SQL)

A campaign is eligible to show to the current viewer iff **all** hold:

1. `status = 'active'`
2. `now ∈ [start_at, end_at)` — inside its flight
3. `spent_mmk < budget_mmk` — budget left
4. `spent_today < daily_cap_mmk` — daily-cap headroom (Yangon day)
5. `owner_id ≠ viewer` — never charge someone to see their own ad
6. viewer's `shows` for this campaign today `< frequency_cap` (default 4) — the
   **frequency cap** that stops one ad from following a person around all day

### 3.2 Ranking (eCPM auction + pacing)

For each eligible candidate we compute an **auction value** — the expected
revenue of giving it the slot — and the highest wins.

```
pCTR   = (clicks + 1) / (impressions + 24)        # Beta(1,24) smoothing, ~4% prior
eCPM   = bid × (0.5 + pCTR)                        # value of one served view
pacing = clamp( roomToday / idealDaily , 0 , 1.5 ) # spread budget over the flight
score  = eCPM × pacing
```

where

```
roomToday  = daily_cap − spent_today
idealDaily = budget / flight_days
```

**Why each term:**

- **`bid`** — the advertiser's willingness to pay. More budget behind a view ⇒
  more likely to win the slot. This is the core of any ad auction.
- **`pCTR` (smoothed)** — favours ads people actually click. Smoothing with a
  Beta(1, 24) prior stops a campaign with 1 impression / 1 click from looking
  like a 100%-CTR juggernaut, and stops a fresh campaign from being stuck at 0.
  As real data accrues the estimate converges to the truth.
- **`0.5 +`** — because we bill per view (CPV), every ad banks half its bid just
  for being seen; the CTR half is the tie-breaker that rewards engaging creative
  — better for viewers *and* advertisers.
- **`pacing`** — keeps a campaign from blowing its whole daily cap in the first
  hour. If it's *behind* its ideal daily pace (lots of `roomToday`), pacing > 1
  and it's favoured to catch up; as it approaches the cap, pacing → 0 and it
  bows out so the budget lasts the full flight.

Candidates whose pacing is 0 (cap hit / budget gone) are dropped entirely.

### 3.3 Placement

```
SPONSORED_SLOT = 2   # after the 2nd organic post
```

The feed opens with real content, then the top-ranked ad is spliced in at index
2. One ad per 10-item page keeps density low (~10%). The ad renders as a normal
card with a **Sponsored / အခပေးကြော်ငြာ** label.

### 3.4 Billing & signals (client → server)

- When the sponsored card is ≥ 50 % visible for 1 s → `record_boost_impression`
  (bills once per viewer/day, bumps `shows`, may complete the campaign).
- When the viewer taps through → `record_boost_click` (free, sets `clicked`,
  increments `clicks` → improves that campaign's future pCTR).

---

## 4. Worked example

Budget 1 000, daily cap 300, bid 50, 7-day flight, on a post.

1. `create_boost` → wallet −1 000 (escrow). `spent=0`.
2. Viewer A sees it → billed 50 (`spent=50`, `impressions=1`). Sees it again
   later the same day → free (`shows=2`).
3. A taps it → `clicks=1`, free. Future pCTR ≈ (1+1)/(1+24) ≈ 8 %.
4. Owner scrolls past their own ad → **not** billed.
5. Ten more unique viewers that day → billing stops the instant `spent_today`
   reaches the **300** daily cap (extra views still show, free).
6. Advertiser cancels → refund `1000 − 300 = 700` back to G-Pay; status
   `cancelled`. Total real cost = 300.

*(All six steps are covered by the migration's validation smoke test.)*

---

## 5. Anti-abuse

- **Self-view / self-click** never bills (`owner_id ≠ viewer`).
- **One charge per viewer/day** — refreshing or leaving the tab open can't run
  up the bill; enforced by a primary key, not app logic.
- **Daily cap + budget clamp** — a view can only ever charge
  `min(bid, budget_left, daily_room)`, so overspend is structurally impossible.
- **Frequency cap** stops ad fatigue and spreads reach across the audience.
- **Escrow up front** — no campaign can serve without the money already set
  aside, and refunds only ever return the *unspent* remainder.
- Money moves solely inside SECURITY DEFINER RPCs behind the `gpay.allow_ledger`
  guard trigger — clients cannot mint, charge, or refund directly.
