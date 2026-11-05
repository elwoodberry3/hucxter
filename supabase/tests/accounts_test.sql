begin;

create extension if not exists pgtap with schema extensions;

select plan(46);

-- Fixtures: two users (the trigger creates their profiles), a session each, one invite.
insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-4000-8000-0000000000a1', 'alice@e2e.hucxter.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000b2', 'bob@e2e.hucxter.test', 'authenticated', 'authenticated');
insert into auth.sessions (id, user_id, created_at, updated_at, user_agent, ip)
values
  ('00000000-0000-4000-8000-00000000a5a5', '00000000-0000-4000-8000-0000000000a1', now(), now(), 'Mozilla/5.0 (iPhone)', '203.0.113.7'),
  ('00000000-0000-4000-8000-00000000b5b5', '00000000-0000-4000-8000-0000000000b2', now(), now(), 'Mozilla/5.0 (X11)', '203.0.113.8');
insert into public.qa_invites (email) values ('Alice@E2E.hucxter.test');

-- Structure and RLS
select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'app_roles', 'app_roles table exists');
select has_table('public', 'qa_invites', 'qa_invites table exists');
select has_table('public', 'audit_log', 'audit_log table exists');
select has_table('public', 'otp_send_attempts', 'otp_send_attempts table exists');
select is_empty(
  $$select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and c.relname in ('profiles', 'app_roles', 'qa_invites', 'audit_log', 'otp_send_attempts')
      and not c.relrowsecurity$$,
  'RLS is enabled on every account table'
);
select is(
  (select count(*)::int from public.profiles),
  2,
  'creating an auth user creates a profile'
);
select hasnt_column('public', 'profiles', 'phone', 'profiles has no phone column');
select hasnt_column('public', 'profiles', 'email', 'profiles has no email column');
select hasnt_column('public', 'profiles', 'date_of_birth', 'profiles has no date of birth');

-- Function hardening (Founder amendment 2)
select is_empty(
  $$select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('my_sessions', 'has_role', 'attest_age', 'current_user_invited',
        'otp_send_attempt', 'hook_before_user_created', 'handle_new_user', 'audit_log_append_only')
      and not coalesce(p.proconfig @> array['search_path=""'], false)$$,
  'every account function sets search_path to empty'
);
select is_empty(
  $$select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('my_sessions', 'has_role', 'attest_age', 'current_user_invited',
        'otp_send_attempt', 'hook_before_user_created', 'handle_new_user', 'audit_log_append_only')
      and has_function_privilege('anon', p.oid, 'execute')$$,
  'anon can execute none of the account functions'
);
select ok(
  not has_function_privilege('authenticated', 'public.hook_before_user_created(jsonb)', 'execute'),
  'authenticated cannot execute the before-user-created hook'
);
select ok(
  not has_function_privilege('service_role', 'public.hook_before_user_created(jsonb)', 'execute'),
  'service_role cannot execute the before-user-created hook'
);
select ok(
  has_function_privilege('supabase_auth_admin', 'public.hook_before_user_created(jsonb)', 'execute'),
  'supabase_auth_admin can execute the before-user-created hook'
);
select ok(
  not has_function_privilege('authenticated', 'public.otp_send_attempt(text, text, uuid, int, int, int)', 'execute'),
  'authenticated cannot execute otp_send_attempt'
);
select ok(
  not has_function_privilege('authenticated', 'public.handle_new_user()', 'execute'),
  'authenticated cannot execute handle_new_user'
);

-- Before-user-created hook
select is(
  public.hook_before_user_created('{"user": {"email": "ALICE@e2e.hucxter.test"}}'::jsonb),
  '{}'::jsonb,
  'hook allows an invited email (case-insensitive)'
);
select is(
  public.hook_before_user_created('{"user": {"email": "mallory@e2e.hucxter.test"}}'::jsonb) -> 'error' ->> 'http_code',
  '403',
  'hook rejects an uninvited email with 403'
);
select is(
  public.hook_before_user_created('{"user": {"email": "mallory@e2e.hucxter.test"}}'::jsonb) -> 'error' ->> 'message',
  'Hucxter is in a closed test. Ask the team for an invite.',
  'hook rejection carries the closed-test copy'
);
select ok(
  public.hook_before_user_created('{"user": {"phone": "15035550100"}}'::jsonb) ? 'error',
  'hook rejects a user without an email'
);

