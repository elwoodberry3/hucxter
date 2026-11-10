-- Edits re-run the prohibited-item check (hold_edited_listings_for_review; since 3C.1b H1 the check
-- runs in SQL): a flagged edit moves a live listing into review; a clean edit never clears review;
-- drafts are unaffected.
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

insert into auth.users (id, email, aud, role, email_confirmed_at, phone_confirmed_at, phone) values
  ('00000000-0000-4000-8000-00000000e201', 'editor@example.test', 'authenticated', 'authenticated', now(), now(), '15035550193');
update public.profiles set display_name = 'Edi', home_zip = '97205', age_attested_at = now()
where id = '00000000-0000-4000-8000-00000000e201';

insert into public.listings (id, seller_id, pickup_zip, title, category_id, condition, price_cents)
values
  ('00000000-0000-4000-8000-0000000e0001', '00000000-0000-4000-8000-00000000e201', '97205', 'Lamp',
   (select id from public.categories where slug = 'lighting'), 'good', 1000),
  ('00000000-0000-4000-8000-0000000e0002', '00000000-0000-4000-8000-00000000e201', '97205', 'Draft lamp',
   (select id from public.categories where slug = 'lighting'), 'good', 1000),
  ('00000000-0000-4000-8000-0000000e0003', '00000000-0000-4000-8000-00000000e201', '97205', 'Scheduled lamp',
   (select id from public.categories where slug = 'lighting'), 'good', 1000);
update public.listings set publish_when_ready = true where id = '00000000-0000-4000-8000-0000000e0003';
insert into public.listing_media (owner_id, listing_id, status)
values ('00000000-0000-4000-8000-00000000e201', '00000000-0000-4000-8000-0000000e0001', 'awaiting_upload');
update public.listing_media set status = 'processing' where listing_id = '00000000-0000-4000-8000-0000000e0001';
update public.listing_media set status = 'ready' where listing_id = '00000000-0000-4000-8000-0000000e0001';
update public.listings set status = 'available', published_at = now() where id = '00000000-0000-4000-8000-0000000e0001';

select ok(
  not has_function_privilege('anon', 'public.listing_update_details(uuid, text, text, text, integer, jsonb, text, text)', 'execute'),
  'anon cannot edit listings');
select hasnt_function('public', 'listing_update_details',
  array['uuid', 'text', 'text', 'text', 'integer', 'jsonb', 'text', 'text', 'boolean'],
  'the caller-supplied review flag is gone');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-00000000e201", "role": "authenticated"}';

select is(public.listing_update_details('00000000-0000-4000-8000-0000000e0001', 'Lamp', 'lighting', 'good', 1000, '{}', 'Clean', '97205'), 'ok', 'the edit returns its review state');
select is((select review_state::text from public.listings where id = '00000000-0000-4000-8000-0000000e0001'), 'ok', 'a clean edit stays live');

select is(public.listing_update_details('00000000-0000-4000-8000-0000000e0001', 'Lamp', 'lighting', 'good', 1000, '{}', 'Comes with a rifle', '97205'), 'needs_review', 'the edit returns its review state');
select is((select review_state::text from public.listings where id = '00000000-0000-4000-8000-0000000e0001'), 'needs_review', 'a flagged edit goes to review');

select is(public.listing_update_details('00000000-0000-4000-8000-0000000e0001', 'Lamp', 'lighting', 'good', 1000, '{}', 'Clean again', '97205'), 'needs_review', 'the edit returns its review state');
select is((select review_state::text from public.listings where id = '00000000-0000-4000-8000-0000000e0001'), 'needs_review', 'a clean edit never clears review');

select is(public.listing_update_details('00000000-0000-4000-8000-0000000e0002', 'Draft lamp', 'lighting', 'good', 1000, '{}', 'Comes with a rifle', '97205'), 'ok', 'the edit returns its review state');
select is((select review_state::text from public.listings where id = '00000000-0000-4000-8000-0000000e0002'), 'ok', 'drafts are checked at publish, not on edit');

-- Trust-safety H1: the ready webhook publishes a scheduled draft without another check.
select is(public.listing_update_details('00000000-0000-4000-8000-0000000e0003', 'Scheduled lamp', 'lighting', 'good', 1000, '{}', 'Clean', '97205'), 'ok', 'the edit returns its review state');
select is((select review_state::text from public.listings where id = '00000000-0000-4000-8000-0000000e0003'), 'ok', 'a clean edit leaves a scheduled draft ok');
select is(public.listing_update_details('00000000-0000-4000-8000-0000000e0003', 'Scheduled lamp', 'lighting', 'good', 1000, '{}', 'Comes with a rifle', '97205'), 'needs_review', 'the edit returns its review state');
select is((select review_state::text from public.listings where id = '00000000-0000-4000-8000-0000000e0003'), 'needs_review', 'a flagged edit holds a scheduled draft for review');

reset role;
select is(
  (select count(*)::int from public.listings_nearby('97205', 25, null, null, 'lamp')),
  0, 'the flagged listing is gone from discovery');

select * from finish();
rollback;
