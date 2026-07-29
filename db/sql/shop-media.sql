-- Shop: more than one photo per listing.
--
-- A listing has carried exactly one image_url since the shop was built, which
-- is fine for an imported affiliate card and useless for someone selling their
-- own thing: nobody buys a phone case from one photo. This adds an ordered
-- gallery.
--
-- An array column rather than a child table on purpose. The product screen is
-- a hot path, and CLAUDE.md's rule stands — a PostgREST embed there 500s the
-- moment the schema cache goes stale. A text[] arrives with the row, needs no
-- second query, no join and no RLS of its own.
--
-- image_url stays the cover: every existing surface (cards, order rows, the
-- web grid) already reads it, and the seller screens keep it in step with
-- images[1]. Nothing has to be backfilled for old rows to keep working.
--
-- Run in dockerised psql, then: sudo docker restart postgrest

alter table public.shop_products
  add column if not exists images text[];

-- Same shape of guard the other media columns use: a sane number of entries,
-- each a plausible URL or storage key rather than an essay.
--
-- Deliberately free of subqueries: a CHECK constraint cannot contain one
-- ("ERROR: cannot use subquery in check constraint"), so the obvious
-- `not exists (select … from unnest(images))` is rejected outright. The array
-- operators below express the same rules and are allowed — `<> all` tests
-- every element, array_position locates a NULL if one slipped in. Per-element
-- length becomes a cap on the joined string, which bounds it just as well.
alter table public.shop_products
  drop constraint if exists shop_products_images_sane;
alter table public.shop_products
  add constraint shop_products_images_sane check (
    images is null
    or (
      array_ndims(images) = 1
      -- coalesce because array_length('{}', 1) is NULL, and a NULL CHECK
      -- passes — an empty array would otherwise slip through the range.
      and coalesce(array_length(images, 1), 0) between 1 and 10
      and array_position(images, null) is null
      and '' <> all (images)
      and length(array_to_string(images, ',')) <= 10000
    )
  );

-- Give existing listings a one-photo gallery so the seller screens have
-- something to edit rather than starting from empty.
update public.shop_products
set images = array[image_url]
where images is null
  and image_url is not null
  and char_length(image_url) > 0;

select 'shop-media: done, ' || count(*) || ' listing(s) with a gallery' as status
from public.shop_products
where images is not null;
