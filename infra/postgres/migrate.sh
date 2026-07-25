#!/usr/bin/env sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"

MIGRATIONS_DIR="${MIGRATIONS_DIR:-infra/postgres/migrations}"
LOCK_ID="${MIGRATION_LOCK_ID:-748219301}"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<SQL
create table if not exists public.schema_migrations (
  filename text primary key,
  checksum text not null,
  applied_at timestamptz not null default now()
);
select pg_advisory_lock(${LOCK_ID});
SQL

cleanup() {
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "select pg_advisory_unlock(${LOCK_ID});" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

find "$MIGRATIONS_DIR" -maxdepth 1 -type f -name '*.sql' | sort | while IFS= read -r file; do
  filename=$(basename "$file")
  checksum=$(sha256sum "$file" | awk '{print $1}')
  existing=$(psql "$DATABASE_URL" -Atqc "select checksum from public.schema_migrations where filename = '$filename'")

  if [ -n "$existing" ]; then
    if [ "$existing" != "$checksum" ]; then
      echo "Migration checksum mismatch: $filename" >&2
      exit 1
    fi
    echo "skip $filename"
    continue
  fi

  echo "apply $filename"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<SQL
begin;
\i $file
insert into public.schema_migrations (filename, checksum)
values ('$filename', '$checksum');
commit;
SQL
done
