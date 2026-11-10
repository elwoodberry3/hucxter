-- The prohibited-item check runs in SQL (Brief 03C.1b H1): direct RPC calls can't skip it, the
-- folding catches look-alikes, publish compares the exact version the seller reviewed, and the
-- "Publish when ready" webhook re-checks the text.
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

insert into auth.users (id, email, aud, role, email_confirmed_at, phone_confirmed_at, phone) values
  ('00000000-0000-4000-8000-00000000f301', 'seller-tc@example.test', 'authenticated', 'authenticated', now(), now(), '15035550301');
update public.profiles set display_name = 'Tess', home_zip = '97205', age_attested_at = now()
where id = '00000000-0000-4000-8000-00000000f301';

alter table public.listings disable trigger listings_set_updated_at;
insert into public.listings (id, seller_id, pickup_zip, title, description, category_id, condition, price_cents, updated_at)
select v.id::uuid, '00000000-0000-4000-8000-00000000f301', '97205', v.title, v.description,
  (select id from public.categories where slug = 'lighting'), 'good', 1000,
  '2026-11-01 10:00:00.123456+00'
from (values
  ('00000000-0000-4000-8000-0000000f0001', 'Hunting rifle', ''),
  ('00000000-0000-4000-8000-0000000f0002', 'Gunmetal sofa', 'Shotglass not included'),
  ('00000000-0000-4000-8000-0000000f0003', 'Lamp', 'Comes with a r' || chr(1110) || 'fle'),
  ('00000000-0000-4000-8000-0000000f0004', 'Lamp', 'A R' || chr(205) || 'FLE stand'),
  ('00000000-0000-4000-8000-0000000f0005', 'Lamp', 'Clean'),
  ('00000000-0000-4000-8000-0000000f0006', 'Scheduled lamp', 'Clean'),
  ('00000000-0000-4000-8000-0000000f0007', 'Lamp', 'Clean')
) as v(id, title, description);
alter table public.listings enable trigger listings_set_updated_at;

insert into public.listing_media (owner_id, listing_id, status)
select '00000000-0000-4000-8000-00000000f301', id, 'awaiting_upload' from public.listings
where seller_id = '00000000-0000-4000-8000-00000000f301';
update public.listing_media set status = 'processing' where owner_id = '00000000-0000-4000-8000-00000000f301';
update public.listing_media set status = 'ready'
where owner_id = '00000000-0000-4000-8000-00000000f301' and listing_id <> '00000000-0000-4000-8000-0000000f0006';
update public.listing_media set mux_upload_id = 'up-f6', mux_asset_id = 'asset-f6'
where listing_id = '00000000-0000-4000-8000-0000000f0006';

select hasnt_function('public', 'listing_publish', array['uuid', 'boolean', 'boolean'],
  'the caller-supplied review flag is gone from listing_publish');
select ok(not has_function_privilege('anon', 'public.listing_publish(uuid, boolean, text)', 'execute'),
  'anon cannot publish');
select ok(has_function_privilege('authenticated', 'public.listing_publish(uuid, boolean, text)', 'execute'),
  'members can publish');
select ok(not has_function_privilege('authenticated', 'public.listing_text_flagged(text, text)', 'execute'),
  'members cannot call the check directly');
select ok(not has_function_privilege('anon', 'public.listing_text_flagged(text, text)', 'execute'),
  'anon cannot call the check');
select ok(not has_function_privilege('authenticated', 'public.lock_own_listing(uuid)', 'execute')
  and not has_function_privilege('service_role', 'public.lock_own_listing(uuid)', 'execute'),
  'no role can call lock_own_listing directly');
select ok(not has_table_privilege('authenticated', 'public.prohibited_keywords', 'select'),
  'members cannot read the keyword list');
select ok(exists (select 1 from pg_class where relname = 'prohibited_keywords' and relrowsecurity),
  'RLS is on for prohibited_keywords');
select is((select count(*)::int from public.prohibited_keywords), 78, 'the v1 keyword list is loaded');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-00000000f301", "role": "authenticated"}';

select is(public.listing_publish('00000000-0000-4000-8000-0000000f0001', false, '2026-11-01 10:00:00.123456+00'),
  'in_review', 'a direct RPC publish with a prohibited word is held for review');
select is(public.listing_publish('00000000-0000-4000-8000-0000000f0002', false, '2026-11-01 10:00:00.123456+00'),
  'published', 'words inside other words do not match');
select is(public.listing_publish('00000000-0000-4000-8000-0000000f0003', false, '2026-11-01 10:00:00.123456+00'),
  'in_review', 'a Cyrillic look-alike is folded and held');
select is(public.listing_publish('00000000-0000-4000-8000-0000000f0004', false, '2026-11-01T10:00:00.123456Z'),
  'in_review', 'accents and capitals are folded and held (ISO version text)');

-- The version must match exactly: microseconds included.
select is(public.listing_publish('00000000-0000-4000-8000-0000000f0005', false, '2026-11-01T10:00:00.123Z'),
  'changed', 'a version rounded to milliseconds is not the reviewed version');
select is((select status::text from public.listings where id = '00000000-0000-4000-8000-0000000f0005'),
  'draft', 'a changed publish leaves the draft alone');

-- Race: an edit lands between the seller's review and their publish.
select is(public.listing_update_details('00000000-0000-4000-8000-0000000f0005', 'Lamp', 'lighting', 'good', 1000, '{}', 'Free vape with it', '97205'),
  'ok', 'a draft edit is checked at publish, not on save');
select is(public.listing_publish('00000000-0000-4000-8000-0000000f0005', false, '2026-11-01 10:00:00.123456+00'),
  'changed', 'publishing the version from before the edit returns changed');
select is(public.listing_publish('00000000-0000-4000-8000-0000000f0005', false,
    (select updated_at::text from public.listings where id = '00000000-0000-4000-8000-0000000f0005')),
  'in_review', 'publishing the current version checks the edited text');
select is(public.listing_publish('00000000-0000-4000-8000-0000000f0007', false, '2026-11-01 10:00:00.123456+00'),
  'published', 'a clean listing with the exact microsecond version publishes');

select throws_ok(
  $$select public.listing_update_details('00000000-0000-4000-8000-0000000f0007', 'Lamp', 'lighting', 'good', 1000,
    jsonb_build_object('notes', repeat('x', 5000)), 'Clean', '97205')$$,
  '23514', null, 'attributes over 4 KB are refused');

-- "Publish when ready": the text changes after scheduling (a raw update, as a race would).
select is(public.listing_publish('00000000-0000-4000-8000-0000000f0006', true, '2026-11-01 10:00:00.123456+00'),
  'scheduled', 'a clean draft is scheduled');
reset role;
update public.listings set description = 'Includes a glock' where id = '00000000-0000-4000-8000-0000000f0006';
set local role service_role;
select public.media_apply_webhook('evt-f6-ready', 'video.asset.ready',
  (select id from public.listing_media where listing_id = '00000000-0000-4000-8000-0000000f0006'),
  'up-f6', 'asset-f6', 'pb-f6', 12, 60) as ready \gset
reset role;
select is((select status::text || '/' || review_state::text from public.listings where id = '00000000-0000-4000-8000-0000000f0006'),
  'available/needs_review', 'the ready webhook re-checks the text and holds it for review');

select * from finish();
rollback;
