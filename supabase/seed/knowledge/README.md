# Knowledge seed — split parts

The combined `../knowledge_seed.sql` is ~1 MB, which the Supabase **web**
SQL Editor truncates on paste (you then get `syntax error at or near`).
These parts avoid that: each file is one complete, idempotent statement.

## How to load (Supabase web SQL Editor)
Open each file below, copy ALL of it, paste into a new query, and Run.
Do them in order. Re-running any part is safe (`on conflict do nothing`).

1. `part_1_strains.sql`
2. `part_2_strains.sql`
3. `part_3_strains.sql`
4. `part_4_strains.sql`
5. `part_5_strains.sql`
6. `part_6_strains.sql`
7. `part_7_strains.sql`
8. `part_8_strains.sql`
9. `part_9_minerals.sql`

## Faster: Supabase CLI / psql (loads everything at once)
```bash
psql "$DATABASE_URL" -f supabase/seed/knowledge_seed.sql
```
