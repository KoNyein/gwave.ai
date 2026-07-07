-- RLS audit: attempts forbidden operations per role and raises if any
-- succeeds. Run against a LOCAL stack after `supabase db reset`:
--
--   psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -f scripts/rls-audit.sql
--
-- Everything runs inside one transaction and is rolled back — the script
-- is non-destructive. "OK:" notices mean the denial worked as designed.

begin;

-- Helper: impersonate a user for both local-shim and real Supabase
-- auth.uid() implementations.
create or replace function pg_temp.impersonate(uid uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', uid::text, 'role', 'authenticated')::text,
    true
  );
end;
$$;

-- Fixtures (as superuser, bypassing RLS).
insert into public.posts (id, author_id, content, visibility) values
  ('90000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000001', 'audit friends-only', 'friends'),
  ('90000000-0000-0000-0000-000000000002',
   '00000000-0000-0000-0000-000000000002', 'audit members-only', 'members');
insert into public.devices (id, owner_id, name, type, topic, secret) values
  ('90000000-0000-0000-0000-00000000000d',
   '00000000-0000-0000-0000-000000000001', 'audit sensor', 'sensor',
   'gwave/audit-d', 's');
insert into public.stores (id, owner_id, name) values
  ('90000000-0000-0000-0000-00000000000e',
   '00000000-0000-0000-0000-000000000001', 'audit store');
insert into public.store_members (store_id, user_id, role) values
  ('90000000-0000-0000-0000-00000000000e',
   '00000000-0000-0000-0000-000000000003', 'staff');

set local role authenticated;

-- ---------------------------------------------------------------------
-- As u5: plain user with no friendships to u1.
-- ---------------------------------------------------------------------
select pg_temp.impersonate('00000000-0000-0000-0000-000000000005');

do $$ begin
  if exists (select 1 from public.posts where content = 'audit friends-only') then
    raise exception 'FAIL: non-friend read a friends-only post';
  end if;
  raise notice 'OK: friends-only post hidden from non-friend';
end $$;

do $$ begin
  if exists (select 1 from public.posts where content = 'audit members-only') then
    raise exception 'FAIL: free user read a members-only post';
  end if;
  raise notice 'OK: members-only post hidden from free user';
end $$;

do $$ begin
  begin
    update public.profiles set role = 'admin'
    where id = '00000000-0000-0000-0000-000000000005';
    if exists (select 1 from public.profiles
               where id = '00000000-0000-0000-0000-000000000005'
                 and role = 'admin') then
      raise exception 'FAIL: user escalated their own role';
    end if;
  exception when insufficient_privilege then
    null; -- with-check violation is the expected denial
  end;
  raise notice 'OK: role self-escalation denied';
end $$;

do $$ begin
  begin
    insert into public.subscriptions (user_id, plan_id, provider, status)
    values ('00000000-0000-0000-0000-000000000005', 'pro', 'promptpay', 'active');
    raise exception 'FAIL: user created an ACTIVE subscription';
  exception when insufficient_privilege then
    raise notice 'OK: active subscription insert rejected';
  end;
end $$;

do $$ begin
  begin
    insert into public.sensor_readings (device_id, metric, value)
    values ('90000000-0000-0000-0000-00000000000d', 'ph', 6);
    raise exception 'FAIL: user wrote telemetry directly';
  exception when insufficient_privilege then
    raise notice 'OK: direct telemetry insert rejected';
  end;
end $$;

do $$ begin
  begin
    insert into public.notifications (recipient_id, type)
    values ('00000000-0000-0000-0000-000000000005', 'post_reaction');
    raise exception 'FAIL: user forged a notification';
  exception when insufficient_privilege then
    raise notice 'OK: notification forgery rejected';
  end;
end $$;

do $$ begin
  begin
    update public.currency_rates set rate_per_usd = 1 where code = 'THB';
    if exists (select 1 from public.currency_rates
               where code = 'THB' and rate_per_usd = 1) then
      raise exception 'FAIL: plain user changed currency rates';
    end if;
    raise notice 'OK: currency rate write had no effect';
  end;
end $$;

do $$ begin
  begin
    insert into public.api_keys (owner_id, name, prefix, key_hash)
    values ('00000000-0000-0000-0000-000000000005', 'x', 'auditpfx', 'audithash');
    raise exception 'FAIL: non-developer created an API key';
  exception when insufficient_privilege then
    raise notice 'OK: API key creation rejected for non-developer';
  end;
end $$;

do $$ begin
  if exists (select 1 from public.devices
             where id = '90000000-0000-0000-0000-00000000000d') then
    raise exception 'FAIL: stranger saw a foreign device';
  end if;
  if exists (select 1 from public.pos_products) then
    raise exception 'FAIL: outsider saw store products';
  end if;
  if exists (select 1 from public.audit_logs) then
    raise exception 'FAIL: non-admin read audit logs';
  end if;
  raise notice 'OK: devices/products/audit logs isolated';
end $$;

-- ---------------------------------------------------------------------
-- As u3: POS staff (sell only).
-- ---------------------------------------------------------------------
select pg_temp.impersonate('00000000-0000-0000-0000-000000000003');

do $$ begin
  begin
    insert into public.pos_products (store_id, name, price)
    values ('90000000-0000-0000-0000-00000000000e', 'audit hack', 1);
    raise exception 'FAIL: staff created a product';
  exception when insufficient_privilege then
    raise notice 'OK: staff product creation rejected';
  end;
end $$;

-- ---------------------------------------------------------------------
-- Suspension: u5 suspended (as superuser), then tries to post.
-- ---------------------------------------------------------------------
reset role;
update public.profiles
set suspended_until = now() + interval '1 day'
where id = '00000000-0000-0000-0000-000000000005';
set local role authenticated;
select pg_temp.impersonate('00000000-0000-0000-0000-000000000005');

do $$ begin
  begin
    insert into public.posts (author_id, content)
    values ('00000000-0000-0000-0000-000000000005', 'audit suspended');
    raise exception 'FAIL: suspended user posted';
  exception when insufficient_privilege then
    raise notice 'OK: suspended user cannot post';
  end;
end $$;

reset role;
rollback;

\echo 'RLS audit passed — every forbidden operation was denied.'
