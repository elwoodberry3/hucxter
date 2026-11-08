-- Narrower blocked terms (Brief 03C.1b H8): bios refuse only the brand; display names refuse the
-- brand anywhere and admin / support / official only as whole words; handles keep the substring
-- rule. Look-alikes, accents and fullwidth forms still count (text_fold).
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

insert into auth.users (id, email, aud, role, email_confirmed_at, phone_confirmed_at, phone, created_at) values
  ('00000000-0000-4000-8000-0000000c8b01', 'terms1@example.test', 'authenticated', 'authenticated', now(), now(), '15035550191', now());

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000c8b01", "role": "authenticated"}';

-- Allowed now
select lives_ok($$update public.profiles set bio = 'Happy to support local sellers' where id = auth.uid()$$,
  '"support" in a bio is fine');
select lives_ok($$update public.profiles set bio = 'Official pickup spot: the library. Ask admin staff.' where id = auth.uid()$$,
  '"official" and "admin" in a bio are fine');
select lives_ok($$update public.profiles set display_name = 'Badminton Bob' where id = auth.uid()$$,
  '"admin" inside a word is fine in a name');
select lives_ok($$update public.profiles set display_name = 'Supportive Sam' where id = auth.uid()$$,
  '"support" inside a word is fine in a name');
select lives_ok($$update public.profiles set display_name = 'Officially Jo' where id = auth.uid()$$,
  '"official" inside a word is fine in a name');

-- Still refused: names
select throws_ok($$update public.profiles set display_name = 'Hucxter Support' where id = auth.uid()$$,
  '23514', null, 'the brand and a staff word');
select throws_ok($$update public.profiles set display_name = 'Bob Admin' where id = auth.uid()$$,
  '23514', null, 'a staff word as a whole word');
select throws_ok($$update public.profiles set display_name = 'ＡＤＭＩＮ Bob' where id = auth.uid()$$,
  '23514', null, 'a fullwidth staff word');
select throws_ok($$update public.profiles set display_name = 'Supрort team' where id = auth.uid()$$,
  '23514', null, 'a staff word with a Cyrillic look-alike');
select throws_ok($$update public.profiles set display_name = 'Bob_Admin' where id = auth.uid()$$,
  '23514', null, 'an underscore is not a letter, so it still bounds the word');
select throws_ok($$update public.profiles set display_name = 'Support24' where id = auth.uid()$$,
  '23514', null, 'nor is a digit');
select throws_ok($$update public.profiles set display_name = 'Ηucxter' where id = auth.uid()$$,
  '23514', null, 'the brand with a Greek capital eta');
select throws_ok($$update public.profiles set display_name = 'Hücxterfan' where id = auth.uid()$$,
  '23514', null, 'the brand inside a word, with an accent');

-- Still refused: bios
select throws_ok($$update public.profiles set bio = 'Selling for Hucxtеr' where id = auth.uid()$$,
  '23514', null, 'the brand in a bio, with a Cyrillic look-alike');
select throws_ok($$update public.profiles set bio = 'Ask ＨＵＣＸＴＥＲ' where id = auth.uid()$$,
  '23514', null, 'the fullwidth brand in a bio');
select throws_ok($$update public.profiles set bio = 'Sup' || chr(8203) || 'port' where id = auth.uid()$$,
  '23514', null, 'hidden characters in a bio are still refused');
reset role;

-- Handles keep the substring rule
select ok(not public.handle_is_valid('badmintonbob'), 'handles still refuse "admin" anywhere');
select ok(not public.handle_is_valid('supportive.sam'), 'and "support" anywhere');

-- Every constraint is in place and validated on a clean database
select is(
  (select count(*)::int from pg_constraint
   where conrelid = 'public.profiles'::regclass and convalidated
     and conname in ('profiles_bio_check', 'profiles_display_name_rules',
                     'profiles_display_name_folded', 'profiles_bio_folded')),
  4, 'the four relaxed CHECKs are validated');
select is(
  (select count(*)::int from pg_constraint
   where conrelid = 'public.profiles'::regclass
     and pg_get_constraintdef(oid) ~ 'hucxter\|admin'),
  0, 'no profiles CHECK keeps the old substring rule');

select * from finish();
rollback;
