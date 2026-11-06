-- Listing functions (Brief 03C.1 §3.1–3.6; hucxter-geo-radius required tests; Founder amendments
-- 2 and 3). Viewer ZIP 97205 (Portland). 97478 is 98.98 mi away and 97039 is 101.18 mi away,
-- measured between snapped display points (checked when this test was written).
begin;
create extension if not exists pgtap with schema extensions;
select plan(46);

-- Fixtures ----------------------------------------------------------------------------------
insert into auth.users (id, email, aud, role, email_confirmed_at, phone_confirmed_at, phone) values
  ('00000000-0000-4000-8000-00000000a201', 'seller@example.test', 'authenticated', 'authenticated', now(), now(), '15035550190'),
  ('00000000-0000-4000-8000-00000000a202', 'buyer@example.test', 'authenticated', 'authenticated', now(), now(), '15035550191'),
  ('00000000-0000-4000-8000-00000000a203', 'unverified@example.test', 'authenticated', 'authenticated', now(), null, null),
  ('00000000-0000-4000-8000-00000000a204', 'staff@example.test', 'authenticated', 'authenticated', now(), now(), '15035550192');
update public.profiles set display_name = 'Sam', home_zip = '97205', age_attested_at = now()
where id in ('00000000-0000-4000-8000-00000000a201', '00000000-0000-4000-8000-00000000a202', '00000000-0000-4000-8000-00000000a204');
insert into public.app_roles (user_id, role) values ('00000000-0000-4000-8000-00000000a204', 'moderator');

create function pg_temp.live(p_id uuid, p_zip text, p_title text, p_published timestamptz default now(), p_price int default 5000)
returns void language plpgsql as $$
begin
  insert into public.listings (id, seller_id, pickup_zip, title, category_id, condition, price_cents, description)
  values (p_id, '00000000-0000-4000-8000-00000000a201', p_zip, p_title,
          (select id from public.categories where slug = 'phones-tablets'), 'good', p_price, 'A phone');
  insert into public.listing_media (owner_id, listing_id, status, mux_asset_id, mux_playback_id)
  values ('00000000-0000-4000-8000-00000000a201', p_id, 'awaiting_upload', 'asset-' || p_id, 'play-' || p_id);
  update public.listing_media set status = 'processing' where listing_id = p_id;
  update public.listing_media set status = 'ready' where listing_id = p_id;
  update public.listings set status = 'available', published_at = p_published where id = p_id;
end;
$$;

select pg_temp.live('00000000-0000-4000-8000-0000000b0001', '97478', 'Ninety-nine miles');
select pg_temp.live('00000000-0000-4000-8000-0000000b0002', '97039', 'One hundred one miles');
select pg_temp.live('00000000-0000-4000-8000-0000000b0003', '97205', 'Same time A', '2026-11-01T12:00:00Z');
select pg_temp.live('00000000-0000-4000-8000-0000000b0004', '97205', 'Same time B', '2026-11-01T12:00:00Z');
select pg_temp.live('00000000-0000-4000-8000-0000000b0005', '97205', 'Same time C', '2026-11-01T12:00:00Z');

create function pg_temp.ids(p_radius int, p_cursor jsonb default null, p_limit int default 50)
returns uuid[] language sql as $$
  select coalesce(array_agg(id order by ord), '{}') from (
    select id, row_number() over () as ord
    from public.listings_nearby('97205', p_radius, null, null, null, '{}'::jsonb, p_cursor, p_limit)
  ) r
$$;

-- Geo suite ---------------------------------------------------------------------------------
select ok('00000000-0000-4000-8000-0000000b0001' = any (pg_temp.ids(100)), 'a listing 99 mi away is in a 100 mi search');
select ok(not ('00000000-0000-4000-8000-0000000b0002' = any (pg_temp.ids(100))), 'a listing 101 mi away is not');
select ok(not ('00000000-0000-4000-8000-0000000b0001' = any (pg_temp.ids(50))), 'the 99 mi listing is outside 50 mi');
select throws_ok($$select pg_temp.ids(2)$$, '22023', null, 'a 2 mi radius is refused (not one of the UI options)');
select throws_ok($$select pg_temp.ids(101)$$, '22023', null, 'a 101 mi radius is refused');
select throws_ok($$select pg_temp.ids(-5)$$, '22023', null, 'a negative radius is refused');
select throws_ok($$select pg_temp.ids(1000)$$, '22023', null, 'a radius above 100 mi is refused, never clamped silently');
select is(public.radius_meters(100), 160934::double precision, '100 mi is capped at 160,934 m');
select is(
  (select distance_bucket from public.listings_nearby('97205', 100, null, null, null, '{}'::jsonb, null, 50)
   where id = '00000000-0000-4000-8000-0000000b0001'),
  '50–100 mi', 'distances come back as buckets');

