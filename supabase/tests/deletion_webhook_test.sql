-- Account deletion is idempotent and marks media removed; an early "ready" webhook is applied
-- (Brief 03C.1b H4).
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email, aud, role, email_confirmed_at, phone_confirmed_at, phone) values
  ('00000000-0000-4000-8000-00000000d401', 'leaver@example.test', 'authenticated', 'authenticated', now(), now(), '15035550401'),
  ('00000000-0000-4000-8000-00000000d402', 'early@example.test', 'authenticated', 'authenticated', now(), now(), '15035550402');
update public.profiles set display_name = 'Lee', home_zip = '97205', age_attested_at = now(),
  avatar_path = '0f8fad5b-d9cb-469f-a165-70867728950e.webp'
where id = '00000000-0000-4000-8000-00000000d401';

insert into public.listings (id, seller_id, pickup_zip) values
  ('00000000-0000-4000-8000-0000000d4a01', '00000000-0000-4000-8000-00000000d401', '97205'),
  ('00000000-0000-4000-8000-0000000d4a02', '00000000-0000-4000-8000-00000000d402', '97205');
insert into public.listing_media (id, owner_id, listing_id, status) values
  ('00000000-0000-4000-8000-0000000d4b01', '00000000-0000-4000-8000-00000000d401', '00000000-0000-4000-8000-0000000d4a01', 'awaiting_upload'),
  ('00000000-0000-4000-8000-0000000d4b02', '00000000-0000-4000-8000-00000000d402', '00000000-0000-4000-8000-0000000d4a02', 'awaiting_upload');
update public.listing_media set mux_upload_id = 'up-d401', mux_asset_id = 'asset-d401', status = 'processing'
where id = '00000000-0000-4000-8000-0000000d4b01';

select public.account_delete_prepare('00000000-0000-4000-8000-00000000d401') as first_jobs \gset
select is(:first_jobs, 2, 'prepare enqueues the asset and avatar deletes');
select is((select status::text from public.listing_media where id = '00000000-0000-4000-8000-0000000d4b01'),
  'removed', 'prepare marks the member''s media removed');
select is((select avatar_path from public.profiles where id = '00000000-0000-4000-8000-00000000d401'),
  null, 'prepare clears avatar_path once its delete is queued');

select is(public.account_delete_prepare('00000000-0000-4000-8000-00000000d401'), 0, 'a retry enqueues nothing');
select is((select count(*)::int from public.audit_log
  where action = 'account.deleted' and target_id = '00000000-0000-4000-8000-00000000d401'),
  1, 'a retry writes no second audit row');
select is((select count(*)::int from public.jobs where payload ->> 'asset_id' = 'asset-d401' and kind = 'mux_delete_asset'),
  1, 'one delete job for the asset');

-- The video becomes ready between prepare and deleteUser: the webhook deletes it.
select is(public.media_apply_webhook('evt-d401', 'video.asset.ready', '00000000-0000-4000-8000-0000000d4b01',
  'up-d401', 'asset-d401', 'pb-d401', 12, 60), 'ignored', 'a ready webhook for removed media is ignored');
select is((select count(*)::int from public.jobs where payload ->> 'asset_id' = 'asset-d401' and kind = 'mux_delete_asset'),
  2, '…and queues the asset for deletion again');

-- Ready before upload.asset_created (out of order).
select is(public.media_apply_webhook('evt-d402', 'video.asset.ready', '00000000-0000-4000-8000-0000000d4b02',
  'up-d402', 'asset-d402', 'pb-d402', 12, 60), 'ready', 'an early ready event is applied, not an error');

select * from finish();
rollback;
