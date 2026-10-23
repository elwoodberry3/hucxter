---
name: hucxster-db-migrations
description: Safe Supabase/Postgres schema change workflow for HUCXSTER — writing migrations, RLS policies, seeds, and database tests. Use whenever a task adds or alters tables, columns, indexes, functions, policies, or seed data.
---

# Database migrations & RLS

## Workflow
1. Read existing migrations in `supabase/migrations/` and the current schema before writing.
2. `supabase migration new <verb_noun>` → write SQL. One concern per migration.
3. `supabase db reset` locally; it must succeed from zero.
4. Add/extend tests in `supabase/tests/` (pgTAP); run `supabase test db`.
5. Regenerate types into `packages/contracts/db.ts` if the project uses generated types.
6. Never edit a migration that has been applied to any shared environment; write a new one.
7. Never run `supabase db push` or touch a linked/remote project without explicit Founder approval
   in the current session.

## Every new table
- `id uuid primary key default gen_random_uuid()`, `created_at timestamptz not null default now()`,
  `updated_at` with trigger where rows mutate.
- `alter table ... enable row level security;` plus explicit policies. Default posture: the
  `authenticated` role can read only what the product shows, and **writes go through the API using
  the service role**, so most tables need select policies only.
- Foreign keys with explicit `on delete` behavior. Soft delete (`deleted_at`) for user content.
- Indexes for every foreign key used in a join and every feed/filter predicate.
- Column-level revokes for private columns (e.g., `precise_point`, phone).

## Risky changes (need a written plan in the PR)
Dropping/renaming columns, type changes on large tables, backfills, non-concurrent index builds on
populated tables. Use expand → migrate → contract across separate migrations.

## Rollback
State in the PR: how to reverse (down SQL or forward fix), and whether data is lost.
