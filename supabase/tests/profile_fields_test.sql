-- Profile fields (Brief 03C.2 §4.4–4.5; Founder amendment 2): display name 2–25 with no blocked
-- terms, the "Hucxter member" placeholder only during a staff-required reset, bio rules, avatar
-- path shape, and which columns members may write.
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-8000-0000000c2b01', 'pf@example.test', 'authenticated', 'authenticated');

select ok(
  (select convalidated from pg_constraint where conname = 'profiles_display_name_rules'),
  'the display name rules are validated (no existing row breaks them locally)');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000c2b01", "role": "authenticated"}';

-- Display name
select lives_ok($$update public.profiles set display_name = repeat('x', 25) where id = auth.uid()$$,
  '25 characters is allowed');
select throws_ok($$update public.profiles set display_name = repeat('x', 26) where id = auth.uid()$$,
  '23514', null, '26 characters is rejected');
select throws_ok($$update public.profiles set display_name = 'Hucxter member' where id = auth.uid()$$,
  '23514', null, 'a member cannot set the system placeholder');
select throws_ok($$update public.profiles set display_name = 'Site Admin' where id = auth.uid()$$,
  '23514', null, '"admin" is blocked in display names');
select throws_ok($$update public.profiles set display_name = 'Tech SUPPORT' where id = auth.uid()$$,
  '23514', null, '"support" is blocked in any case');
select throws_ok($$update public.profiles set display_name = 'Official Bob' where id = auth.uid()$$,
  '23514', null, '"official" is blocked');
select throws_ok($$update public.profiles set name_reset_required_at = now() where id = auth.uid()$$,
  '42501', null, 'members cannot set the reset flag');

-- Bio
select lives_ok($$update public.profiles set bio = 'Weekend woodworker.' where id = auth.uid()$$,
  'members can write their bio');
select lives_ok($$update public.profiles set bio = E'One\nTwo\nThree\nFour' where id = auth.uid()$$,
  'three line breaks are allowed');
select lives_ok($$update public.profiles set bio = 'Selling since 2015 in 2024' where id = auth.uid()$$,
  'years are not phone numbers');
select throws_ok($$update public.profiles set bio = E'a\nb\nc\nd\ne' where id = auth.uid()$$,
  '23514', null, 'four line breaks are rejected');
select throws_ok($$update public.profiles set bio = repeat('x', 151) where id = auth.uid()$$,
  '23514', null, '151 characters is rejected');
select throws_ok($$update public.profiles set bio = 'Call 503-555-0100' where id = auth.uid()$$,
  '23514', null, 'phone numbers are rejected');
select throws_ok($$update public.profiles set bio = 'see example.com' where id = auth.uid()$$,
  '23514', null, 'links are rejected');
select throws_ok($$update public.profiles set bio = 'me@example.test' where id = auth.uid()$$,
  '23514', null, 'emails are rejected');
select throws_ok($$update public.profiles set bio = 'Official Hucxter seller' where id = auth.uid()$$,
  '23514', null, 'blocked terms are rejected in bios');
select throws_ok($$update public.profiles set bio = E'bell\u0007' where id = auth.uid()$$,
  '23514', null, 'control characters are rejected');

-- Avatar path: service role only, "<uuid>.webp" only
select throws_ok(
  $$update public.profiles set avatar_path = '00000000-0000-4000-8000-000000000001.webp' where id = auth.uid()$$,
  '42501', null, 'members cannot write the avatar path');
reset role;

select lives_ok(
  $$update public.profiles set avatar_path = '0f8fad5b-d9cb-469f-a165-70867728950e.webp'
    where id = '00000000-0000-4000-8000-0000000c2b01'$$,
  'a uuid.webp path is accepted');
select throws_ok(
  $$update public.profiles set avatar_path = '../other.webp' where id = '00000000-0000-4000-8000-0000000c2b01'$$,
  '23514', null, 'any other path is rejected');
select throws_ok(
  $$update public.profiles set avatar_path = '0f8fad5b-d9cb-469f-a165-70867728950e.jpg'
    where id = '00000000-0000-4000-8000-0000000c2b01'$$,
  '23514', null, 'only .webp is accepted');

-- The placeholder is allowed only with the reset flag (set by staff moderation)
select lives_ok(
  $$update public.profiles set display_name = 'Hucxter member', name_reset_required_at = now()
    where id = '00000000-0000-4000-8000-0000000c2b01'$$,
  'the placeholder is allowed during a required reset');
select throws_ok(
  $$update public.profiles set name_reset_required_at = null where id = '00000000-0000-4000-8000-0000000c2b01'$$,
  '23514', null, 'the reset cannot end while the placeholder name remains');

select * from finish();
rollback;
