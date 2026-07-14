-- Admin demographics: know where users are (region, via their IANA timezone —
-- "Asia/Yangon" = Myanmar, no IP tracking needed) and their age spread (from
-- the existing birth_date + age_band_of). Both aggregates are admin-only.

alter table public.profiles
  add column if not exists timezone text
    check (timezone is null or char_length(timezone) <= 60);

-- Age distribution by band (child/preteen/teen/adult/unknown). Admin-gated.
create or replace function public.demographics_age()
returns table (band text, count bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;
  return query
    select public.age_band_of(birth_date)::text as band, count(*)::bigint
    from public.profiles
    group by 1
    order by 2 desc;
end;
$$;

-- Region distribution by timezone (a privacy-friendly proxy for location).
create or replace function public.demographics_region()
returns table (region text, count bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;
  return query
    select coalesce(nullif(timezone, ''), 'unknown') as region, count(*)::bigint
    from public.profiles
    group by 1
    order by 2 desc
    limit 50;
end;
$$;

grant execute on function public.demographics_age() to authenticated;
grant execute on function public.demographics_region() to authenticated;
