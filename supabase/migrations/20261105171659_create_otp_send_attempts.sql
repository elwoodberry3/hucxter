-- App-level one-time-code send limits (Brief 03 · 3B, Founder amendment 1), on top of Supabase
-- Auth's own limits. Stores a keyed hash of the normalized email or phone number (HMAC computed in
-- apps/web), never the value. Limits are passed in from apps/web/src/server/auth/otp-limits.ts.
-- Service role only. Rows older than 2 days are pruned on write.
-- Recovery: additive. `drop function public.otp_send_attempt(text, text, uuid, int, int, int);
-- drop table public.otp_send_attempts;`

create table public.otp_send_attempts (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('email', 'phone')),
  subject_hash text not null check (subject_hash ~ '^[0-9a-f]{64}$'),
  user_id uuid references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.otp_send_attempts is
  'One-time-code sends for rate limiting: kind + keyed hash of the address/number (never the value).';

create index otp_send_attempts_subject_idx on public.otp_send_attempts (kind, subject_hash, created_at);
create index otp_send_attempts_user_idx on public.otp_send_attempts (user_id, kind, created_at);
create index otp_send_attempts_created_at_idx on public.otp_send_attempts (created_at);

alter table public.otp_send_attempts enable row level security;
revoke all on public.otp_send_attempts from anon, authenticated, service_role;

-- Records a send if it is within the limits and returns 0; otherwise records nothing and returns
-- the seconds until the next send is allowed. Windows: per subject 1 h; per user 1 h; distinct
-- subjects per user 24 h. A null limit (or null user) skips that check. Serialized per subject
-- and per user with transaction-scoped advisory locks so parallel requests can't overshoot.
create or replace function public.otp_send_attempt(
  p_kind text,
  p_subject_hash text,
  p_user_id uuid,
  p_max_per_subject_hour int,
  p_max_per_user_hour int,
  p_max_distinct_per_user_day int
)
returns int
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_retry int := 0;
  v_oldest timestamptz;
  v_count int;
begin
  if p_kind not in ('email', 'phone') or p_subject_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid otp_send_attempt arguments' using errcode = 'invalid_parameter_value';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_kind || ':' || p_subject_hash, 0));
  if p_user_id is not null then
    perform pg_advisory_xact_lock(hashtextextended('user:' || p_user_id::text, 0));
  end if;

  delete from public.otp_send_attempts where created_at < v_now - interval '2 days';

  if p_max_per_subject_hour is not null then
    select count(*), min(created_at) into v_count, v_oldest
    from public.otp_send_attempts
    where kind = p_kind and subject_hash = p_subject_hash and created_at > v_now - interval '1 hour';
    if v_count >= p_max_per_subject_hour then
      v_retry := greatest(v_retry, ceil(extract(epoch from v_oldest + interval '1 hour' - v_now))::int);
    end if;
  end if;

  if p_user_id is not null and p_max_per_user_hour is not null then
    select count(*), min(created_at) into v_count, v_oldest
    from public.otp_send_attempts
    where kind = p_kind and user_id = p_user_id and created_at > v_now - interval '1 hour';
    if v_count >= p_max_per_user_hour then
      v_retry := greatest(v_retry, ceil(extract(epoch from v_oldest + interval '1 hour' - v_now))::int);
    end if;
  end if;

  if p_user_id is not null and p_max_distinct_per_user_day is not null and not exists (
    select 1 from public.otp_send_attempts
    where kind = p_kind and user_id = p_user_id and subject_hash = p_subject_hash
      and created_at > v_now - interval '24 hours'
  ) then
    select count(distinct subject_hash), min(created_at) into v_count, v_oldest
    from public.otp_send_attempts
    where kind = p_kind and user_id = p_user_id and created_at > v_now - interval '24 hours';
    if v_count >= p_max_distinct_per_user_day then
      v_retry := greatest(v_retry, ceil(extract(epoch from v_oldest + interval '24 hours' - v_now))::int);
    end if;
  end if;

  if v_retry > 0 then
    return v_retry;
  end if;

  insert into public.otp_send_attempts (kind, subject_hash, user_id)
  values (p_kind, p_subject_hash, p_user_id);
  return 0;
end;
$$;

revoke execute on function public.otp_send_attempt(text, text, uuid, int, int, int)
  from public, anon, authenticated;
grant execute on function public.otp_send_attempt(text, text, uuid, int, int, int) to service_role;
