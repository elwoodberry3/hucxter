-- Daily caps on listing events (Brief 03C.1b H3): 200 guest views and 1,000 events per listing per
-- UTC day; duplicates don't count; members still count once each.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

create function pg_temp.hex(i int) returns text language sql as $$ select md5(i::text) || md5('x' || i::text) $$;
create function pg_temp.view_(listing uuid, i int, viewer uuid default null) returns void language sql as $$
  select public.events_insert('listing_viewed', listing, pg_temp.hex(i), viewer, '{}', 1::smallint, 'pre-consent-0')
$$;

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-8000-00000000e501', 'viewer-cap@example.test', 'authenticated', 'authenticated');

select ok(exists (select 1 from pg_class where relname = 'listing_event_counts' and relrowsecurity),
  'RLS is on for listing_event_counts');
select ok(not has_table_privilege('authenticated', 'public.listing_event_counts', 'select'),
  'members cannot read the counters');

-- 200 distinct guests, then the 201st is dropped.
select pg_temp.view_('00000000-0000-4000-8000-0000000e5a01', i) from generate_series(1, 200) as i;
select is((select count(*)::int from public.events where listing_id = '00000000-0000-4000-8000-0000000e5a01'),
  200, '200 guest views count');
select pg_temp.view_('00000000-0000-4000-8000-0000000e5a01', 201);
select is((select count(*)::int from public.events where listing_id = '00000000-0000-4000-8000-0000000e5a01'),
  200, 'the 201st guest view that day is dropped');
select pg_temp.view_('00000000-0000-4000-8000-0000000e5a01', 202, '00000000-0000-4000-8000-00000000e501');
select is((select count(*)::int from public.events where listing_id = '00000000-0000-4000-8000-0000000e5a01'),
  201, 'a member view still counts past the guest cap');

-- Duplicates don't use up the cap.
select pg_temp.view_('00000000-0000-4000-8000-0000000e5a02', 1) from generate_series(1, 50);
select is((select guest_views from public.listing_event_counts where listing_id = '00000000-0000-4000-8000-0000000e5a02'),
  1, 'a repeat view the same day is deduplicated and counted once');

-- 1,000 events of any name per listing per day.
select public.events_insert('listing_saved', '00000000-0000-4000-8000-0000000e5a03', pg_temp.hex(i), null, '{}', 1::smallint, 'pre-consent-0')
from generate_series(1, 1000) as i;
select is((select count(*)::int from public.events where listing_id = '00000000-0000-4000-8000-0000000e5a03'),
  1000, '1,000 events count');
select public.events_insert('listing_saved', '00000000-0000-4000-8000-0000000e5a03', pg_temp.hex(1001), null, '{}', 1::smallint, 'pre-consent-0');
select pg_temp.view_('00000000-0000-4000-8000-0000000e5a03', 1002, '00000000-0000-4000-8000-00000000e501');
select is((select count(*)::int from public.events where listing_id = '00000000-0000-4000-8000-0000000e5a03'),
  1000, 'the 1,001st event that day is dropped, member views included');

-- Events without a listing aren't capped here.
select public.events_insert('sell_started', null, pg_temp.hex(1), null, '{}', 1::smallint, 'pre-consent-0');
select is((select count(*)::int from public.events where name = 'sell_started' and actor_hash = pg_temp.hex(1)),
  1, 'events without a listing are unaffected');

select * from finish();
rollback;
