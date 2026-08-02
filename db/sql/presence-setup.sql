-- Online/offline presence: a heartbeat timestamp on profiles.
-- The app and the web stamp last_seen_at every minute while open; anyone seen
-- within the last 2 minutes shows an "Active now" green dot in the messenger.
--
-- Run with the psql one-liner (then restart postgrest):
--   DBPASS=$(sudo cat /root/gwaveadmin_newpw.txt); curl -fsSL <raw-url> | \
--     sudo docker run --rm -i -e PGPASSWORD="$DBPASS" postgres:15 \
--     psql -h gwave-db.c5w6wyccw6bo.ap-southeast-1.rds.amazonaws.com \
--          -U gwaveadmin -d gwave -f -

alter table public.profiles
  add column if not exists last_seen_at timestamptz;

create index if not exists profiles_last_seen_idx
  on public.profiles (last_seen_at desc);
