-- A self-set presence status shown as a small badge on the user's avatar
-- (available / busy / away / sleep / invisible).
alter table public.profiles
  add column if not exists presence_status text not null default 'available'
  check (presence_status in ('available', 'busy', 'away', 'sleep', 'invisible'));
