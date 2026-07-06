# Phase 5 — Calculator Tools

Adds the grower tools hub at `/tools`: six calculators/converters as
polished client components with input validation and "Share as post"
integration, with the two advanced tools gated behind the Phase 4
membership.

## What was built

### Data layer

- **Migration** `supabase/migrations/20260705160000_currency_rates.sql`:
  `currency_rates` table (units per 1 USD; seeded USD 1 / THB 36 /
  MMK 2100), publicly readable, admin-only writes via `is_admin()`.
  The PromptPay THB conversion from Phase 4 (`getThbRate`) now reads
  this table instead of a hard-coded constant.
- `updateCurrencyRate` server action (Zod-validated, USD locked to 1;
  RLS enforces admin).

### Tools hub

- **`/tools`** — searchable index grid (client-side filter over
  translated names/descriptions); member-only tools show a "Members"
  chip and route non-members to `/membership`.
- **`ShareResultButton`** — every calculator can publish its formatted
  result as a public post via the existing `createPost` action, with a
  link to the feed after sharing.
- Login required (existing middleware guard on `/tools`).

### Calculators

1. **EC ↔ PPM converter** (`/tools/ec-converter`) — EC (mS/cm),
   PPM-500 (Hanna) and PPM-700 (Truncheon) stay in sync whichever field
   you edit; scale explainer included.
2. **VPD calculator** (`/tools/vpd`) — Tetens saturation-vapor-pressure
   formula with air temp, leaf offset and RH → VPD in kPa, plotted on a
   0–2 kPa scale with clone (0.4–0.8), veg (0.8–1.2) and flower
   (1.2–1.6) bands; the active stage highlights.
3. **Nutrient mixing calculator** (`/tools/nutrient-calculator`,
   **member-only** via `requireMembership()`) — reservoir liters +
   target EC + N-P-K ratio → grams for Part A / Part B (≈0.65 g/L per
   EC unit, A/B split by N vs P+K weight) with g/L breakdown and a
   clear "follow your manufacturer's chart" disclaimer.
4. **Yield estimator** (`/tools/yield-estimator`, **member-only**) —
   wattage × method (soil 0.5–0.8, hydro 0.8–1.1, SCROG 1.0–1.4 g/W),
   capped at 500 g/plant; shows a total range and per-plant estimate.
5. **Unit converters** (`/tools/converters`) — weight (g/kg/oz/lb),
   area (m²/ft²/cm²/acre) and temperature (°C/°F/K).
6. **Currency converter** (`/tools/currency`) — THB/USD/MMK with swap
   button and the manual rate table; **admins edit rates inline** (each
   row shows per-USD rate + last-updated time).
7. **Profit & break-even** (`/tools/profit`) — unit cost, sell price
   and monthly fixed costs → profit/unit, margin %, markup % and
   break-even units per month.

All calculators validate input ranges and disable sharing until the
result is valid.

## Quality gates

```bash
pnpm typecheck   # OK
pnpm lint        # no warnings or errors
pnpm build       # compiled successfully (8 new /tools routes)
```

Migration chain (0001 → 0006) applied to a scratch PostgreSQL 16
instance: rates seeded and publicly readable, non-admin rate update has
no effect (RLS), admin update works.

## How to test manually

1. Apply the migration; open `/tools` — search filters the grid.
2. EC converter: type 1.6 EC → 800/1120 ppm; edit the ppm fields and
   watch EC follow.
3. VPD: 26°C / offset 2 / 60% RH → ≈1.03 kPa, "Veg" band highlighted.
4. As a **free** account, open the nutrient or yield tool → redirected
   to `/membership`; as a member both open (chip turns green in the
   hub).
5. Currency: convert 100 USD → THB; as an admin edit the THB rate and
   watch the conversion update; confirm the PromptPay page
   (`/membership/promptpay/pro`) reflects the new rate.
6. Profit: cost 6 / price 10 / fixed 1200 → margin 40%, break-even 300
   units.
7. Any tool: "Share as post" → the formatted result appears in your
   feed.

## Notes / follow-ups

- The nutrient calculator is a two-part-salt estimator, not a dosing
  engine; per-element PPM targets could come later with a fertilizer
  database.
- Currency rates are manual by design (plan requirement); an automated
  FX feed could populate the same table later.
- Smart Farm + Smart Home (MQTT) is Phase 6.
