-- Profile functions (Brief 03C.2; Founder notes and amendments 2026-11-07): public vs owner
-- views, handle checks and changes (30-day rule, holds, rate limit), staff moderation with
-- reasons and audit, the required name reset, and account deletion holding the handle.
begin;
create extension if not exists pgtap with schema extensions;
select plan(53);

insert into auth.users (id, email, aud, role, email_confirmed_at, phone_confirmed_at, phone, created_at) values
  ('00000000-0000-4000-8000-0000000c2e01', 'owner3@example.test', 'authenticated', 'authenticated', now(), now(), '15035550171', now()),
  ('00000000-0000-4000-8000-0000000c2e02', 'viewer3@example.test', 'authenticated', 'authenticated', now(), now(), '15035550172', now()),
  ('00000000-0000-4000-8000-0000000c2e03', 'staff3@example.test', 'authenticated', 'authenticated', now(), now(), '15035550173', now());
update public.profiles set display_name = 'Pell Quorra', home_zip = '97205', age_attested_at = now(),
  bio = 'Weekend woodworker.'
where id = '00000000-0000-4000-8000-0000000c2e01';
update public.profiles set display_name = 'Vee', home_zip = '97205', age_attested_at = now()
where id in ('00000000-0000-4000-8000-0000000c2e02', '00000000-0000-4000-8000-0000000c2e03');
insert into public.app_roles (user_id, role) values ('00000000-0000-4000-8000-0000000c2e03', 'moderator');

create function pg_temp.listing(p_id uuid, p_title text, p_status text, p_review text default 'ok', p_ready boolean default true)
returns void language plpgsql as $$
begin
  insert into public.listings (id, seller_id, pickup_zip, title, category_id, condition, price_cents)
  values (p_id, '00000000-0000-4000-8000-0000000c2e01', '97205', p_title,
          (select id from public.categories where slug = 'lighting'), 'good', 1500);
  insert into public.listing_media (owner_id, listing_id, status)
  values ('00000000-0000-4000-8000-0000000c2e01', p_id, 'awaiting_upload');
  if p_ready then
    update public.listing_media set status = 'processing' where listing_id = p_id;
    update public.listing_media set status = 'ready' where listing_id = p_id;
  end if;
  if p_status <> 'draft' then
    update public.listings set status = 'available', published_at = now(),
      review_state = p_review::public.listing_review_state where id = p_id;
    if p_status <> 'available' then
      update public.listings set status = p_status::public.listing_status where id = p_id;
    end if;
  end if;
end;
$$;
select pg_temp.listing('00000000-0000-4000-8000-0000000c2f01', 'Live lamp', 'available');
select pg_temp.listing('00000000-0000-4000-8000-0000000c2f02', 'Pending lamp', 'pending');
select pg_temp.listing('00000000-0000-4000-8000-0000000c2f03', 'Sold lamp', 'sold');
select pg_temp.listing('00000000-0000-4000-8000-0000000c2f04', 'Draft lamp', 'draft', 'ok', false);
select pg_temp.listing('00000000-0000-4000-8000-0000000c2f05', 'Held lamp', 'available', 'needs_review');
insert into public.events (name, listing_id, actor_hash, schema_version, consent_version)
values ('listing_viewed', '00000000-0000-4000-8000-0000000c2f01', repeat('b', 64), 1, 'pre-consent-0');

create function pg_temp.titles(p_handle text, p_filter text)
returns text[] language sql as $$
  select coalesce(array_agg(title order by title), '{}') from public.profile_listings(p_handle, p_filter, 'newest', null, 50)
$$;

