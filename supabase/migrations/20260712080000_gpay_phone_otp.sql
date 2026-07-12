-- G-Pay phone verification — before a member opens a G-Pay account, the phone
-- number they register must be confirmed with a one-time code (OTP) sent by SMS.
--
-- Codes are bcrypt-hashed in a locked-down table (RLS on, no policies) so the
-- plaintext never lives at rest and never reaches a client; only the SECURITY
-- DEFINER functions here touch it. Codes expire, are rate-limited, and lock
-- after too many wrong attempts. pgcrypto (crypt/gen_salt) is in `extensions`.

create table if not exists public.phone_otps (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  phone text not null,
  code_hash text not null,
  verified boolean not null default false,
  attempts int not null default 0,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.phone_otps enable row level security;
revoke all on public.phone_otps from anon, authenticated;

-- Start (or restart) a verification for the caller's chosen phone. Stores the
-- hashed code with a 5-minute expiry. Rate-limited: one code per 30 seconds.
create or replace function public.gpay_start_phone_otp(p_phone text, p_code text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_last timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_phone is null or char_length(p_phone) not between 5 and 20 then
    raise exception 'Enter a valid phone number';
  end if;

  select created_at into v_last from public.phone_otps where user_id = auth.uid();
  if v_last is not null and v_last > now() - interval '30 seconds' then
    raise exception 'Please wait a moment before requesting another code';
  end if;

  insert into public.phone_otps
    (user_id, phone, code_hash, verified, attempts, expires_at, created_at)
    values (auth.uid(), p_phone, crypt(p_code, gen_salt('bf')), false, 0,
            now() + interval '5 minutes', now())
  on conflict (user_id) do update set
    phone = excluded.phone,
    code_hash = excluded.code_hash,
    verified = false,
    attempts = 0,
    expires_at = excluded.expires_at,
    created_at = now();
end;
$$;

grant execute on function public.gpay_start_phone_otp(text, text) to authenticated;

-- Check a code for the caller's phone. Marks the phone verified on success.
-- Returns true/false; locks after 5 wrong attempts or once expired.
create or replace function public.gpay_verify_phone_otp(p_phone text, p_code text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v public.phone_otps;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  select * into v from public.phone_otps where user_id = auth.uid();
  if not found or v.phone <> p_phone then
    return false;
  end if;
  if v.verified then
    return true;
  end if;
  if v.expires_at < now() or v.attempts >= 5 then
    return false;
  end if;
  if crypt(p_code, v.code_hash) = v.code_hash then
    update public.phone_otps set verified = true where user_id = auth.uid();
    return true;
  end if;
  update public.phone_otps set attempts = attempts + 1 where user_id = auth.uid();
  return false;
end;
$$;

grant execute on function public.gpay_verify_phone_otp(text, text) to authenticated;

-- Whether the caller has a verified OTP for exactly this phone (gates KYC).
create or replace function public.gpay_phone_verified(p_phone text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.phone_otps
    where user_id = auth.uid() and phone = p_phone and verified
  );
$$;

grant execute on function public.gpay_phone_verified(text) to authenticated;
