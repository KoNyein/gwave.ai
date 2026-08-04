-- RLS audit: attempts forbidden operations per role and raises if any
-- succeeds. Run against a LOCAL Postgres stack seeded from supabase/migrations:
--
--   psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -f scripts/rls-audit.sql
--
-- Everything runs inside one transaction and is rolled back — the script
-- is non-destructive. "OK:" notices mean the denial worked as designed.

begin;

-- Helper: impersonate a user for both the local shim and the real PostgREST
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
-- Vendor-cloud camera connections: metadata is owner-read-only, the
-- secrets table is sealed to every client role, and token state cannot
-- be written from the browser at all.
-- ---------------------------------------------------------------------
reset role;
insert into public.camera_vendor_connections
  (id, user_id, provider, provider_account_id, status) values
  ('90000000-0000-0000-0000-0000000000c1',
   '00000000-0000-0000-0000-000000000001', 'fake', 'audit-acct', 'connected');
insert into public.camera_vendor_secrets
  (connection_id, access_token_ciphertext, token_nonce, token_auth_tag) values
  ('90000000-0000-0000-0000-0000000000c1', 'Y2lwaGVy', 'bm9uY2U=', 'dGFn');
set local role authenticated;

-- u1 (owner): may read own metadata, may NOT read secrets or write state.
select pg_temp.impersonate('00000000-0000-0000-0000-000000000001');

do $$ begin
  if not exists (select 1 from public.camera_vendor_connections
                 where id = '90000000-0000-0000-0000-0000000000c1') then
    raise exception 'FAIL: owner cannot read their own vendor connection';
  end if;
  raise notice 'OK: owner reads their own vendor connection metadata';
end $$;

do $$ begin
  begin
    if exists (select 1 from public.camera_vendor_secrets
               where connection_id = '90000000-0000-0000-0000-0000000000c1') then
      raise exception 'FAIL: owner read the vendor secrets table';
    end if;
  exception when insufficient_privilege then
    null; -- revoked grant is the expected denial
  end;
  raise notice 'OK: vendor secrets are sealed even from the owner';
end $$;

do $$ begin
  begin
    update public.camera_vendor_connections
    set status = 'connected', token_expires_at = now() + interval '10 years'
    where id = '90000000-0000-0000-0000-0000000000c1';
    if exists (select 1 from public.camera_vendor_connections
               where id = '90000000-0000-0000-0000-0000000000c1'
                 and token_expires_at > now() + interval '5 years') then
      raise exception 'FAIL: owner rewrote vendor token state from the client';
    end if;
  exception when insufficient_privilege then
    null; -- revoked UPDATE grant is the expected denial
  end;
  raise notice 'OK: client-side vendor connection writes are denied';
end $$;

-- u5 (stranger): sees nothing, writes nothing.
select pg_temp.impersonate('00000000-0000-0000-0000-000000000005');

do $$ begin
  if exists (select 1 from public.camera_vendor_connections
             where id = '90000000-0000-0000-0000-0000000000c1') then
    raise exception 'FAIL: stranger read another user''s vendor connection';
  end if;
  raise notice 'OK: vendor connections are hidden from other users';
end $$;

do $$ begin
  begin
    insert into public.camera_vendor_connections (user_id, provider)
    values ('00000000-0000-0000-0000-000000000005', 'fake');
    raise exception 'FAIL: client inserted a vendor connection directly';
  exception when insufficient_privilege then
    raise notice 'OK: direct vendor connection insert rejected';
  end;
end $$;

-- anon: the whole feature is invisible.
reset role;
set local role anon;

do $$ begin
  begin
    if exists (select 1 from public.camera_vendor_connections) then
      raise exception 'FAIL: anonymous read of vendor connections';
    end if;
  exception when insufficient_privilege then
    null; -- revoked grant is the expected denial
  end;
  raise notice 'OK: anonymous users cannot see vendor connections';
end $$;

do $$ begin
  begin
    if exists (select 1 from public.camera_vendor_secrets) then
      raise exception 'FAIL: anonymous read of vendor secrets';
    end if;
  exception when insufficient_privilege then
    null;
  end;
  raise notice 'OK: anonymous users cannot see vendor secrets';
end $$;

reset role;
set local role authenticated;

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

-- Plain SQL (psql; `\echo` is psql-only).
-- NOTE: this script inserts seed fixtures and is meant for a LOCAL reset DB
-- (a freshly migrated local Postgres), not a live database. To check a live one use the
-- read-only scripts/rls-check.sql instead.
select 'RLS audit passed — every forbidden operation was denied.' as result;
