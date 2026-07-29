-- ============================================================================
-- Gwave Books — online book store (ebooks/PDF/EPUB) with G-Pay purchases.
-- Run on EC2 with the dockerised psql, then: sudo docker restart postgrest
--
--   DBPASS=$(sudo cat /root/gwaveadmin_newpw.txt)
--   sudo docker run --rm -i -e PGPASSWORD="$DBPASS" postgres:16 \
--     psql -h gwave-db.c5w6wyccw6bo.ap-southeast-1.rds.amazonaws.com \
--          -U gwaveadmin -d gwave < books-store.sql
--
-- Mirrors the audio platform: public-read catalogue, per-user purchases, and
-- an atomic buy_book RPC that settles through G-Pay (publisher paid when they
-- run an active wallet; platform fee otherwise). Idempotent (IF NOT EXISTS).
-- ============================================================================

create table if not exists public.books (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  author       text not null,
  description  text,
  category     text,                 -- e.g. novel, history, self-help, ပညာရေး
  language     text default 'my',    -- my | en | …
  cover_url    text,                 -- media-bucket path or full URL
  file_url     text,                 -- PDF/EPUB media-bucket path or full URL
  file_format  text default 'pdf',   -- pdf | epub
  pages        integer,
  price        numeric(10,2),        -- null/0 = free
  currency     char(3) default 'USD',
  is_premium   boolean not null default false,
  publisher_id uuid references public.profiles(id) on delete set null,
  published_at timestamptz not null default now(),
  created_at   timestamptz not null default now()
);
create index if not exists books_published on public.books (published_at desc);
create index if not exists books_category on public.books (category);

create table if not exists public.book_purchases (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  book_id     uuid not null references public.books(id) on delete cascade,
  gpay_txn_id uuid,
  created_at  timestamptz not null default now(),
  primary key (user_id, book_id)
);

-- Reading progress (page/percent) so reading resumes across devices.
create table if not exists public.book_progress (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  book_id    uuid not null references public.books(id) on delete cascade,
  percent    numeric(5,2) not null default 0,
  page       integer,
  updated_at timestamptz not null default now(),
  primary key (user_id, book_id)
);

alter table public.books          enable row level security;
alter table public.book_purchases enable row level security;
alter table public.book_progress  enable row level security;

drop policy if exists books_read on public.books;
create policy books_read on public.books for select using (true);

drop policy if exists book_purchases_own on public.book_purchases;
create policy book_purchases_own on public.book_purchases
  for select using (user_id = auth.uid());

drop policy if exists book_progress_own on public.book_progress;
create policy book_progress_own on public.book_progress
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select on public.books, public.book_purchases to authenticated, anon;
grant select, insert, update on public.book_progress to authenticated;

-- Atomic purchase from the G-Pay wallet — same mechanics as buy_audio.
create or replace function public.buy_book(p_book uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_book public.books;
  v_buyer public.gpay_accounts;
  v_seller public.gpay_accounts;
  v_gpay numeric(14,2);
  v_txn uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if public.is_suspended(auth.uid()) then raise exception 'Account suspended'; end if;

  select * into v_book from public.books where id = p_book;
  if not found then raise exception 'Book not found'; end if;
  if v_book.price is null or v_book.price <= 0 then
    raise exception 'This book is not purchasable';
  end if;

  if exists (select 1 from public.book_purchases
             where user_id = auth.uid() and book_id = p_book) then
    return null; -- already owned
  end if;

  v_gpay := round(public.currency_to_gpay(v_book.price, coalesce(v_book.currency,'USD')), 2);
  if v_gpay is null or v_gpay < 0.01 then
    raise exception 'This currency cannot be paid with G-Pay';
  end if;

  select * into v_buyer from public.gpay_accounts where user_id = auth.uid();
  if not found or v_buyer.status <> 'active' then
    raise exception 'Your G-Pay account is not active';
  end if;
  if v_buyer.balance < v_gpay then
    raise exception 'Insufficient G-Pay balance';
  end if;

  perform set_config('gpay.allow_ledger', 'on', true);
  update public.gpay_accounts set balance = balance - v_gpay where id = v_buyer.id;

  if v_book.publisher_id is not null then
    select * into v_seller from public.gpay_accounts
      where user_id = v_book.publisher_id and status = 'active';
  end if;
  if v_seller.id is not null and v_seller.id <> v_buyer.id then
    update public.gpay_accounts set balance = balance + v_gpay where id = v_seller.id;
    insert into public.gpay_transactions (kind, from_account, to_account, amount, note)
      values ('transfer', v_buyer.id, v_seller.id, v_gpay,
              'Book: ' || left(coalesce(v_book.title,'book'),120))
      returning id into v_txn;
  else
    insert into public.gpay_transactions (kind, from_account, to_account, amount, note)
      values ('fee', v_buyer.id, null, v_gpay,
              'Book: ' || left(coalesce(v_book.title,'book'),120))
      returning id into v_txn;
  end if;

  insert into public.book_purchases (user_id, book_id, gpay_txn_id)
    values (auth.uid(), p_book, v_txn)
    on conflict (user_id, book_id) do nothing;

  return v_txn;
end;
$$;

grant execute on function public.buy_book(uuid) to authenticated;