-- Public view (guest)
set local role anon;
select is((select display_name from public.profile_by_handle('pellquorra')), 'Pell Quorra', 'guests see a profile by handle');
select is((select display_name from public.profile_by_handle('  PellQuorra ')), 'Pell Quorra', 'lookups ignore case and spaces');
select is((select bio from public.profile_by_handle('pellquorra')), 'Weekend woodworker.', 'the bio is public');
select is((select listed_count from public.profile_by_handle('pellquorra')), 2::bigint, 'listed = live available + pending');
select is((select sold_count from public.profile_by_handle('pellquorra')), 1::bigint, 'sold count');
select is((select is_owner from public.profile_by_handle('pellquorra')), false, 'a guest is not the owner');
select is_empty($$select * from public.profile_by_handle('nobodyhere')$$, 'an unknown handle returns nothing');
select is(pg_temp.titles('pellquorra', 'listings'), array['Live lamp', 'Pending lamp'], 'public Listings: available and pending only');
select is(pg_temp.titles('pellquorra', 'sold'), array['Sold lamp'], 'public Sold tab');
select throws_ok($$select pg_temp.titles('pellquorra', 'drafts')$$, '22023', null, 'guests cannot ask for drafts');
select throws_ok($$select pg_temp.titles('pellquorra', 'review')$$, '22023', null, 'guests cannot ask for listings in review');
select is((select views from public.profile_listings('pellquorra', 'listings', 'newest', null, 50) where title = 'Live lamp'),
  null::bigint, 'guests never see view counts');
reset role;

select ok(
  not exists (
    select 1 from pg_proc p, unnest(p.proargnames) n
    where p.proname in ('profile_by_handle', 'profile_listings')
      and n in ('home_zip', 'area_label', 'state', 'seller_id', 'user_id', 'display_point', 'precise_point')
  ),
  'profile functions never return a home ZIP, area, member id or point');

-- Another member: same public view
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000c2e02", "role": "authenticated"}';
select is(pg_temp.titles('pellquorra', 'listings'), array['Live lamp', 'Pending lamp'], 'other members see the public view');
select throws_ok($$select pg_temp.titles('pellquorra', 'all')$$, '22023', null, 'other members cannot ask for owner filters');

-- Owner view
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000c2e01", "role": "authenticated"}';
select is((select is_owner from public.profile_by_handle('pellquorra')), true, 'the owner is recognised');
select is(pg_temp.titles('pellquorra', 'all'), array['Draft lamp', 'Held lamp', 'Live lamp', 'Pending lamp', 'Sold lamp'],
  'owner All: every listing not deleted');
select is(pg_temp.titles('pellquorra', 'live'), array['Live lamp'], 'owner Live');
select is(pg_temp.titles('pellquorra', 'pending'), array['Pending lamp'], 'owner Pending');
select is(pg_temp.titles('pellquorra', 'drafts'), array['Draft lamp'], 'owner Drafts');
select is(pg_temp.titles('pellquorra', 'review'), array['Held lamp'], 'owner In review');
select is((select views from public.profile_listings('pellquorra', 'live', 'newest', null, 50)), 1::bigint,
  'the owner sees real view counts');

-- Handle status and changes
select is(public.handle_status('pellquorra'), 'yours', 'your own handle');
select is(public.handle_status('vee'), 'taken', 'another member''s handle');
select is(public.handle_status('settings'), 'reserved', 'reserved word');
select is(public.handle_status('x..y'), 'invalid', 'invalid handle');
select is(public.handle_status('fresh.handle'), 'available', 'a free handle');
select is(public.profile_set_handle('fresh.handle'), 'ok', 'the owner changes their handle');
select is((select handle from public.profiles where id = auth.uid()), 'fresh.handle', 'the new handle is saved');
select matches(public.profile_set_handle('another.one'), '^too_soon:', 'a second change within 30 days is refused');

set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000c2e02", "role": "authenticated"}';
select is(public.handle_status('pellquorra'), 'held', 'the old handle is held for 30 days');
select is(public.profile_set_handle('pellquorra'), 'held', 'nobody else can claim it');
reset role;
select is_empty($$select * from public.profile_by_handle('pellquorra')$$, 'the old handle is not redirected');

-- handle_status rate limit (amendment 4)
update public.action_limit_config set new_account_per_window = 2 where action = 'handle_check';
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000c2e03", "role": "authenticated"}';
select public.handle_status('aaa1');
select public.handle_status('aaa2');
select is(public.handle_status('aaa3'), 'limited', 'handle checks are rate-limited per account');
reset role;

-- Staff moderation (service role functions)
insert into public.reports (id, reporter_id, target_type, target_id, reason)
values
  ('00000000-0000-4000-8000-0000000c2a91', '00000000-0000-4000-8000-0000000c2e02', 'profile', '00000000-0000-4000-8000-0000000c2e01', 'harassment'),
  ('00000000-0000-4000-8000-0000000c2a92', '00000000-0000-4000-8000-0000000c2e03', 'profile', '00000000-0000-4000-8000-0000000c2e01', 'scam'),
  ('00000000-0000-4000-8000-0000000c2a93', '00000000-0000-4000-8000-0000000c2e03', 'profile', '00000000-0000-4000-8000-0000000c2e02', 'other');
