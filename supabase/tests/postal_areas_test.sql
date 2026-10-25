begin;

create extension if not exists pgtap with schema extensions;

select plan(15);

select has_table('public', 'postal_areas', 'postal_areas table exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.postal_areas'::regclass),
  'RLS is enabled on postal_areas'
);
select ok(
  (select count(*) from public.postal_areas) >= 250,
  'North Texas test region is seeded'
);

-- Lookup
select results_eq(
  $$select zip, area_label, state from public.postal_area_lookup('75009')$$,
  $$values ('75009'::text, 'Celina'::text, 'TX'::text)$$,
  'postal_area_lookup returns the area label for a seeded ZIP'
);
select is_empty(
  $$select * from public.postal_area_lookup('99999')$$,
  'postal_area_lookup returns nothing for an unknown ZIP'
);

-- Nearest (downtown Dallas, ~32.78, -96.80)
select is(
  (select state from public.postal_area_nearest(32.7812, -96.7971)),
  'TX',
  'postal_area_nearest finds a nearby ZIP'
);
select is_empty(
  $$select * from public.postal_area_nearest(40.7128, -74.0060)$$,
  'postal_area_nearest returns nothing far outside the region'
);
select throws_ok(
  $$select * from public.postal_area_nearest(91, 0)$$,
  '22023',
  null,
  'postal_area_nearest rejects out-of-range coordinates'
);

-- Fixture: an inactive ZIP, created as the table owner.
insert into public.postal_areas (zip, area_label, state, point, is_active)
values ('00000', 'Inactive', 'TX', extensions.st_setsrid(extensions.st_makepoint(-96.8, 32.8), 4326)::extensions.geography, false);

set local role anon;
select is(
  (select count(*)::int from public.postal_areas where zip = '00000'),
  0,
  'anon cannot see inactive postal areas'
);
select is_empty(
  $$select * from public.postal_area_lookup('00000')$$,
  'lookup hides inactive postal areas from anon'
);
select ok(
  (select count(*) from public.postal_areas) >= 250,
  'anon can read active postal-area labels'
);
select throws_ok(
  $$select point from public.postal_areas limit 1$$,
  '42501',
  null,
  'anon cannot read the point column'
);
select throws_ok(
  $$insert into public.postal_areas (zip, area_label, state, point) values ('11111', 'X', 'TX', null)$$,
  '42501',
  null,
  'anon cannot insert postal areas'
);
select throws_ok(
  $$update public.postal_areas set area_label = 'Hacked' where zip = '75009'$$,
  '42501',
  null,
  'anon cannot update postal areas'
);
reset role;

set local role authenticated;
select throws_ok(
  $$delete from public.postal_areas where zip = '75009'$$,
  '42501',
  null,
  'authenticated cannot delete postal areas'
);
reset role;

select * from finish();

rollback;
