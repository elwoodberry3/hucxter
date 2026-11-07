-- Listing media, jobs, reports, events and action limits (Brief 03C.1 §3.2, §3.6).
begin;
create extension if not exists pgtap with schema extensions;
select plan(23);

insert into auth.users (id, email, aud, role, created_at) values
  ('00000000-0000-4000-8000-00000000c101', 'seller@example.test', 'authenticated', 'authenticated', now() - interval '30 days'),
  ('00000000-0000-4000-8000-00000000c102', 'new@example.test', 'authenticated', 'authenticated', now());
insert into public.listings (id, seller_id, pickup_zip, price_cents)
values ('00000000-0000-4000-8000-00000000d101', '00000000-0000-4000-8000-00000000c101', '97205', 5000);
insert into public.listing_media (id, owner_id, listing_id)
values ('00000000-0000-4000-8000-00000000e101', '00000000-0000-4000-8000-00000000c101', '00000000-0000-4000-8000-00000000d101');

-- Media: grants and state machine
select ok(not has_column_privilege('authenticated', 'public.listing_media', 'mux_playback_id', 'select'), 'members cannot read playback ids');
select ok(not has_column_privilege('authenticated', 'public.listing_media', 'mux_asset_id', 'select'), 'members cannot read asset ids');
select ok(not has_table_privilege('anon', 'public.listing_media', 'select'), 'anon cannot read media');
select ok(not has_table_privilege('authenticated', 'public.mux_webhook_events', 'select'), 'members cannot read webhook events');
select throws_ok(
  $$update public.listing_media set status = 'ready' where id = '00000000-0000-4000-8000-00000000e101'$$,
  '23514', null, 'awaiting_upload cannot jump to ready');
select lives_ok(
  $$update public.listing_media set status = 'processing' where id = '00000000-0000-4000-8000-00000000e101'$$,
  'awaiting_upload → processing');
select lives_ok(
  $$update public.listing_media set status = 'ready' where id = '00000000-0000-4000-8000-00000000e101'$$,
  'processing → ready');
select throws_ok(
  $$update public.listing_media set status = 'processing' where id = '00000000-0000-4000-8000-00000000e101'$$,
  '23514', null, 'ready cannot go back to processing');
select lives_ok(
  $$update public.listing_media set status = 'removed' where id = '00000000-0000-4000-8000-00000000e101'$$,
  'ready → removed');
select throws_ok(
  $$update public.listing_media set status = 'ready' where id = '00000000-0000-4000-8000-00000000e101'$$,
  '23514', null, 'removed is final');

-- Jobs: service role only, claim locks, failures back off
select ok(not has_function_privilege('authenticated', 'public.jobs_enqueue(text, jsonb, timestamptz)', 'execute'), 'members cannot enqueue jobs');
select ok(not has_table_privilege('authenticated', 'public.jobs', 'select'), 'members cannot read jobs');
-- Start from an empty queue (rolled back with the test), so rows left by e2e runs don't count.
delete from public.jobs;
select public.jobs_enqueue('mux_delete_asset', '{"asset_id": "a1"}');
select is((select count(*)::int from public.jobs_claim(10, 60)), 1, 'a due job is claimed');
select is((select count(*)::int from public.jobs_claim(10, 60)), 0, 'a claimed job is locked');
select public.jobs_fail((select id from public.jobs limit 1), 'mux_unavailable');
select ok((select run_after > now() and locked_until is null from public.jobs limit 1), 'a failed job is retried later');

-- Reports: members read only their own; no direct writes
select ok(not has_table_privilege('authenticated', 'public.reports', 'insert'), 'members cannot insert reports directly');
select ok(not has_table_privilege('anon', 'public.reports', 'select'), 'anon cannot read reports');

-- Events: listing_viewed once per actor per day; owners' views are not stored
select public.events_insert('listing_viewed', '00000000-0000-4000-8000-00000000d101', repeat('a', 64), null, '{}', 1::smallint, 'pre-consent-0');
select public.events_insert('listing_viewed', '00000000-0000-4000-8000-00000000d101', repeat('a', 64), null, '{}', 1::smallint, 'pre-consent-0');
select public.events_insert('listing_viewed', '00000000-0000-4000-8000-00000000d101', repeat('b', 64), '00000000-0000-4000-8000-00000000c101', '{}', 1::smallint, 'pre-consent-0');
select is((select count(*)::int from public.events
  where name = 'listing_viewed' and listing_id = '00000000-0000-4000-8000-00000000d101'), 1,
  'a repeat view the same day and the owner''s own view are not stored');
select ok(not has_function_privilege('anon', 'public.events_insert(text, uuid, text, uuid, jsonb, smallint, text)', 'execute'), 'anon cannot write events');
select ok(not has_table_privilege('authenticated', 'public.events', 'select'), 'members cannot read events');

-- Action limits: stricter for accounts younger than 7 days
select is((select array_agg(public.action_limit_take('00000000-0000-4000-8000-00000000c102', 'listing_create')) from generate_series(1, 3)),
  array[0, 0, 0], 'a new account may create 3 listings a day');
select ok(public.action_limit_take('00000000-0000-4000-8000-00000000c102', 'listing_create') > 0,
  'the 4th returns a retry-after');
select is((select array_agg(public.action_limit_take('00000000-0000-4000-8000-00000000c101', 'listing_create')) from generate_series(1, 4)),
  array[0, 0, 0, 0], 'an older account gets the normal limit');

select * from finish();
rollback;
