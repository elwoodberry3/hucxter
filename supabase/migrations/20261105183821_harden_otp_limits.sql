-- OTP limit hardening (Brief 03 · 3B, trust-safety review):
-- 1. Code CHECKS are limited too (kinds 'email_check', 'phone_check'), so a 6-digit code can't be
--    guessed. Supabase Auth's per-IP limits only ever see the app server's IP.
-- 2. Deleting an account keeps its send rows (user_id set null), so per-number limits can't be
--    reset by deleting and signing up again.
-- 3. otp_send_refund() removes a send that Supabase then refused for a failed bot check, so a junk
--    CAPTCHA token can't use up someone else's email allowance.
-- Recovery: `drop function public.otp_send_refund(text, text);`, revoke the service_role grant, restore the kind check to
-- ('email', 'phone') after deleting *_check rows, re-create otp_send_attempt from
-- 20261105171659_create_otp_send_attempts.sql, and restore the user_id FK with `on delete cascade`.

alter table public.otp_send_attempts drop constraint otp_send_attempts_user_id_fkey;
alter table public.otp_send_attempts
  add constraint otp_send_attempts_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete set null;

-- Server-side (service role) may read and clear limiter rows: support/admin "clear limits" and the
-- local e2e cleanup. Inserts still go only through otp_send_attempt().
grant select, delete on public.otp_send_attempts to service_role;

alter table public.otp_send_attempts drop constraint otp_send_attempts_kind_check;
alter table public.otp_send_attempts
  add constraint otp_send_attempts_kind_check
  check (kind in ('email', 'phone', 'email_check', 'phone_check'));

-- Same as 20261105171659, with the check kinds accepted.
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
  if p_kind not in ('email', 'phone', 'email_check', 'phone_check')
    or p_subject_hash !~ '^[0-9a-f]{64}$' then
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

-- Removes the most recent send (last 5 minutes) for this subject. Only for 'email' sends that
-- Supabase refused with captcha_failed: no code went out.
create or replace function public.otp_send_refund(p_kind text, p_subject_hash text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_kind <> 'email' or p_subject_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid otp_send_refund arguments' using errcode = 'invalid_parameter_value';
  end if;
  delete from public.otp_send_attempts
  where id = (
    select id from public.otp_send_attempts
    where kind = p_kind and subject_hash = p_subject_hash
      and created_at > now() - interval '5 minutes'
    order by created_at desc
    limit 1
  );
end;
$$;

revoke execute on function public.otp_send_refund(text, text) from public, anon, authenticated;
grant execute on function public.otp_send_refund(text, text) to service_role;
