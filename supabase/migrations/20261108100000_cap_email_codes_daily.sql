-- Daily per-address cap on wrong email codes (Brief 03C.1b H2; PR #10 review M3; Founder amendment
-- 1 of 2026-11-08: no hard lockdown). When an address reaches p_daily_wrong_cap wrong checks in a
-- rolling 24 h (checks on sessions from browsers that aren't known devices), new devices go into
-- trickle mode for the rest of the 24 h: at most one send per p_trickle_spacing_s for the address,
-- p_trickle_checks checks each (Turnstile is still required on every send when it's enabled).
-- Known devices and Google sign-in are unaffected. The first hit of an episode writes one
-- audit_log alert (hash prefix only). Bound: docs/runbooks/accounts.md §5.
--
-- Sessions are kept 25 h (was 24 h) so the 24 h count is exact: a check comes at most 10 minutes
-- after its send.
--
-- Recovery: drop function public.email_code_send(text, text, text, int, int, int, int, int, int,
-- int, int, int, int); drop function public.email_code_check_begin(text, text, int, int, int);
-- drop table public.email_code_lockdowns; delete from public.email_code_sessions where kind =
-- 'trickle'; restore the kind CHECK without 'trickle'; then re-run both functions and their grants
-- from 20261106210123_create_email_code_sessions.sql.

alter table public.email_code_sessions drop constraint email_code_sessions_kind_check;
alter table public.email_code_sessions
  add constraint email_code_sessions_kind_check
  check (kind in ('normal', 'overflow', 'known', 'trickle'));

-- An address in trickle mode since started_at (one row per address; one audit alert per episode).
create table public.email_code_lockdowns (
  email_hash text primary key check (email_hash ~ '^[0-9a-f]{64}$'),
  started_at timestamptz not null default now()
);

comment on table public.email_code_lockdowns is
  'Addresses whose new devices are in trickle mode after the daily wrong-code cap (hash only). Service role only.';

alter table public.email_code_lockdowns enable row level security;
revoke all on public.email_code_lockdowns from anon, authenticated, service_role;
-- Local e2e cleanup and support (runbook §5) read and clear rows; writes go through functions.
grant select, delete on public.email_code_lockdowns to service_role;

-- Wrong checks in the last 24 h from browsers that aren't known devices for the address.
create or replace function public.email_code_daily_wrong(p_email_hash text)
returns int
language sql
stable
set search_path = ''
as $$
  select count(*)::int
  from public.email_code_checks k
  join public.email_code_sessions s on s.id = k.session_id
  where k.email_hash = p_email_hash and s.kind <> 'known'
    and k.created_at > now() - interval '24 hours'
$$;

-- Starts (or continues) a trickle episode. Returns true while the address is in trickle mode.
create or replace function public.email_code_trickle(p_email_hash text, p_daily_wrong_cap int)
returns boolean
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_started timestamptz;
begin
  select started_at into v_started from public.email_code_lockdowns where email_hash = p_email_hash;
  if v_started is not null and v_started > now() - interval '24 hours' then
    return true;
  end if;
  if public.email_code_daily_wrong(p_email_hash) < p_daily_wrong_cap then
    return false;
  end if;
  insert into public.email_code_lockdowns (email_hash, started_at) values (p_email_hash, now())
  on conflict (email_hash) do update set started_at = excluded.started_at;
  -- Visible to admins: someone is guessing codes for this address (hash prefix only).
  insert into public.audit_log (actor_id, action, target_type, target_id, reason)
  values (null, 'auth.email_code_daily_cap', 'email_code', null,
          'address hash ' || left(p_email_hash, 16));
  -- Codes already out to new devices stop working; trickle sends start fresh.
  update public.email_code_sessions set invalidated_at = now()
  where email_hash = p_email_hash and kind in ('normal', 'overflow')
    and invalidated_at is null and consumed_at is null;
  return true;
end;
$$;

drop function public.email_code_send(text, text, text, int, int, int, int, int, int, int);

/**
 * Records an email-code send if the limits allow one, and returns the new session.
 *   kind 'known'    — p_device_hash is a known device for this address and it has sent fewer than
 *                     p_known_per_hour codes in the last hour (outside the shared pool);
 *   kind 'trickle'  — the address is in trickle mode (daily wrong-code cap): one send per
 *                     p_trickle_spacing_s for the address, p_trickle_checks checks; otherwise
 *                     (null, 'trickle_wait');
 *   kind 'normal'   — this browser has sent < p_browser_per_hour and the address < p_email_per_hour
 *                     (normal + overflow sends) in the last hour;
 *   kind 'overflow' — the address pool is used up, this browser is under its limit, and the last
 *                     overflow send for the address was at least p_overflow_spacing_s ago. Gets
 *                     p_overflow_checks checks instead of p_checks_per_send.
 * Returns (null, 'denied') when nothing is allowed.
 */
create function public.email_code_send(
  p_email_hash text,
  p_browser_hash text,
  p_device_hash text,
  p_checks_per_send int,
  p_browser_per_hour int,
  p_email_per_hour int,
  p_overflow_spacing_s int,
  p_overflow_checks int,
  p_known_per_hour int,
  p_session_ttl_s int,
  p_daily_wrong_cap int,
  p_trickle_spacing_s int,
  p_trickle_checks int
)
returns table (session_id uuid, kind text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_kind text;
  v_checks int;
  v_id uuid;
  v_count int;
begin
  if p_email_hash !~ '^[0-9a-f]{64}$' or p_browser_hash !~ '^[0-9a-f]{64}$'
    or (p_device_hash is not null and p_device_hash !~ '^[0-9a-f]{64}$') then
    raise exception 'invalid email_code_send arguments' using errcode = 'invalid_parameter_value';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('email_code:' || p_email_hash, 0));

  -- Housekeeping: rows this old can't affect any limit.
  delete from public.email_code_sessions where sent_at < v_now - interval '25 hours';
  delete from public.email_code_ceilings where hit_at < v_now - interval '1 day';
  delete from public.email_code_lockdowns where started_at < v_now - interval '2 days';

  if p_device_hash is not null and exists (
    select 1 from public.email_known_devices d
    where d.email_hash = p_email_hash and d.device_hash = p_device_hash
  ) then
    select count(*) into v_count from public.email_code_sessions s
    where s.email_hash = p_email_hash and s.browser_hash = p_browser_hash
      and s.kind = 'known' and s.sent_at > v_now - interval '1 hour';
    if v_count < p_known_per_hour then
      v_kind := 'known';
      v_checks := p_checks_per_send;
    end if;
  end if;

  if v_kind is null then
    select count(*) into v_count from public.email_code_sessions s
    where s.email_hash = p_email_hash and s.browser_hash = p_browser_hash
      and s.kind <> 'known' and s.sent_at > v_now - interval '1 hour';
    if v_count >= p_browser_per_hour then
      return query select null::uuid, 'denied'::text;
      return;
    end if;

    if public.email_code_trickle(p_email_hash, p_daily_wrong_cap) then
      if exists (
        select 1 from public.email_code_sessions s
        where s.email_hash = p_email_hash and s.kind = 'trickle'
          and s.sent_at > v_now - make_interval(secs => p_trickle_spacing_s)
      ) then
        return query select null::uuid, 'trickle_wait'::text;
        return;
      end if;
      v_kind := 'trickle';
      v_checks := p_trickle_checks;
    else
      select count(*) into v_count from public.email_code_sessions s
      where s.email_hash = p_email_hash and s.kind in ('normal', 'overflow')
        and s.sent_at > v_now - interval '1 hour';
      if v_count < p_email_per_hour then
        v_kind := 'normal';
        v_checks := p_checks_per_send;
      elsif not exists (
        select 1 from public.email_code_sessions s
        where s.email_hash = p_email_hash and s.kind = 'overflow'
          and s.sent_at > v_now - make_interval(secs => p_overflow_spacing_s)
      ) then
        v_kind := 'overflow';
        v_checks := p_overflow_checks;
      else
        return query select null::uuid, 'denied'::text;
        return;
      end if;
    end if;
  end if;

  insert into public.email_code_sessions (email_hash, browser_hash, kind, checks_allowed, sent_at)
  values (p_email_hash, p_browser_hash, v_kind, v_checks, v_now)
  returning id into v_id;

  return query select v_id, v_kind;
end;
$$;

drop function public.email_code_check_begin(text, text, int, int);

/**
 * Reserves one code check for this browser before the code is sent to Supabase. Returns the check
 * id, or null when the browser has no live session for the address (none sent, expired, used up,
 * invalidated, the hourly ceiling was just hit, or a new-device session met the daily cap, which
 * starts trickle mode). Reserving first means parallel requests can't exceed the limits.
 */
create function public.email_code_check_begin(
  p_email_hash text,
  p_browser_hash text,
  p_ceiling int,
  p_session_ttl_s int,
  p_daily_wrong_cap int
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_session uuid;
  v_kind text;
  v_since timestamptz;
  v_wrong int;
  v_check uuid;
begin
  if p_email_hash !~ '^[0-9a-f]{64}$' or p_browser_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid email_code_check_begin arguments'
      using errcode = 'invalid_parameter_value';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('email_code:' || p_email_hash, 0));

  select s.id, s.kind into v_session, v_kind from public.email_code_sessions s
  where s.email_hash = p_email_hash and s.browser_hash = p_browser_hash
    and s.invalidated_at is null and s.consumed_at is null
    and s.sent_at > v_now - make_interval(secs => p_session_ttl_s)
    and s.checks_used < s.checks_allowed
  order by s.sent_at desc
  limit 1;

  if v_session is null then
    return null;
  end if;

  -- Daily cap: a normal or overflow session (sent before trickle mode) stops here and the episode
  -- starts; trickle sessions are already bounded by their own few checks.
  if v_kind in ('normal', 'overflow') and public.email_code_trickle(p_email_hash, p_daily_wrong_cap) then
    return null;
  end if;

  select greatest(v_now - interval '1 hour', coalesce(max(c.hit_at), '-infinity'::timestamptz))
  into v_since
  from public.email_code_ceilings c where c.email_hash = p_email_hash;

  select count(*) into v_wrong from public.email_code_checks k
  where k.email_hash = p_email_hash and k.created_at > v_since;

  if v_wrong >= p_ceiling then
    insert into public.email_code_ceilings (email_hash, hit_at) values (p_email_hash, v_now);
    update public.email_code_sessions set invalidated_at = v_now
    where email_hash = p_email_hash and invalidated_at is null and consumed_at is null;
    -- Visible to admins: someone is guessing codes for this address (hash prefix only).
    insert into public.audit_log (actor_id, action, target_type, target_id, reason)
    values (null, 'auth.email_code_ceiling', 'email_code', null,
            'address hash ' || left(p_email_hash, 16));
    return null;
  end if;

  update public.email_code_sessions set checks_used = checks_used + 1 where id = v_session;
  insert into public.email_code_checks (session_id, email_hash, created_at)
  values (v_session, p_email_hash, v_now)
  returning id into v_check;
  return v_check;
end;
$$;

revoke execute on function public.email_code_daily_wrong(text) from public, anon, authenticated, service_role;
revoke execute on function public.email_code_trickle(text, int) from public, anon, authenticated, service_role;
revoke execute on function public.email_code_send(text, text, text, int, int, int, int, int, int, int, int, int, int)
  from public, anon, authenticated;
revoke execute on function public.email_code_check_begin(text, text, int, int, int)
  from public, anon, authenticated;
grant execute on function public.email_code_send(text, text, text, int, int, int, int, int, int, int, int, int, int)
  to service_role;
grant execute on function public.email_code_check_begin(text, text, int, int, int) to service_role;
