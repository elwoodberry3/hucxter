-- 3C.2 trust-safety hardening: blocked terms behind look-alike letters, fullwidth forms or
-- invisible characters; hidden/bidi characters; profiles public only after onboarding; a name
-- reset can't end with an empty name; a member with a handle always has a name.
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

insert into auth.users (id, email, aud, role, email_confirmed_at, phone_confirmed_at, phone, created_at) values
  ('00000000-0000-4000-8000-0000000c3e01', 'hard1@example.test', 'authenticated', 'authenticated', now(), now(), '15035550181', now()),
  ('00000000-0000-4000-8000-0000000c3e02', 'hard2@example.test', 'authenticated', 'authenticated', now(), null, null, now()),
  ('00000000-0000-4000-8000-0000000c3e03', 'hard3@example.test', 'authenticated', 'authenticated', now(), now(), '15035550183', now());
update public.profiles set display_name = 'Tamsin', home_zip = '97205', age_attested_at = now()
where id in ('00000000-0000-4000-8000-0000000c3e01', '00000000-0000-4000-8000-0000000c3e03');
-- Signed up, set a name out of order, never verified a phone or attested 18+.
update public.profiles set display_name = 'Early Bird' where id = '00000000-0000-4000-8000-0000000c3e02';
update public.profiles set handle = 'tamsin.h1' where id = '00000000-0000-4000-8000-0000000c3e01';
update public.profiles set handle = 'early.bird' where id = '00000000-0000-4000-8000-0000000c3e02';

select is(public.text_fold('ＨＵＣＸＴＥＲ'), 'hucxter', 'fullwidth letters fold to ASCII');
select is(public.text_fold('Hucxtеr Ѕupport'), 'hucxter support', 'Cyrillic look-alikes fold to Latin');
select is(public.text_fold(E'Sup‍port'), 'support', 'zero-width characters are dropped');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000c3e01", "role": "authenticated"}';
select throws_ok($$update public.profiles set display_name = 'Hucxtеr Ѕupport' where id = auth.uid()$$,
  '23514', null, 'a look-alike staff name is refused');
select throws_ok($$update public.profiles set display_name = 'ＡＤＭＩＮ' where id = auth.uid()$$,
  '23514', null, 'a fullwidth blocked term is refused');
select throws_ok($$update public.profiles set display_name = E'Ad​min' where id = auth.uid()$$,
  '23514', null, 'a blocked term split by a zero-width space is refused');
select throws_ok($$update public.profiles set display_name = E'‮retxcuh' where id = auth.uid()$$,
  '23514', null, 'a right-to-left override is refused');
select throws_ok($$update public.profiles set display_name = 'Нucxter member' where id = auth.uid()$$,
  '23514', null, 'a look-alike placeholder is refused');
select throws_ok($$update public.profiles set bio = E'Off­icial seller' where id = auth.uid()$$,
  '23514', null, 'a soft hyphen hiding a blocked term in a bio is refused');
select throws_ok($$update public.profiles set bio = 'Ѕupport team' where id = auth.uid()$$,
  '23514', null, 'a look-alike blocked term in a bio is refused');
select lives_ok($$update public.profiles set display_name = 'Zoë Ελένη', bio = 'Каша и чай.' where id = auth.uid()$$,
  'real names and bios in other scripts are fine');
select throws_ok($$update public.profiles set display_name = null where id = auth.uid()$$,
  '23514', null, 'a member with a handle keeps a display name');
reset role;

-- Public only after onboarding
select is((select count(*)::int from public.profile_by_handle('tamsin.h1')), 1, 'an onboarded member is public');
select is_empty($$select * from public.profile_by_handle('early.bird')$$,
  'a member who hasn''t finished onboarding has no public profile');
select is_empty($$select * from public.profile_listings('early.bird')$$,
  'nor a public listings grid');
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000c3e03", "role": "authenticated"}';
select is(public.report_profile('early.bird', 'scam', null), 'not_found',
  'and can''t be reported by handle');
reset role;

-- A staff-required reset can't end with an empty name
update public.profiles set display_name = 'Hucxter member', name_reset_required_at = now()
where id = '00000000-0000-4000-8000-0000000c3e03';
select ok((select count(*) = 1 from public.profile_by_handle((select handle from public.profiles where id = '00000000-0000-4000-8000-0000000c3e03'))),
  'a member in a name reset stays visible for moderation');
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000c3e03", "role": "authenticated"}';
select throws_ok($$select public.profile_complete_reset(null, 'tamsin.h3')$$, '23514', null,
  'the reset needs a name');
select throws_ok($$select public.profile_complete_reset('   ', 'tamsin.h3')$$, '23514', null,
  'a blank name doesn''t count');
reset role;

select * from finish();
rollback;
