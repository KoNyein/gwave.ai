# Phase 7 — POS (Loyverse-style)

Adds the point-of-sale module at `/pos`: tablet-friendly sell screen,
printable receipts with refunds, inventory with CSV import/export, shift
management with cash reconciliation, sales reports, and staff/manager
roles per store.

## What was built

### Data layer

- **Migration** `supabase/migrations/20260705180000_pos.sql`:
  - Enums: `store_role` (staff/manager), `payment_method` (cash/card/qr),
    `sale_status`, `stock_reason` (sale/refund/adjustment/purchase).
  - Tables: `stores` (per-store `next_receipt_number` counter),
    `store_members`, `pos_categories`, `pos_products` (sku/barcode/price/
    cost/track_stock), `inventory` (quantity + low-stock threshold, kept
    current by a trigger on `stock_movements`), `stock_movements`,
    `pos_customers`, `shifts` (**one open shift per store** via partial
    unique index; float, cash in/out, expected vs actual), `sales`
    (unique per-store receipt numbers), `sale_items` (price snapshots),
    `sale_payments`.
  - **`create_sale()` RPC** (SECURITY DEFINER, atomic): membership +
    open-shift checks, **prices always come from the catalog** (client
    only sends product ids/quantities/discounts), line/cart discount
    validation, payment-covers-total check, receipt number claimed under
    a row lock, stock movements for tracked products — all or nothing.
  - **`refund_sale()` RPC**: manager-only, marks the sale refunded and
    writes positive `refund` stock movements.
  - **RLS**: everything store-scoped via `is_store_member()` /
    `is_store_manager()` (the owner is an implicit manager). Staff can
    read the catalog, manage customers, open/update shifts and sell (via
    the RPC); only managers touch products, categories, adjustments,
    members and refunds. Sales/items/payments are read-only through
    PostgREST — inserts happen only inside the RPC.

### Features

1. **Sell screen** (`/pos/sell`) — left: product grid (min 92px touch
   targets) with category tabs and a combined search/barcode input
   (Enter adds an exact barcode match); right: sticky cart with qty
   steppers, per-line absolute discounts, cart discount, customer
   picker with inline quick-add, running totals. **Charge flow**: method
   (cash/card/QR) → amount tendered → live change calculation → confirm
   → receipt number + change-due screen → new sale. Selling requires an
   **open shift** — otherwise an "open shift" card with float entry
   appears. The cart lives in a Zustand store (memory only, per plan).
2. **Receipts** (`/pos/receipts`) — history with totals/status; detail
   page renders an **80mm receipt** (302px monospace layout, print CSS
   hides the chrome) with print, email (mailto with the receipt text)
   and **manager-only refund** that restores tracked stock.
3. **Inventory** (`/pos/inventory`, manager-only) — product list with
   stock and **low-stock highlighting**, product dialog (name, category
   or new-category, price, cost, SKU, barcode, track-stock, threshold,
   active flag), stock adjustment dialog (+receive/−remove with reason
   and note), **CSV export** (`/api/pos/products.csv`) and **CSV
   import** (name,price required; category/sku/barcode/cost optional;
   max 500 rows, categories auto-created).
4. **Shifts** (`/pos/shifts`) — current-shift card showing float, cash
   sales, cash in/out and computed **expected cash**; cash-in/out
   dialogs; close dialog with expected vs actual and live difference;
   history list with per-shift over/short.
5. **Reports** (`/pos/reports`, manager-only) — date-range picker
   (default last 30 days): total sales / transactions / average cards,
   sales-by-day bar chart, payment-method pie, top-10 items table,
   category breakdown bars (recharts).
6. **Staff** (`/pos/staff`, manager-only) — add members by username as
   staff (sell only) or manager, remove members. The POS sub-nav hides
   manager pages from staff and the pages themselves redirect.

## Quality gates

```bash
pnpm typecheck   # OK
pnpm lint        # no warnings or errors
pnpm build       # compiled successfully (8 new /pos routes)
```

Migration chain (0001 → 0008) applied to a scratch PostgreSQL 16
instance with asserts: stock trigger math (purchase +20 → sale −2 →
refund +2), server-side totals (12.50×2−1 = 24.00), sequential receipt
numbers, sale-without-shift and underpayment rejected inside the RPC,
staff cannot create products or refund, staff can sell, outsiders see
no products or sales.

## How to test manually

1. Apply the migration; open `/pos` → create your store.
2. **Inventory**: add a category and a few products (or CSV-import),
   receive stock via Adjust (+20).
3. **Sell**: open a shift with a float; tap products, edit quantities,
   add a line discount; Charge → cash → tender more than the total →
   confirm; note the change due and receipt number.
4. **Receipt**: open it, print preview (80mm layout), refund it as the
   manager and watch stock return in Inventory.
5. **Shifts**: record cash in/out; close the shift with a deliberately
   wrong actual amount and see the difference; check history.
6. **Reports**: pick a range covering your test sales; verify charts
   and top items.
7. **Roles**: add a second account as *staff* — confirm they can sell
   but see no Inventory/Reports/Staff tabs and cannot refund.

## Notes / follow-ups

- Product image upload is wired into the schema (`image_path`) but the
  dialog ships without an uploader; the media bucket from Phase 1 is
  ready for it.
- Full offline mode is explicitly out of scope (plan); the in-memory
  cart survives navigation but not a hard refresh.
- Multi-store per account is schema-ready (membership table) — the UI
  currently picks the first store.
- Phase 8 (Admin + Developer dashboards) is next.
