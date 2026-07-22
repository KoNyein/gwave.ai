# Knowledge seed — split parts

The combined `../knowledge_seed.sql` is ~1 MB. These parts split it up: each file
is one complete, idempotent statement. They exist because the hosted Supabase
**web** SQL Editor truncated the combined file on paste (you then got
`syntax error at or near`) — that editor is gone (gwave moved to AWS on
2026-07-17; the database is now **RDS**), but the split files are still handy for
any tool with a paste/statement size limit.

## Preferred: psql against RDS (loads everything at once)
```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/seed/knowledge_seed.sql
```

## If you must load piecewise
Run each file below in order; re-running any part is safe
(`on conflict do nothing`).

1. `part_1_strains.sql`
2. `part_2_strains.sql`
3. `part_3_strains.sql`
4. `part_4_strains.sql`
5. `part_5_strains.sql`
6. `part_6_strains.sql`
7. `part_7_strains.sql`
8. `part_8_strains.sql`
9. `part_9_minerals.sql`