update public.profiles set avatar_path = '0f8fad5b-d9cb-469f-a165-70867728950e.webp'
where id = '00000000-0000-4000-8000-0000000c2e01';

select throws_ok($$select public.admin_profile_action('00000000-0000-4000-8000-0000000c2e03', '00000000-0000-4000-8000-0000000c2a91', 'clear_bio', '  ')$$,
  '22023', null, 'every action needs a reason');
select throws_ok($$select public.admin_profile_action('00000000-0000-4000-8000-0000000c2e02', '00000000-0000-4000-8000-0000000c2a91', 'clear_bio', 'x')$$,
  '42501', null, 'only staff can act');
select is(public.admin_profile_action('00000000-0000-4000-8000-0000000c2e03', '00000000-0000-4000-8000-0000000c2a91', 'remove_photo', 'Not a real photo'),
  '0f8fad5b-d9cb-469f-a165-70867728950e.webp', 'remove photo returns the object to delete');
select is((select avatar_path from public.profiles where id = '00000000-0000-4000-8000-0000000c2e01'), null, 'the photo is gone');
select is((select status::text from public.reports where id = '00000000-0000-4000-8000-0000000c2a91'), 'actioned', 'the report is actioned');
select is(public.admin_profile_action('00000000-0000-4000-8000-0000000c2e03', '00000000-0000-4000-8000-0000000c2a93', 'dismiss', 'Nothing wrong'),
  null, 'dismiss');
select is((select status::text from public.reports where id = '00000000-0000-4000-8000-0000000c2a93'), 'dismissed', 'the report is dismissed');

select public.admin_profile_action('00000000-0000-4000-8000-0000000c2e03', '00000000-0000-4000-8000-0000000c2a92', 'require_new_name', 'Impersonation');
select is((select display_name from public.profiles where id = '00000000-0000-4000-8000-0000000c2e01'), 'Hucxter member',
  'require new name: the placeholder name');
select matches((select handle from public.profiles where id = '00000000-0000-4000-8000-0000000c2e01'), '^member',
  'and a generated handle');
select ok((select held_until > now() + interval '29 days' and user_id is null from public.handle_holds where handle = 'fresh.handle'),
  'the removed handle is held for 30 days for nobody');
select ok(not public.is_verified_member('00000000-0000-4000-8000-0000000c2e01'), 'the member can''t act until the reset is done');
select is(
  (select array_agg(action order by action) from public.audit_log where actor_id = '00000000-0000-4000-8000-0000000c2e03' and reason is not null),
  array['profile.name_reset', 'profile.photo_removed', 'report.dismissed'], 'every action is audited with its reason');

-- The member completes the reset
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000c2e01", "role": "authenticated"}';
select throws_ok($$select public.listing_save('00000000-0000-4000-8000-0000000c2f01', true)$$, '42501', null,
  'actions are blocked during the reset');
select is(public.profile_complete_reset('Pell', 'fresh.handle'), 'held', 'the removed handle can''t be chosen again');
select throws_ok($$select public.profile_complete_reset('Hucxter member', 'pell.q')$$, '23514', null,
  'the placeholder can''t be kept');
select is(public.profile_complete_reset('Pell', 'pell.q'), 'ok', 'a new name and handle end the reset');
reset role;
select ok(public.is_verified_member('00000000-0000-4000-8000-0000000c2e01'), 'the member can act again');

-- Account deletion holds the handle (amendment 1) and enqueues the photo delete
update public.profiles set avatar_path = '1f8fad5b-d9cb-469f-a165-70867728950e.webp'
where id = '00000000-0000-4000-8000-0000000c2e02';
select public.account_delete_prepare('00000000-0000-4000-8000-0000000c2e02');
select ok((select user_id is null and held_until > now() + interval '29 days' from public.handle_holds where handle = 'vee'),
  'a deleted member''s handle is held for 30 days for nobody');
select is((select count(*)::int from public.jobs where kind = 'storage_delete_avatar'
           and payload ->> 'path' = '1f8fad5b-d9cb-469f-a165-70867728950e.webp'), 1, 'the photo delete is enqueued');

select * from finish();
rollback;