-- Display name rules (mirror DisplayName in packages/contracts)
select throws_ok(
  $$update public.profiles set display_name = 'see www.example.com' where id = '00000000-0000-4000-8000-0000000000a1'$$,
  '23514', null, 'display name rejects a URL'
);
select throws_ok(
  $$update public.profiles set display_name = 'me@example.com' where id = '00000000-0000-4000-8000-0000000000a1'$$,
  '23514', null, 'display name rejects an email'
);
select throws_ok(
  $$update public.profiles set display_name = 'Call 503 555 0100' where id = '00000000-0000-4000-8000-0000000000a1'$$,
  '23514', null, 'display name rejects a phone number'
);
select throws_ok(
  $$update public.profiles set display_name = 'A' where id = '00000000-0000-4000-8000-0000000000a1'$$,
  '23514', null, 'display name needs 2+ characters'
);
select lives_ok(
  $$update public.profiles set display_name = 'Sam 2' where id = '00000000-0000-4000-8000-0000000000a1'$$,
  'display name accepts a nickname'
);

-- Audit log is append-only
select lives_ok(
  $$insert into public.audit_log (actor_id, action, target_type, target_id)
    values ('00000000-0000-4000-8000-0000000000a1', 'account.deleted', 'user', '00000000-0000-4000-8000-0000000000a1')$$,
  'audit_log accepts inserts'
);
select throws_ok($$update public.audit_log set reason = 'x'$$, '42501', null, 'audit_log rows cannot be updated');
select throws_ok($$delete from public.audit_log$$, '42501', null, 'audit_log rows cannot be deleted');

-- OTP send limits (per subject per hour)
select is(
  public.otp_send_attempt('phone', repeat('a', 64), '00000000-0000-4000-8000-0000000000a1', 2, 5, 3),
  0, 'first phone send is allowed'
);
select is(
  public.otp_send_attempt('phone', repeat('a', 64), '00000000-0000-4000-8000-0000000000a1', 2, 5, 3),
  0, 'second phone send is allowed'
);
select ok(
  public.otp_send_attempt('phone', repeat('a', 64), '00000000-0000-4000-8000-0000000000a1', 2, 5, 3) between 1 and 3600,
  'third send to the same number within an hour returns a retry-after'
);
select ok(
  public.otp_send_attempt('phone', repeat('b', 64), '00000000-0000-4000-8000-0000000000a1', 2, 5, 1) between 1 and 86400,
  'a new number is refused once the daily distinct-number limit (1 here) is reached'
);

-- Anonymous role sees nothing
set local role anon;
select throws_ok($$select * from public.profiles$$, '42501', null, 'anon cannot read profiles');
select throws_ok($$select * from public.qa_invites$$, '42501', null, 'anon cannot read qa_invites');
select throws_ok($$select public.my_sessions()$$, '42501', null, 'anon cannot call my_sessions');
reset role;

-- Authenticated as Alice
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000a1", "role": "authenticated", "session_id": "00000000-0000-4000-8000-00000000a5a5"}';

select is(
  (select array_agg(id) from public.profiles),
  array['00000000-0000-4000-8000-0000000000a1'::uuid],
  'a member reads only their own profile'
);
select lives_ok(
  $$update public.profiles set home_zip = '97205', display_name = 'Alice' where id = '00000000-0000-4000-8000-0000000000a1'$$,
  'a member can update their display name and home ZIP'
);
select throws_ok(
  $$update public.profiles set age_attested_at = now() where id = '00000000-0000-4000-8000-0000000000a1'$$,
  '42501', null, 'a member cannot write age_attested_at directly'
);
select ok(public.attest_age() is not null, 'attest_age() records the attestation');
select throws_ok(
  $$insert into public.app_roles (user_id, role) values ('00000000-0000-4000-8000-0000000000a1', 'admin')$$,
  '42501', null, 'a member cannot grant themselves a role'
);
select ok(not public.has_role('admin'), 'has_role is false without a grant');
select ok(public.current_user_invited(), 'current_user_invited is true for an invited email (case-insensitive)');
select results_eq(
  $$select id, is_current from public.my_sessions()$$,
  $$values ('00000000-0000-4000-8000-00000000a5a5'::uuid, true)$$,
  'my_sessions returns only the caller''s sessions and marks the current one'
);
select is_empty(
  $$select 1 from information_schema.routines r
    join information_schema.parameters p on p.specific_name = r.specific_name
    where r.routine_schema = 'public' and r.routine_name = 'my_sessions' and p.parameter_name ilike '%ip%'$$,
  'my_sessions exposes no IP column'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000b2", "role": "authenticated"}';
select ok(not public.current_user_invited(), 'current_user_invited is false for an uninvited email');
reset role;

select * from finish();
rollback;
