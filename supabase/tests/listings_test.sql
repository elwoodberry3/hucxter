-- Listings schema (Brief 03C.1 §3.1): location derived from the pickup ZIP, point columns never
-- readable by browsers, history written on every price/status change.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

select has_table('public', 'listings', 'listings exists');
select ok((select relrowsecurity from pg_class where oid = 'public.listings'::regclass), 'RLS is on for listings');
select ok((select relrowsecurity from pg_class where oid = 'public.listing_price_history'::regclass), 'RLS is on for price history');
select ok((select relrowsecurity from pg_class where oid = 'public.listing_status_history'::regclass), 'RLS is on for status history');

select ok(not has_table_privilege('anon', 'public.listings', 'select'), 'anon cannot select listings at all');
select ok(not has_column_privilege('authenticated', 'public.listings', 'precise_point', 'select'), 'members cannot select precise_point');
select ok(not has_column_privilege('authenticated', 'public.listings', 'display_point', 'select'), 'members cannot select display_point');
select ok(not has_table_privilege('authenticated', 'public.listings', 'insert,update,delete'), 'members cannot write listings directly');
select ok(not has_table_privilege('authenticated', 'public.listing_price_history', 'select'), 'members cannot read price history directly');
select ok(not has_function_privilege('anon', 'public.distance_bucket(double precision)', 'execute'), 'anon cannot call distance_bucket');

insert into auth.users (id, email, aud, role)
values ('00000000-0000-4000-8000-00000000c001', 'seller@example.test', 'authenticated', 'authenticated');

insert into public.listings (id, seller_id, pickup_zip, price_cents)
values ('00000000-0000-4000-8000-00000000d001', '00000000-0000-4000-8000-00000000c001', '97205', 5000);

select ok(
  (select precise_point is not null and display_point is not null and area_label is not null and state = 'OR'
   from public.listings where id = '00000000-0000-4000-8000-00000000d001'),
  'the pickup ZIP sets the points, area label and state');
select ok(
  (select extensions.st_equals(display_point::extensions.geometry,
     extensions.st_snaptogrid(precise_point::extensions.geometry, 0.01))
   from public.listings where id = '00000000-0000-4000-8000-00000000d001'),
  'display_point is the precise point snapped to the 0.01° grid');

update public.listings set precise_point = extensions.st_setsrid(extensions.st_makepoint(-122.6, 45.6), 4326)::extensions.geography
where id = '00000000-0000-4000-8000-00000000d001';
select ok(
  (select extensions.st_equals(l.precise_point::extensions.geometry, pa.point::extensions.geometry)
   from public.listings l join public.postal_areas pa on pa.zip = l.pickup_zip
   where l.id = '00000000-0000-4000-8000-00000000d001'),
  'a point cannot be set directly; it is always the ZIP''s area point');

update public.listings set price_cents = 4000 where id = '00000000-0000-4000-8000-00000000d001';
select results_eq(
  $$select price_cents from public.listing_price_history
    where listing_id = '00000000-0000-4000-8000-00000000d001' order by id$$,
  $$values (5000), (4000)$$,
  'every price change is recorded');

select throws_ok(
  $$update public.listings set status = 'available' where id = '00000000-0000-4000-8000-00000000d001'$$,
  '23514', null, 'a listing cannot leave draft without every buyer-facing field');

select throws_ok(
  $$insert into public.listings (seller_id, price_cents) values ('00000000-0000-4000-8000-00000000c001', 1050)$$,
  '23514', null, 'prices are whole dollars');

select * from finish();
rollback;
