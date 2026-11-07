-- Email-code lockout redesign (Brief 03C.1 §3.0, PR #9 review "Medium, lockout"; Founder
-- amendment 1 of 2026-11-06). Replaces the per-address "10 wrong codes per hour" lock, which let
-- anyone who knew an address lock its owner out.
--
-- Code checks are tied to the browser that asked for the code (a random httpOnly cookie, stored
-- here only as a keyed hash). Wrong codes end that browser's session ("send a new code"), never a
-- timed lock. A per-address ceiling invalidates every live session when guessing spreads across
-- browsers. A browser that has signed in to the address before ("known device") has its own send
-- allowance, outside the shared pool. Numbers live in apps/web/src/server/auth/otp-limits.ts and
-- are passed in; docs/runbooks/accounts.md §5 has the guessing bound.
--
-- No email, browser id, or IP is stored: email_hash, browser_hash and device_hash are HMACs made
-- by the server (subjectHash in apps/web/src/server/admin-db.ts).
--
-- Recovery: additive. `drop function public.email_code_send(text, text, text, int, int, int, int,
-- int, int, int); drop function public.email_code_refund(uuid); drop function
-- public.email_code_check_begin(text, text, int, int); drop function
-- public.email_code_check_succeeded(text, uuid); drop function public.email_known_device_add(text, text); drop table
-- public.email_code_checks, public.email_code_ceilings, public.email_code_sessions,
-- public.email_known_devices;` and restore allowEmailCodeSend/allowEmailCodeCheck in the app.

create table public.email_code_sessions (
  id uuid primary key default gen_random_uuid(),
  email_hash text not null check (email_hash ~ '^[0-9a-f]{64}$'),
  browser_hash text not null check (browser_hash ~ '^[0-9a-f]{64}$'),
  kind text not null check (kind in ('normal', 'overflow', 'known')),
  checks_allowed int not null check (checks_allowed between 1 and 10),
  checks_used int not null default 0 check (checks_used >= 0),
  sent_at timestamptz not null default now(),
  invalidated_at timestamptz,
  consumed_at timestamptz
);

comment on table public.email_code_sessions is
  'One row per email-code send, bound to the requesting browser (hashes only). Service role only.';

create index email_code_sessions_email_idx on public.email_code_sessions (email_hash, sent_at desc);
create index email_code_sessions_browser_idx
  on public.email_code_sessions (email_hash, browser_hash, sent_at desc);

