-- Handles (Brief 03C.2 §4.1): rules, reserved words and blocked terms, generation from display
-- names (accents, collisions, holds), and that members can't write handles directly.
begin;
create extension if not exists pgtap with schema extensions;
select plan(31);

-- Rules
select ok(public.handle_is_valid('alex'), 'a plain handle is valid');
select ok(public.handle_is_valid('a_b.c9'), 'letters, digits, dots and underscores are valid');
select ok(public.handle_is_valid(repeat('a', 24)), '24 characters is valid');
select ok(not public.handle_is_valid(repeat('a', 25)), '25 characters is too long');
select ok(not public.handle_is_valid('al'), '2 characters is too short');
select ok(not public.handle_is_valid('Alex'), 'capitals are rejected (handles are stored lowercase)');
select ok(not public.handle_is_valid('al-ex'), 'hyphens are rejected');
select ok(not public.handle_is_valid('.alex'), 'a leading dot is rejected');
select ok(not public.handle_is_valid('alex.'), 'a trailing dot is rejected');
select ok(not public.handle_is_valid('al..ex'), 'two dots in a row are rejected');
select ok(not public.handle_is_valid('503.555.0100'), 'a handle needs a letter (no phone-number handles)');
select ok(not public.handle_is_valid('settings'), 'reserved route words are rejected');
select ok(not public.handle_is_valid('u'), 'single-letter route prefixes are reserved (and short)');
select ok(not public.handle_is_valid('the_official_bob'), 'blocked terms are rejected anywhere');
select ok(not public.handle_is_valid('hucxterfan'), '"hucxter" is blocked anywhere');
select ok(not public.handle_is_valid('admin2'), '"admin" is blocked anywhere');

-- Generation
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-8000-0000000c2a01', 'h1@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000c2a02', 'h2@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000c2a03', 'h3@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000c2a04', 'h4@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000c2a05', 'h5@example.test', 'authenticated', 'authenticated');

select is((select handle from public.profiles where id = '00000000-0000-4000-8000-0000000c2a01'), null,
  'no display name, no handle');

update public.profiles set display_name = 'Quill Zed' where id = '00000000-0000-4000-8000-0000000c2a01';
update public.profiles set display_name = 'Quill Zed' where id = '00000000-0000-4000-8000-0000000c2a02';
update public.profiles set display_name = 'Quill Zed' where id = '00000000-0000-4000-8000-0000000c2a03';
select is((select handle from public.profiles where id = '00000000-0000-4000-8000-0000000c2a01'), 'quillzed',
  'the first member gets the name itself');
select matches((select handle from public.profiles where id = '00000000-0000-4000-8000-0000000c2a02'), '^quillzed[0-9]{2}$',
  'a collision adds digits');
select is(
  (select count(distinct handle)::int from public.profiles where display_name = 'Quill Zed'), 3,
  'three members with the same name get three distinct handles');

update public.profiles set display_name = 'Zoë Ångström' where id = '00000000-0000-4000-8000-0000000c2a04';
select is((select handle from public.profiles where id = '00000000-0000-4000-8000-0000000c2a04'), 'zoeangstrom',
  'accents are folded');

insert into public.handle_holds (handle, user_id, held_until, reason)
values ('heldname', null, now() + interval '30 days', 'moderation');
update public.profiles set display_name = 'Held Name' where id = '00000000-0000-4000-8000-0000000c2a05';
select isnt((select handle from public.profiles where id = '00000000-0000-4000-8000-0000000c2a05'), 'heldname',
  'a held handle is never generated');
select matches(public.handle_generate('李明'), '^member', 'a name with no Latin letters falls back to "member"');
select matches(public.handle_generate('Support Desk'), '^member', 'a name with a blocked term falls back to "member"');
select matches(public.handle_generate('12345'), '^member', 'a digits-only name falls back to "member"');
select ok(length(public.handle_generate(repeat('abcdefghij', 5))) <= 24, 'long names are cut to fit');
select is_empty(
  $$select id from public.profiles where display_name is not null and handle is null$$,
  'every profile with a display name has a handle');

-- Privileges
select ok(not has_function_privilege('anon', 'public.handle_generate(text)', 'execute'),
  'anon cannot generate handles');
select ok(not has_function_privilege('authenticated', 'public.handle_generate(text)', 'execute'),
  'members cannot call the generator directly');
select ok(not has_table_privilege('authenticated', 'public.handle_holds', 'select'),
  'members cannot read handle holds');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000c2a01", "role": "authenticated"}';
select throws_ok(
  $$update public.profiles set handle = 'stolen' where id = '00000000-0000-4000-8000-0000000c2a01'$$,
  '42501', null, 'members cannot write their handle directly');
reset role;

select * from finish();
rollback;
