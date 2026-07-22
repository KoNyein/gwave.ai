-- Live Sale pins and co-host room changes never reached viewers.
--
-- `live_products` (the pinned Live-Sale product) and `cohost_rooms` were never
-- added to the `supabase_realtime` publication, and neither has a broadcast
-- fallback. So a host pinning a product, or a co-host room ending, changed rows
-- that no subscriber ever heard about — viewers only saw it after a manual
-- refresh, and viewers of an ended co-host room were never ejected.
--
-- `live_chat_messages`, `live_streams` and `live_locations` were already in the
-- publication; these two were simply missed when the features shipped.
--
-- Publication membership is idempotent-unsafe (adding twice errors), hence the
-- guards — this file has to stay re-runnable like the rest of the migrations.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'live_products'
  ) then
    alter publication supabase_realtime add table public.live_products;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'cohost_rooms'
  ) then
    alter publication supabase_realtime add table public.cohost_rooms;
  end if;
end $$;

-- Realtime replays row changes to subscribers, and RLS still applies per
-- subscriber, so this widens delivery without widening visibility.