-- Every reserved code check (right or wrong). A successful check deletes its own row, so what is
-- left are wrong checks.
create table public.email_code_checks (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.email_code_sessions (id) on delete cascade,
  email_hash text not null check (email_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

create index email_code_checks_email_idx on public.email_code_checks (email_hash, created_at desc);
create index email_code_checks_session_idx on public.email_code_checks (session_id);

-- When the per-address ceiling was last hit. Wrong checks are counted since then (or the last
-- hour), so after a ceiling a fresh code starts clean instead of tripping it again.
create table public.email_code_ceilings (
  email_hash text not null check (email_hash ~ '^[0-9a-f]{64}$'),
  hit_at timestamptz not null default now(),
  primary key (email_hash, hit_at)
);

-- Browsers that completed sign-in for an address. device_hash = HMAC of a long-lived random
-- cookie; bound to the address hash, so the cookie is useless for any other address.
create table public.email_known_devices (
  email_hash text not null check (email_hash ~ '^[0-9a-f]{64}$'),
  device_hash text not null check (device_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  primary key (email_hash, device_hash)
);

alter table public.email_code_sessions enable row level security;
alter table public.email_code_checks enable row level security;
alter table public.email_code_ceilings enable row level security;
alter table public.email_known_devices enable row level security;

revoke all on public.email_code_sessions, public.email_code_checks, public.email_code_ceilings,
  public.email_known_devices from anon, authenticated, service_role;
-- Local e2e cleanup and support "clear limits" read and delete rows; writes go through functions.
grant select, delete on public.email_code_sessions, public.email_code_checks,
  public.email_code_ceilings, public.email_known_devices to service_role;

/**
 * Records an email-code send if the limits allow one, and returns the new session.
 *   kind 'known'    — p_device_hash is a known device for this address and it has sent fewer than
 *                     p_known_per_hour codes in the last hour (outside the shared pool);
 *   kind 'normal'   — this browser has sent < p_browser_per_hour and the address < p_email_per_hour
 *                     (normal + overflow sends) in the last hour;
 *   kind 'overflow' — the address pool is used up, this browser is under its limit, and the last
 *                     overflow send for the address was at least p_overflow_spacing_s ago. Gets
 *                     p_overflow_checks checks instead of p_checks_per_send.
 * Returns (null, 'denied') when nothing is allowed.
 */
create or replace function public.email_code_send(
  p_email_hash text,
  p_browser_hash text,
  p_device_hash text,
  p_checks_per_send int,
  p_browser_per_hour int,
  p_email_per_hour int,
  p_overflow_spacing_s int,
  p_overflow_checks int,
  p_known_per_hour int,
  p_session_ttl_s int
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

  -- Housekeeping: rows older than a day can't affect any limit.
  delete from public.email_code_sessions where sent_at < v_now - interval '1 day';
  delete from public.email_code_ceilings where hit_at < v_now - interval '1 day';

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

    select count(*) into v_count from public.email_code_sessions s
    where s.email_hash = p_email_hash and s.kind <> 'known'
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

  insert into public.email_code_sessions (email_hash, browser_hash, kind, checks_allowed, sent_at)
  values (p_email_hash, p_browser_hash, v_kind, v_checks, v_now)
  returning id into v_id;

  return query select v_id, v_kind;
end;
$$;

/** Gives back a send that Supabase refused (failed bot check): no code went out. */
create or replace function public.email_code_refund(p_session_id uuid)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  delete from public.email_code_sessions
  where id = p_session_id and checks_used = 0 and sent_at > now() - interval '5 minutes';
$$;

/**
 * Reserves one code check for this browser before the code is sent to Supabase. Returns the check
 * id, or null when the browser has no live session for the address (none sent, expired, used up,
 * invalidated, or the per-address ceiling was just hit). Reserving first means parallel requests
 * can't exceed the limits.
 */
create or replace function public.email_code_check_begin(
  p_email_hash text,
  p_browser_hash text,
  p_ceiling int,
  p_session_ttl_s int
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
  v_since timestamptz;
  v_wrong int;
  v_check uuid;
begin
  if p_email_hash !~ '^[0-9a-f]{64}$' or p_browser_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid email_code_check_begin arguments'
      using errcode = 'invalid_parameter_value';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('email_code:' || p_email_hash, 0));

  select s.id into v_session from public.email_code_sessions s
  where s.email_hash = p_email_hash and s.browser_hash = p_browser_hash
    and s.invalidated_at is null and s.consumed_at is null
    and s.sent_at > v_now - make_interval(secs => p_session_ttl_s)
    and s.checks_used < s.checks_allowed
  order by s.sent_at desc
  limit 1;

  if v_session is null then
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

/** The code was right: the check wasn't a wrong guess, and every session for the address ends. */
create or replace function public.email_code_check_succeeded(p_email_hash text, p_check_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('email_code:' || p_email_hash, 0));
  delete from public.email_code_checks where id = p_check_id and email_hash = p_email_hash;
  update public.email_code_sessions set consumed_at = now()
  where email_hash = p_email_hash and consumed_at is null;
end;
$$;

/** Remembers this browser as a known device for the address (after a successful sign-in). */
create or replace function public.email_known_device_add(p_email_hash text, p_device_hash text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_email_hash !~ '^[0-9a-f]{64}$' or p_device_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid email_known_device_add arguments'
      using errcode = 'invalid_parameter_value';
  end if;
  insert into public.email_known_devices (email_hash, device_hash)
  values (p_email_hash, p_device_hash)
  on conflict (email_hash, device_hash) do update set last_used_at = now();
  delete from public.email_known_devices where last_used_at < now() - interval '180 days';
end;
$$;

revoke execute on function public.email_code_send(text, text, text, int, int, int, int, int, int, int)
  from public, anon, authenticated;
revoke execute on function public.email_code_refund(uuid) from public, anon, authenticated;
revoke execute on function public.email_code_check_begin(text, text, int, int)
  from public, anon, authenticated;
revoke execute on function public.email_code_check_succeeded(text, uuid)
  from public, anon, authenticated;
revoke execute on function public.email_known_device_add(text, text)
  from public, anon, authenticated;

grant execute on function public.email_code_send(text, text, text, int, int, int, int, int, int, int)
  to service_role;
grant execute on function public.email_code_refund(uuid) to service_role;
grant execute on function public.email_code_check_begin(text, text, int, int) to service_role;
grant execute on function public.email_code_check_succeeded(text, uuid) to service_role;
grant execute on function public.email_known_device_add(text, text) to service_role;
