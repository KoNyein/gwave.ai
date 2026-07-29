-- AliExpress best-seller import: make re-running it safe.
--
-- The importer dedupes on shop_products.source_url (the product's own detail
-- URL) so a second run re-prices the catalogue instead of duplicating it.
-- Without a unique index that dedupe is a check-then-insert, and two imports
-- overlapping — a manual run and the scheduled refresh, say — would both see
-- "not there" and both insert.
--
-- Partial on purpose: hand-entered listings have no source_url, and Postgres
-- allows unlimited NULLs, so they are unaffected. Unlike an ON CONFLICT target
-- this index is only ever inferred by the planner for the equality lookup, so
-- the partial predicate is fine here.
--
-- Run in the SQL editor / dockerised psql, then: sudo docker restart postgrest

create unique index if not exists shop_products_source_url_uq
  on public.shop_products (source_url)
  where source_url is not null;

-- Collapse any duplicates a pre-index run may already have created: keep the
-- oldest row per source_url and retire the rest rather than deleting them, so
-- an order that references one keeps its product.
with ranked as (
  select id,
         row_number() over (
           partition by source_url order by created_at asc, id asc
         ) as rn
  from public.shop_products
  where source_url is not null
)
update public.shop_products p
set status = 'hidden'
from ranked r
where p.id = r.id and r.rn > 1 and p.status = 'active';

select 'shop-aliexpress: done' as status;
