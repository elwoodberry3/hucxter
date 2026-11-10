-- Discover feed events (Brief 03 Milestone 3D): deduplicated per actor per day, a separate guest
-- cap for discover_item_viewed, a shared 1,000 total per listing, and a 20,000 per-name daily cap
-- for events without a listing.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

create function pg_temp.hex(i int) returns text language sql as $$ select md5(i::text) || md5('d' || i::text) $$;
create function pg_temp.item(listing uuid, i int, viewer uuid default null) returns void language sql as $$
  select public.events_insert('discover_item_viewed', listing, pg_temp.hex(i), viewer, '{}', 1::smallint, 'pre-consent-0')
$$;
create function pg_temp.feed(i int) returns void language sql as $$
  select public.events_insert('discover_viewed', null, pg_temp.hex(i), null, '{}', 1::smallint, 'pre-consent-0')
$$;

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-8000-00000000d501', 'discover-viewer@example.test', 'authenticated', 'authenticated');

select ok(exists (select 1 from pg_class where relname = 'event_day_counts' and relrowsecurity),
  'RLS is on for event_day_counts');
select ok(not has_table_privilege('authenticated', 'public.event_day_counts', 'select')
  and not has_table_privilege('anon', 'public.event_day_counts', 'select'),
  'clients cannot read the day counters');
select ok(not has_table_privilege('service_role', 'public.event_day_counts', 'insert'),
  'the service role only reads the counters');
select ok(not has_function_privilege('authenticated', 'public.events_insert(text, uuid, text, uuid, jsonb, smallint, text)', 'execute')
  and not has_function_privilege('anon', 'public.events_insert(text, uuid, text, uuid, jsonb, smallint, text)', 'execute')
  and has_function_privilege('service_role', 'public.events_insert(text, uuid, text, uuid, jsonb, smallint, text)', 'execute'),
  'events_insert is service-role only');

-- Deduplication per actor per day.
select pg_temp.feed(1) from generate_series(1, 5);
select is((select count(*)::int from public.events where name = 'discover_viewed' and actor_hash = pg_temp.hex(1)),
  1, 'discover_viewed is recorded once per actor per day');
select is((select total from public.event_day_counts where name = 'discover_viewed'),
  1, 'a repeat discover_viewed is not counted');
select pg_temp.item('00000000-0000-4000-8000-0000000d5a01', 1) from generate_series(1, 5);
select is((select count(*)::int from public.events where name = 'discover_item_viewed' and listing_id = '00000000-0000-4000-8000-0000000d5a01'),
  1, 'discover_item_viewed is recorded once per listing per actor per day');

-- Shape checks.
select throws_ok($$ select public.events_insert('discover_item_viewed', null, pg_temp.hex(1), null, '{}', 1::smallint, 'pre-consent-0') $$,
  '22023', null, 'discover_item_viewed needs a listing');
select throws_ok($$ select public.events_insert('discover_viewed', '00000000-0000-4000-8000-0000000d5a01', pg_temp.hex(1), null, '{}', 1::smallint, 'pre-consent-0') $$,
  '22023', null, 'discover_viewed takes no listing');

-- Guest discover views have their own cap and never use the listing_viewed budget.
select pg_temp.item('00000000-0000-4000-8000-0000000d5a02', i) from generate_series(1, 201) as i;
select is((select count(*)::int from public.events where name = 'discover_item_viewed' and listing_id = '00000000-0000-4000-8000-0000000d5a02'),
  200, 'the 201st guest discover view that day is dropped');
select public.events_insert('listing_viewed', '00000000-0000-4000-8000-0000000d5a02', pg_temp.hex(500), null, '{}', 1::smallint, 'pre-consent-0');
select is((select count(*)::int from public.events where name = 'listing_viewed' and listing_id = '00000000-0000-4000-8000-0000000d5a02'),
  1, 'a guest listing_viewed still counts after the discover cap');
select pg_temp.item('00000000-0000-4000-8000-0000000d5a02', 600, '00000000-0000-4000-8000-00000000d501');
select is((select count(*)::int from public.events where name = 'discover_item_viewed' and listing_id = '00000000-0000-4000-8000-0000000d5a02'),
  201, 'a member discover view still counts past the guest cap');

-- The seller's own items are never counted.
insert into public.listings (id, seller_id, pickup_zip) values
  ('00000000-0000-4000-8000-0000000d5a03', '00000000-0000-4000-8000-00000000d501', '97205');
select pg_temp.item('00000000-0000-4000-8000-0000000d5a03', 700, '00000000-0000-4000-8000-00000000d501');
select is((select count(*)::int from public.events where listing_id = '00000000-0000-4000-8000-0000000d5a03'),
  0, 'the seller''s own discover view is dropped');

-- The 1,000 total per listing is shared with discover views.
select public.events_insert('listing_saved', '00000000-0000-4000-8000-0000000d5a04', pg_temp.hex(i), null, '{}', 1::smallint, 'pre-consent-0')
from generate_series(1, 1000) as i;
select pg_temp.item('00000000-0000-4000-8000-0000000d5a04', 2000, '00000000-0000-4000-8000-00000000d501');
select is((select count(*)::int from public.events where listing_id = '00000000-0000-4000-8000-0000000d5a04'),
  1000, 'discover views count toward the 1,000 events per listing');

-- 20,000 per name per day for events without a listing.
update public.event_day_counts set total = 19999 where name = 'discover_viewed';
select pg_temp.feed(2);
select pg_temp.feed(3);
select is((select count(*)::int from public.events where name = 'discover_viewed'),
  2, 'the 20,001st discover_viewed that day is dropped');
select pg_temp.feed(4);
select is((select total from public.event_day_counts where name = 'discover_viewed'),
  20000, 'the counter stops at the cap');

select * from finish();
rollback;