-- No function executable by anon/authenticated returns a point
select is_empty($$
  select p.proname from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
  where (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))
    and exists (
      select 1 from unnest(coalesce(p.proallargtypes, p.proargtypes::oid[])) t(oid)
      join pg_type ty on ty.oid = t.oid where ty.typname in ('geography', 'geometry')
    )
    and p.proname not like 'st\_%' and p.proname not like '\_st\_%'
$$, 'no API-callable public function takes or returns a geography/geometry');
select is_empty($$
  select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
  where p.prosecdef and (p.proconfig is null or not ('search_path=""' = any (p.proconfig)))
$$, 'every security-definer function pins search_path to empty');

-- Keyset pagination is stable with equal timestamps
select is(
  (select pg_temp.ids(1, null, 1) || pg_temp.ids(1, (select cursor from public.listings_nearby('97205', 1, null, null, null, '{}'::jsonb, null, 1)), 1)
     || pg_temp.ids(1, (select cursor from public.listings_nearby('97205', 1, null, null, null, '{}'::jsonb, null, 2) offset 1), 1)),
  pg_temp.ids(1, null, 3), 'pages of 1 match one page of 3 when published_at ties');
select is(cardinality(pg_temp.ids(1)), 3, 'three listings within 1 mi');

-- Search and filters
select is((select count(*)::int from public.listings_nearby('97205', 1, null, null, 'time', '{}'::jsonb, null, 50)), 3, 'full-text search matches the title');
select is((select count(*)::int from public.listings_nearby('97205', 1, null, null, 'zebra', '{}'::jsonb, null, 50)), 0, 'and nothing else');
select is((select count(*)::int from public.listings_nearby('97205', 100, 'electronics', null, null, '{"free": true}'::jsonb, null, 50)), 0, 'the Free filter keeps $0 only');

-- Visibility: drafts, needs_review, removed --------------------------------------------------
insert into public.listings (id, seller_id, pickup_zip) values ('00000000-0000-4000-8000-0000000b0006', '00000000-0000-4000-8000-00000000a201', '97205');
select pg_temp.live('00000000-0000-4000-8000-0000000b0007', '97205', 'Held for review');
update public.listings set review_state = 'needs_review' where id = '00000000-0000-4000-8000-0000000b0007';

set local role anon;
select is_empty($$select * from public.listing_public('00000000-0000-4000-8000-0000000b0006', '97205')$$, 'anon cannot see a draft');
select is_empty($$select * from public.listing_public('00000000-0000-4000-8000-0000000b0007', '97205')$$, 'anon cannot see a listing in review');
select isnt_empty($$select * from public.listing_public('00000000-0000-4000-8000-0000000b0003', '97205')$$, 'anon can see a live listing');
select ok(not ('00000000-0000-4000-8000-0000000b0007' = any (pg_temp.ids(1))), 'a listing in review is not in discovery');
select throws_ok($$select public.listing_create_draft()$$, '42501', null, 'anon cannot create listings');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-00000000a202", "role": "authenticated"}';
select is_empty($$select * from public.listing_public('00000000-0000-4000-8000-0000000b0007', '97205')$$, 'another member cannot see a listing in review');
select throws_ok($$select public.listing_set_status('00000000-0000-4000-8000-0000000b0003', 'sold')$$, 'P0002', null, 'a non-owner cannot change status');
select throws_ok($$select public.media_begin_upload('00000000-0000-4000-8000-0000000b0006')$$, 'P0002', null, 'a non-owner cannot attach media');
select throws_ok($$select * from public.listings where id = '00000000-0000-4000-8000-0000000b0003'$$, '42501', null, 'select * fails: members cannot read the point columns');
select is((select count(*)::int from public.listings), 0, 'members see none of another seller''s rows');
select is(public.report_create('listing', '00000000-0000-4000-8000-0000000b0003', 'scam', 'note'), 'created', 'a verified member can report a live listing');
select is(public.report_create('listing', '00000000-0000-4000-8000-0000000b0003', 'scam', null), 'duplicate', 'one open report per reporter and listing');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-00000000a203", "role": "authenticated"}';
select throws_ok($$select public.listing_create_draft()$$, '42501', null, 'an unverified member cannot create listings');
reset role;

