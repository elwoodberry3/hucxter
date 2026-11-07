-- Email-code lockout redesign (Brief 03C.1 §3.0; Founder amendment 1).
-- Limits passed below mirror EMAIL_CODE_LIMITS in apps/web/src/server/auth/otp-limits.ts:
-- 5 checks per send, 3 sends per browser/h, 6 per address/h, overflow 1 per 600 s with 3 checks,
-- 3 known-device sends/h, ceiling 15 wrong checks, session TTL 600 s.
begin;
create extension if not exists pgtap with schema extensions;
select plan(29);

create function pg_temp.h(t text) returns text language sql as $$ select repeat(t, 64) $$;
create function pg_temp.send(email text, browser text, device text default null)
returns text language sql as $$
  select kind from public.email_code_send(pg_temp.h(email), pg_temp.h(browser),
    case when device is null then null else pg_temp.h(device) end, 5, 3, 6, 600, 3, 3, 600)
$$;
create function pg_temp.check_(email text, browser text) returns uuid language sql as $$
  select public.email_code_check_begin(pg_temp.h(email), pg_temp.h(browser), 15, 600)
$$;

-- Grants: service role only
select ok(not has_function_privilege('anon', 'public.email_code_send(text, text, text, int, int, int, int, int, int, int)', 'execute'), 'anon cannot send');
select ok(not has_function_privilege('authenticated', 'public.email_code_check_begin(text, text, int, int)', 'execute'), 'authenticated cannot check');
select ok(not has_function_privilege('authenticated', 'public.email_known_device_add(text, text)', 'execute'), 'authenticated cannot add known devices');
select ok(has_function_privilege('service_role', 'public.email_code_send(text, text, text, int, int, int, int, int, int, int)', 'execute'), 'service_role can send');
select is(
  (select count(*)::int from information_schema.role_table_grants
   where table_name in ('email_code_sessions', 'email_code_checks', 'email_code_ceilings', 'email_known_devices')
     and grantee in ('anon', 'authenticated')),
  0, 'anon and authenticated have no grants on the email-code tables');

-- A check needs a send from the same browser
select is(pg_temp.check_('a', '1'), null, 'no session: check refused (send a new code)');
select is(pg_temp.send('a', '1'), 'normal', 'first send is normal');
select is(pg_temp.check_('a', '2'), null, 'another browser cannot check this browser''s code');

-- 5 checks per send, then a new code is needed (no timer)
select ok((select bool_and(pg_temp.check_('a', '1') is not null) from generate_series(1, 5)), 'five checks allowed per send');
select is(pg_temp.check_('a', '1'), null, 'sixth check refused');
select is(pg_temp.send('a', '1'), 'normal', 'the same browser can get a fresh code right away');
select isnt(pg_temp.check_('a', '1'), null, 'and check it');

-- Per-browser sends: 3 per hour
select is(pg_temp.send('a', '1'), 'normal', 'third send from browser 1');
select is(pg_temp.send('a', '1'), 'denied', 'fourth send from the same browser is refused');

-- Per-address pool of 6, then overflow (one per 10 min, 3 checks)
select is(pg_temp.send('a', '3'), 'normal', 'fourth address send (browser 3)');
select is((select pg_temp.send('a', '4') || pg_temp.send('a', '4')), 'normalnormal', 'fifth and sixth sends');
select is(pg_temp.send('a', '5'), 'overflow', 'seventh send is overflow');
select is((select checks_allowed from public.email_code_sessions where kind = 'overflow' and email_hash = pg_temp.h('a')), 3, 'overflow sessions get 3 checks');
select is(pg_temp.send('a', '6'), 'denied', 'a second overflow within 10 minutes is refused');
update public.email_code_sessions set sent_at = sent_at - interval '11 minutes' where kind = 'overflow';
select is(pg_temp.send('a', '6'), 'overflow', 'overflow opens again after 10 minutes');

-- Known device: own allowance outside the pool, only for an address it signed in to
select public.email_known_device_add(pg_temp.h('a'), pg_temp.h('e'));
select is(pg_temp.send('a', '7', 'e'), 'known', 'known device still gets a code when the pool is empty');
select is(pg_temp.send('a', '8', 'f'), 'denied', 'an unknown device id gets nothing extra');
select is(pg_temp.send('b', '7', 'e'), 'normal', 'the known-device cookie gives nothing extra for another address');

-- Ceiling: 15 wrong checks across browsers invalidates every live session, then starts fresh
select pg_temp.send('c', b::text) from generate_series(1, 3) b;
select pg_temp.check_('c', b::text) from generate_series(1, 3) b, generate_series(1, 5) n;
select is(pg_temp.send('c', '4'), 'normal', 'a fourth browser gets a code');
select is(pg_temp.check_('c', '4'), null, 'ceiling hit (15 wrong checks): outstanding codes are invalidated');
select is(
  (select count(*)::int from public.email_code_sessions
   where email_hash = pg_temp.h('c') and invalidated_at is null and consumed_at is null),
  0, 'no live session is left for the address');
select is(
  (select count(*)::int from public.audit_log where action = 'auth.email_code_ceiling'),
  1, 'the ceiling is written to audit_log (hash prefix only)');
select is(pg_temp.send('c', '9'), 'normal', 'a new code can be requested right away');
select isnt(pg_temp.check_('c', '9'), null, 'and checked: no timed lock');

select * from finish();
rollback;
