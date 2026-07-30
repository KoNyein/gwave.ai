-- Dropship listings: everything a reseller needs to show a customer.
--
-- A dropshipper's actual job is presenting someone else's product convincingly.
-- Right now a listing carries a title, one price and a photo gallery — which is
-- not enough to answer the three questions every customer asks: what does it
-- look like from the other side, what exactly am I getting, and can I trust the
-- seller. AliExpress already publishes all of that; we were importing a
-- fraction of it.
--
-- Everything here is nullable and additive, so old rows and hand-entered
-- listings keep working untouched.
--
-- jsonb rather than child tables, for the same reason images is an array:
-- the product screen is a hot path and CLAUDE.md's rule stands — a PostgREST
-- embed there 500s the moment the schema cache goes stale. These arrive with
-- the row, no join, no second query.
--
-- Run in dockerised psql, then: sudo docker restart postgrest

alter table public.shop_products
  -- [{ "name": "Material", "value": "Aluminium alloy" }, …]
  add column if not exists specs jsonb,
  -- [{ "name": "Colour: Black / Size: L", "image": "https://…", "price": 12.5 }, …]
  add column if not exists variants jsonb,
  -- The merchant's own social proof. Kept as plain numbers rather than a
  -- rendered string so the UI can format them per language.
  add column if not exists rating numeric(3, 2)
    check (rating is null or (rating >= 0 and rating <= 5)),
  add column if not exists reviews_count integer
    check (reviews_count is null or reviews_count >= 0),
  add column if not exists orders_count integer
    check (orders_count is null or orders_count >= 0),
  -- List price before the merchant's discount, so the saving can be shown
  -- honestly instead of invented.
  add column if not exists original_price numeric(12, 2)
    check (original_price is null or original_price >= 0),
  add column if not exists store_name text
    check (store_name is null or char_length(store_name) <= 120),
  add column if not exists store_url text
    check (store_url is null or char_length(store_url) <= 1000),
  add column if not exists video_url text
    check (video_url is null or char_length(video_url) <= 1000),
  -- Free text: "Free shipping · 12-20 days to Thailand". Deliberately not
  -- structured — carriers and estimates differ per item and per destination,
  -- and a fake-precise "arrives Tuesday" would be a lie.
  add column if not exists shipping_note text
    check (shipping_note is null or char_length(shipping_note) <= 300),
  -- When the merchant data was last pulled, so the UI can say how stale the
  -- price is instead of implying it is live.
  add column if not exists source_synced_at timestamptz;

-- Bound the jsonb the same way the array columns are bounded: a listing should
-- not be able to carry an essay, and these come from an upstream we do not
-- control.
alter table public.shop_products
  drop constraint if exists shop_products_specs_sane;
alter table public.shop_products
  add constraint shop_products_specs_sane check (
    specs is null
    or (jsonb_typeof(specs) = 'array'
        and jsonb_array_length(specs) <= 60
        and length(specs::text) <= 20000)
  );

alter table public.shop_products
  drop constraint if exists shop_products_variants_sane;
alter table public.shop_products
  add constraint shop_products_variants_sane check (
    variants is null
    or (jsonb_typeof(variants) = 'array'
        and jsonb_array_length(variants) <= 60
        and length(variants::text) <= 20000)
  );

-- A merchant gallery is routinely more than the ten a hand-photographed
-- listing needs: AliExpress ships six product shots plus the variant images,
-- and a reseller wants all of them to send to a customer.
alter table public.shop_products
  drop constraint if exists shop_products_images_sane;
alter table public.shop_products
  add constraint shop_products_images_sane check (
    images is null
    or (
      array_ndims(images) = 1
      and coalesce(array_length(images, 1), 0) between 1 and 24
      and array_position(images, null) is null
      and '' <> all (images)
      and length(array_to_string(images, ',')) <= 24000
    )
  );

select 'shop-product-detail: done' as status;
