-- OPTIONAL: turn the AliExpress listings we already carry into in-app sales.
--
-- An affiliate listing has to hand the buyer over to AliExpress — that is the
-- whole mechanism: they pay AliExpress, we earn commission, and we never touch
-- the money so we cannot take the order. If you want the purchase to finish
-- inside Gwave, the listing has to be a dropship one: the buyer orders here
-- (cash on delivery), and you fulfil it by ordering from AliExpress yourself.
--
-- This converts the existing rows. New imports pick their kind in the admin
-- panel on /shop, so this only matters for what is already in the catalogue.
--
-- external_url is cleared because that is what every surface reads to offer a
-- handoff; source_url is kept, because whoever fulfils the order needs the
-- merchant page. The web product page only shows source_url for affiliate
-- listings now, so it stays out of the buyer's way.
--
-- The 1.25 is a 25% margin over what AliExpress charges. Change it to match
-- the markup you use in the admin panel — and note that "ဈေးအသစ်ယူ"
-- (action: refresh) recomputes the price from the live merchant price times
-- the markup you pass it, so running it later does NOT compound this.
--
-- Run in dockerised psql, then: sudo docker restart postgrest

update public.shop_products
set kind = 'dropship',
    external_url = null,
    price = case when price is not null
                 then round(price * 1.25, 2)
                 else null end,
    updated_at = now()
where merchant = 'AliExpress'
  and kind = 'affiliate'
  and source_url is not null;

select 'shop-aliexpress-dropship: converted ' || count(*) || ' listing(s)' as status
from public.shop_products
where merchant = 'AliExpress' and kind = 'dropship';
