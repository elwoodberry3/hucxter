-- Postgres-backed job queue (ADR-0004; Brief 03C.1 §3.2 "Jobs"). Runs Mux clean-up outside the
-- request: delete an asset, delete a playback id (revoke playback), cancel an upload. Drained by
-- /api/cron/jobs (CRON_SECRET; Vercel Cron in 3E). Payloads hold Mux ids only, never personal
-- data, and have no foreign keys, so a job outlives the listing or account it came from (Founder
-- amendment 2: deletion enqueues jobs before the rows cascade away).
--
-- Recovery: additive. `drop function public.jobs_enqueue(text, jsonb, timestamptz),
-- public.jobs_claim(int, int), public.jobs_complete(bigint), public.jobs_fail(bigint, text);
-- drop table public.jobs;`

create table public.jobs (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('mux_delete_asset', 'mux_delete_playback_id', 'mux_cancel_upload')),
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and pg_column_size(payload) < 2048),
  run_after timestamptz not null default now(),
  attempts int not null default 0,
  max_attempts int not null default 8,
  locked_until timestamptz,
  last_error text check (last_error is null or last_error ~ '^[a-z0-9_]{1,60}$'),
  done_at timestamptz,
  created_at timestamptz not null default now()
);

create index jobs_ready_idx on public.jobs (run_after) where done_at is null;

alter table public.jobs enable row level security;
revoke all on public.jobs from anon, authenticated, service_role;
grant select on public.jobs to service_role;

create or replace function public.jobs_enqueue(p_kind text, p_payload jsonb, p_run_after timestamptz default now())
returns bigint
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.jobs (kind, payload, run_after) values (p_kind, p_payload, p_run_after)
  returning id;
$$;

-- Claims up to p_limit due jobs and locks them for p_lock_seconds (skip locked: safe to run twice).
create or replace function public.jobs_claim(p_limit int, p_lock_seconds int)
returns setof public.jobs
language sql
volatile
security definer
set search_path = ''
as $$
  update public.jobs j
  set locked_until = now() + make_interval(secs => p_lock_seconds), attempts = j.attempts + 1
  where j.id in (
    select id from public.jobs
    where done_at is null and run_after <= now() and attempts < max_attempts
      and (locked_until is null or locked_until < now())
    order by run_after, id
    limit least(p_limit, 50)
    for update skip locked
  )
  returning j.*;
$$;

create or replace function public.jobs_complete(p_id bigint)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.jobs set done_at = now(), locked_until = null where id = p_id;
$$;

-- Exponential backoff: 2^attempts minutes, capped at 6 hours.
create or replace function public.jobs_fail(p_id bigint, p_error text)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.jobs
  set locked_until = null,
      last_error = p_error,
      run_after = now() + least(make_interval(mins => power(2, attempts)::int), interval '6 hours')
  where id = p_id;
$$;

revoke execute on function public.jobs_enqueue(text, jsonb, timestamptz) from public, anon, authenticated;
revoke execute on function public.jobs_claim(int, int) from public, anon, authenticated;
revoke execute on function public.jobs_complete(bigint) from public, anon, authenticated;
revoke execute on function public.jobs_fail(bigint, text) from public, anon, authenticated;
grant execute on function public.jobs_enqueue(text, jsonb, timestamptz) to service_role;
grant execute on function public.jobs_claim(int, int) to service_role;
grant execute on function public.jobs_complete(bigint) to service_role;
grant execute on function public.jobs_fail(bigint, text) to service_role;
