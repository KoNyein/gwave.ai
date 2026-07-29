-- profiles.gender — collected at sign-up (male | female | other); gates
-- gender-specific app features (the cycle tracker shows only for female
-- profiles). Idempotent. Run on EC2 with the dockerised psql, then:
--   sudo docker restart postgrest
--
--   DBPASS=$(sudo cat /root/gwaveadmin_newpw.txt)
--   sudo docker run --rm -i -e PGPASSWORD="$DBPASS" postgres:16 \
--     psql -h gwave-db.c5w6wyccw6bo.ap-southeast-1.rds.amazonaws.com \
--          -U gwaveadmin -d gwave < profiles-gender.sql

alter table public.profiles
  add column if not exists gender text
  check (gender in ('male', 'female', 'other'));
