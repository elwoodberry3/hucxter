-- Profile reports (Brief 03C.2 §4.2): by @handle, verified members only, not yourself, one open
-- report per profile, and the reporter's id never leaves the database.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email, aud, role, email_confirmed_at, phone_confirmed_at, phone, created_at) values
  ('00000000-0000-4000-8000-0000000c3a01', 'reporter@example.test', 'authenticated', 'authenticated', now(), now(), '15035550191', now()),
  ('00000000-0000-4000-8000-0000000c3a02', 'target@example.test', 'authenticated', 'authenticated', now(), now(), '15035550192', now()),
  ('00000000-0000-4000-8000-0000000c3a03', 'unverified3@example.test', 'authenticated', 'authenticated', now(), null, null, now());
update public.profiles set display_name = 'Robin', handle = 'robin_rpt', home_zip = '97205', age_attested_at = now()
where id = '00000000-0000-4000-8000-0000000c3a01';
update public.profiles set display_name = 'Jordan', handle = 'jordan_rpt', home_zip = '97205', age_attested_at = now()
where id = '00000000-0000-4000-8000-0000000c3a02';

select ok(not has_function_privilege('anon', 'public.report_profile(text, public.report_reason, text)', 'execute'),
  'guests cannot report profiles');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000c3a01", "role": "authenticated"}';
select is(public.report_profile('jordan_rpt',
  'harassment', 'Rude bio'), 'created', 'a member reports a profile by handle');
select is(public.report_profile('JORDAN_RPT',
  'harassment', ''), 'duplicate', 'handles match case-insensitively; one open report per profile');
select is(public.report_profile('robin_rpt',
  'other', ''), 'not_found', 'members cannot report themselves');
select is(public.report_profile('nobody_here', 'other', ''), 'not_found', 'unknown handles are not found');
reset role;

select is((select count(*)::int from public.reports where target_type = 'profile'
  and target_id = '00000000-0000-4000-8000-0000000c3a02'), 1, 'one profile report row');

-- A deleted profile can't be reported
update public.profiles set deleted_at = now() where id = '00000000-0000-4000-8000-0000000c3a02';
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000c3a01", "role": "authenticated"}';
select is(public.report_profile('jordan_rpt',
  'other', ''), 'not_found', 'a deleted profile is not found');

-- Unverified members are refused
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000c3a03", "role": "authenticated"}';
select throws_ok($$select public.report_profile('jordan_rpt', 'other', '')$$, '42501', null,
  'unverified members cannot report');
reset role;

select * from finish();
rollback;