-- Owner: transitions and history ------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-00000000a201", "role": "authenticated"}';
select isnt_empty($$select * from public.listing_public('00000000-0000-4000-8000-0000000b0007', '97205') where is_owner$$, 'the owner sees their listing in review');
select lives_ok($$select public.listing_set_status('00000000-0000-4000-8000-0000000b0003', 'pending')$$, 'available → pending');
select lives_ok($$select public.listing_set_status('00000000-0000-4000-8000-0000000b0003', 'available')$$, 'pending → available (they didn''t show)');
select lives_ok($$select public.listing_set_status('00000000-0000-4000-8000-0000000b0003', 'sold')$$, 'available → sold');
select throws_ok($$select public.listing_set_status('00000000-0000-4000-8000-0000000b0003', 'available')$$, '23514', null, 'sold is final');
reset role;
select results_eq(
  $$select status::text from public.listing_status_history where listing_id = '00000000-0000-4000-8000-0000000b0003' order by id$$,
  $$values ('draft'), ('available'), ('pending'), ('available'), ('sold')$$,
  'every status change is time-stamped in history');

-- Webhooks: idempotent; over-long videos rejected --------------------------------------------
insert into public.listings (id, seller_id, pickup_zip, title, category_id, condition, price_cents, publish_when_ready)
values ('00000000-0000-4000-8000-0000000b0008', '00000000-0000-4000-8000-00000000a201', '97205', 'When ready',
        (select id from public.categories where slug = 'phones-tablets'), 'good', 0, true);
insert into public.listing_media (id, owner_id, listing_id)
values ('00000000-0000-4000-8000-0000000c0008', '00000000-0000-4000-8000-00000000a201', '00000000-0000-4000-8000-0000000b0008');
select is(public.media_apply_webhook('evt-1', 'video.upload.asset_created', '00000000-0000-4000-8000-0000000c0008', 'up-8', 'asset-8', null, null, 60), 'processing', 'asset_created → processing');
select is(public.media_apply_webhook('evt-1', 'video.upload.asset_created', '00000000-0000-4000-8000-0000000c0008', 'up-8', 'asset-8', null, null, 60), 'duplicate', 'a replayed event is ignored');
select is(public.media_apply_webhook('evt-2', 'video.asset.ready', null, null, 'asset-8', 'play-8', 12.5, 60), 'ready', 'asset ready → ready');
select is((select status::text from public.listings where id = '00000000-0000-4000-8000-0000000b0008'), 'available', '"Publish when ready" goes live on the ready webhook');

-- Admin removal revokes playback; account deletion enqueues Mux clean-up first --------------
select lives_ok($$select public.admin_listing_remove('00000000-0000-4000-8000-00000000a204', '00000000-0000-4000-8000-0000000b0004', 'test')$$, 'staff can remove a listing');
select is(public.media_playback((select id from public.listing_media where listing_id = '00000000-0000-4000-8000-0000000b0004')), null, 'no playback for removed media');
select throws_ok($$select public.admin_listing_remove('00000000-0000-4000-8000-00000000a202', '00000000-0000-4000-8000-0000000b0005', 'x')$$, '42501', null, 'non-staff cannot remove');

select public.events_insert('listing_viewed', '00000000-0000-4000-8000-0000000b0003', repeat('b', 64), null, '{}', 1::smallint, 'pre-consent-0');
select ok(public.account_delete_prepare('00000000-0000-4000-8000-00000000a201') > 0, 'account deletion enqueues jobs');
delete from auth.users where id = '00000000-0000-4000-8000-00000000a201';
select ok(
  (select count(*) from public.jobs where kind = 'mux_delete_asset' and payload ->> 'asset_id' = 'asset-8') = 1,
  'delete-asset jobs hold the Mux asset id and survive the cascade');
select ok(
  (select count(*) from public.reports where target_id = '00000000-0000-4000-8000-0000000b0003') = 1
  and (select count(*) from public.listings where seller_id = '00000000-0000-4000-8000-00000000a201') = 0,
  'listings cascade away; reports about them remain');
select is(
  (select count(*)::int from public.events where listing_id = '00000000-0000-4000-8000-0000000b0003'),
  1, 'events about deleted listings remain (no FK)');

select * from finish();
rollback;
