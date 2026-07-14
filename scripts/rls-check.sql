-- Read-only RLS coverage check — SAFE to run on the LIVE database.
-- Paste into the Supabase SQL Editor and Run. It only READS catalog metadata:
-- no inserts, no writes, nothing to roll back.
--
-- For every table in the `public` schema it reports whether Row Level Security
-- is enabled and how many policies it has. What to look for:
--   * rls_enabled = false          -> a table with NO protection (investigate!)
--   * policy_count = 0 with RLS on -> locked table: only gpay_pins and
--                                     phone_otps are meant to be like this
--                                     (secret hashes, reached via RPC only).
-- Anything else with 0 policies means clients can't read/write it at all.

select
  c.relname                       as table_name,
  c.relrowsecurity                as rls_enabled,
  count(p.polname)                as policy_count,
  case
    when not c.relrowsecurity                       then '❌ NO RLS'
    when count(p.polname) = 0
         and c.relname in ('gpay_pins', 'phone_otps') then '🔒 locked (intended)'
    when count(p.polname) = 0                       then '⚠️ RLS on, no policy'
    else '✅ ok'
  end                             as verdict
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policy p on p.polrelid = c.oid
where n.nspname = 'public'
  and c.relkind = 'r'          -- ordinary tables only
group by c.relname, c.relrowsecurity
order by
  c.relrowsecurity asc,        -- unprotected tables float to the top
  count(p.polname) asc,
  c.relname;

-- Quick one-line summary: total tables, how many have RLS, how many unprotected.
select
  count(*)                                        as total_tables,
  count(*) filter (where relrowsecurity)          as rls_enabled,
  count(*) filter (where not relrowsecurity)      as unprotected
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r';
