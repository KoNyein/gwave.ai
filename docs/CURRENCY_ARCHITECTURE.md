# gwave.ai — Currency & Wallet Architecture

G-Pay ကို နိုင်ငံတကာ ဘဏ်စနစ်၊ Cryptocurrency များနှင့် ချိတ်ဆက်နိုင်မယ့်
**Digital Wallet** တစ်ခုအဖြစ် တဖြည်းဖြည်း တိုးချဲ့နိုင်ရန် ရေးဆွဲထားသော
architecture။ ယနေ့ ship ဖြစ်ပြီးသား အပိုင်းနှင့် နောက်ဆက်တွဲ roadmap ကို
ခွဲပြထားသည်။

---

## အခြေခံ စည်းမျဉ်း — Peg

> **1 G-Pay = 1 MMK** (Myanmar Kyat) — အမြဲ ချိတ်ဆက်။

- Wallet `balance` သည် **အမြဲ MMK** ဖြင့် သိမ်းဆည်းသည်။
- Peg ကို code ထဲ `GPAY_PEG_CODE = "MMK"` (`src/lib/currency.ts`) နှင့်
  DB function `gpay_convert()` တွင် hardcode ထားသည် — environment ဖြင့်
  ကွဲသွားခြင်း မဖြစ်စေရန်။
- MMK ၏ USD ငွေလဲနှုန်းသာ ရွေ့နိုင်သည်; peg ကိုယ်တိုင် မရွေ့။

---

## ✅ ယခု ship ပြီးသား (Phase A — Foundation)

| အပိုင်း | တည်နေရာ |
| --- | --- |
| ISO 4217 fiat + crypto rate table (metadata: name/symbol/kind/decimals/flag) | `currency_rates` (migration `20260712010000`) |
| In-DB **Conversion Engine** (ACID) `gpay_convert(amount, from, to)` + `gpay_to_currency` / `currency_to_gpay` | migration function |
| USD cross-rate conversion library + peg helpers + `formatMoney` | `src/lib/currency.ts` |
| Auto-detect viewer currency (browser locale → region → currency) | `detectCurrency()` |
| Currency converter UI — fiat/crypto groups, auto-detect, G-Pay equivalent | `src/components/tools/currency-converter.tsx` |
| Admin rate editing (RLS admin-only) | `updateCurrencyRate` action |

Conversion formula: `amount(from) ÷ rate_per_usd(from) × rate_per_usd(to)`.
`round(…, 8)` ဖြင့် crypto precision အထိ ထောက်ပံ့သည်။

---

## 🔜 Roadmap

### Phase B — Real-time rates
- **Exchange-rate API** ချိတ် — Open Exchange Rates / Fixer.io / ဗဟိုဘဏ် feed။
  Scheduled job (cron / Lambda) က `currency_rates.rate_per_usd` ကို
  update လုပ်; UI/DB function မပြောင်းရ (rate row သာ ရေးသည်)။
- Crypto price — **Chainlink price feeds** / CoinGecko oracle → BTC/ETH/USDT။
- Rate history table + staleness badge (feed ရပ်သွားရင် admin သိရန်)။

### Phase C — Ledger (Double-entry + ACID)
- ငွေဝင်/ငွေထွက်ကို **Debit / Credit** ဖြင့် balanced ledger အဖြစ် မှတ်ရန်
  (`ledger_accounts`, `ledger_entries`, `ledger_transactions`)။
- Constraint: transaction တစ်ခုအတွင်း `sum(debit) = sum(credit)`; PostgreSQL
  transaction (**ACID**) ဖြင့် လမ်းဝက် ပြတ်တောက်လည်း ငွေ မပျောက်။
- Idempotency key — client retry တွင် ထပ်ဖြတ်ခြင်း မဖြစ်စေရန်။

### Phase D — International banking standards
- **ISO 20022** message mapping (`pain.001` credit transfer, `camt.05x`
  statements) — internal transfer object ↔ ISO 20022 JSON/XML adapter layer။
- Bank connectivity — **OAuth 2.0** client-credentials + **mTLS**;
  bank Sandbox API များနှင့် staging environment တွင် အရင် test။
- PII/secret encryption at rest + in transit; least-privilege service roles။

### Phase E — Crypto / Stablecoin
- G-Pay ကို **MMK-backed stablecoin** အဖြစ် — **ERC-20** (Ethereum) /
  **BEP-20** (BSC) smart contract; 1 token = 1 MMK reserve-backed။
- **Custody** — Hot/Cold wallet segregation, multisig, withdrawal limits။
- **Liquidity pools** — crypto ↔ G-Pay swap; slippage/fee policy။
- Deploy မလုပ်ခင် **third-party security audit** (contract + backend)။

### Phase F — Compliance
- **KYC** (identity verification) + **AML** (transaction monitoring,
  sanctions screening, SAR) — နိုင်ငံတော် digital-wallet license အတွက် မရှိမဖြစ်။
- Audit trail (immutable) + regulatory reporting hooks။

---

## Tech notes

- **DB:** PostgreSQL (**Amazon RDS**, self-hosted PostgREST ကနေ ဝင်ရောက်) —
  ACID transactions၊ RLS။ Hot-path cache
  အတွက် Redis နောက်မှ ထည့်နိုင်။
- **Services:** ယခု conversion engine က in-DB SQL function; load
  တက်လာရင် Node/Go **microservice** အဖြစ် ခွဲထုတ်ရန် interface အဆင်သင့်။
- Peg နှင့် conversion ကို တစ်နေရာတည်း (`lib/currency.ts` + DB function)
  မှာသာ ထားသဖြင့် call-site များ မပြောင်းဘဲ feed/microservice ပြောင်းလို့ရ။
