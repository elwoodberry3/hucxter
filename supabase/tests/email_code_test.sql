-- Email-code lockout redesign (Brief 03C.1 §3.0; Founder amendment 1).
-- Limits passed below mirror EMAIL_CODE_LIMITS in apps/web/src/server/auth/otp-limits.ts:
-- 5 checks per send, 3 sends per browser/h, 6 per address/h, overflow 1 per 600 s with 3 checks,
-- 3 known-device sends/h, ceiling 15 wrong checks, session TTL 600 s; daily cap 30 wrong checks,
-- then trickle mode: one send per 3600 s with 2 checks (Brief 03C.1b H2).
begin;
create extension if not exists pgtap with schema extensions;
select plan(46);

create function pg_temp.h(t text) returns text language sql as $$ select repeat(t, 64) $$;
create function pg_temp.send(email text, browser text, device text default null)
returns text language sql as $$
  select kind from public.email_code_send(pg_temp.h(email), pg_temp.h(browser),
    case when device is null then null else pg_temp.h(device) end, 5, 3, 6, 600, 3, 3, 600, 30, 3600, 2)
$$;
create function pg_temp.check_(email text, browser text) returns uuid language sql as $$
  select public.email_code_check_begin(pg_temp.h(email), pg_temp.h(browser), 15, 600, 30)
$$;

-- Grants: service role only
select ok(not has_function_privilege('anon', 'public.email_code_send(text, text, text, int, int, int, int, int, int, int, int, int, int)', 'execute'), 'anon cannot send');
select ok(not has_function_privilege('authenticated', 'public.email_code_check_begin(text, text, int, int, int)', 'execute'), 'authenticated cannot check');
select ok(not has_function_privilege('authenticated', 'public.email_known_device_add(text, text)', 'execute'), 'authenticated cannot add known devices');
select ok(has_function_privilege('service_role', 'public.email_code_send(text, text, text, int, int, int, int, int, int, int, int, int, int)', 'execute'), 'service_role can send');
select is(
  (select count(*)::int from information_schema.role_table_grants
   where table_name in ('email_code_sessions', 'email_code_checks', 'email_code_ceilings', 'email_known_devices', 'email_code_lockdowns')
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

-- Daily cap (Brief 03C.1b H2): 30 wrong checks in 24 h from new devices → trickle mode, not a lock.
select is(pg_temp.send('d', '9'), 'normal', 'address d: a normal code before the cap');
insert into public.email_code_checks (session_id, email_hash, created_at)
select (select id from public.email_code_sessions where email_hash = pg_temp.h('d') and browser_hash = pg_temp.h('9')),
  pg_temp.h('d'), now() - interval '2 hours'
from generate_series(1, 30);
select is(public.email_code_daily_wrong(pg_temp.h('d')), 30, '30 wrong checks in the last 24 h');
select is(pg_temp.check_('d', '9'), null, 'at the cap, a code sent before trickle mode stops working');
select is((select count(*)::int from public.audit_log where action = 'auth.email_code_daily_cap'
  and reason = 'address hash ' || left(pg_temp.h('d'), 16)), 1, 'one audit alert when the episode starts');
select is(pg_temp.send('d', '1'), 'trickle', 'a new device still gets a code (trickle mode)');
select is((select checks_allowed from public.email_code_sessions where kind = 'trickle' and email_hash = pg_temp.h('d')), 2,
  'trickle codes get 2 checks');
select is(pg_temp.send('d', '2'), 'trickle_wait', 'a second new-device code within the hour is refused');
select ok(pg_temp.check_('d', '1') is not null and pg_temp.check_('d', '1') is not null, 'two checks on the trickle code');
select is(pg_temp.check_('d', '1'), null, 'a third check on the trickle code is refused');
select public.email_known_device_add(pg_temp.h('d'), pg_temp.h('e'));
select is(pg_temp.send('d', '3', 'e'), 'known', 'a known device is unaffected by trickle mode');
select isnt(pg_temp.check_('d', '3'), null, 'and can check its code');
update public.email_code_sessions set sent_at = sent_at - interval '61 minutes'
where kind = 'trickle' and email_hash = pg_temp.h('d');
select is(pg_temp.send('d', '2'), 'trickle', 'an hour later, the next new-device code');
select is((select count(*)::int from public.audit_log where action = 'auth.email_code_daily_cap'
  and reason = 'address hash ' || left(pg_temp.h('d'), 16)), 1, 'still one audit alert for the episode');
update public.email_code_checks set created_at = created_at - interval '24 hours' where email_hash = pg_temp.h('d');
update public.email_code_lockdowns set started_at = started_at - interval '24 hours' where email_hash = pg_temp.h('d');
-- A full day of trickle guesses (48) doesn't restart the episode: only normal and overflow checks
-- count toward the cap, so trickle mode ends 24 h after it started (3C.1b review M1).
insert into public.email_code_checks (session_id, email_hash, created_at)
select (select id from public.email_code_sessions where email_hash = pg_temp.h('d') and kind = 'trickle'
          order by sent_at desc limit 1),
  pg_temp.h('d'), now() - interval '1 hour'
from generate_series(1, 48);
select is(public.email_code_daily_wrong(pg_temp.h('d')), 0, 'trickle checks don''t count toward the cap');
select is(pg_temp.send('d', '4'), 'normal', 'after 24 h, normal codes return');
select ok(not has_function_privilege('service_role', 'public.email_code_trickle(text, int)', 'execute'),
  'the trickle helper is internal');
select ok(exists (select 1 from pg_class where relname = 'email_code_lockdowns' and relrowsecurity),
  'RLS is on for email_code_lockdowns');

select * from finish();
rollback;
