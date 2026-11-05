begin;

create extension if not exists pgtap with schema extensions;

select plan(21);

select has_table('public', 'postal_areas', 'postal_areas table exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.postal_areas'::regclass),
  'RLS is enabled on postal_areas'
);
-- Nationwide data migration (D-36): 2020 ZCTAs for the 50 states, DC and Puerto Rico. The source
-- has 33,791 ZCTAs; 17 in other territories are excluded (see the migration header).
select is(
  (select count(*)::int from public.postal_areas where is_active),
  33774,
  'every 2020 ZCTA in the 50 states, DC and PR is loaded (33,791 in source minus 17 territory ZCTAs)'
);
select is(
  (select count(distinct state)::int from public.postal_areas),
  52,
  '50 states + DC + PR'
);
select results_eq(
  $$select zip, state from public.postal_areas
    where zip in ('97205', '98660', '10001', '99501', '96813', '00601') order by zip$$,
  $$values ('00601'::text, 'PR'::text), ('10001', 'NY'), ('96813', 'HI'), ('97205', 'OR'), ('98660', 'WA'), ('99501', 'AK')$$,
  'Portland, Vancouver WA, New York, Anchorage, Honolulu and Puerto Rico ZIPs resolve'
);
select results_eq(
  $$select area_label from public.postal_area_lookup('97205')$$,
  $$values ('Portland'::text)$$,
  '97205 is labeled Portland'
);
select is_empty(
  $$select * from public.postal_area_lookup('00501')$$,
  'a non-ZCTA ZIP (00501, IRS business ZIP) does not resolve'
);
select is_empty(
  $$select * from public.postal_area_lookup('00802')$$,
  'territory ZCTAs outside the 50 states, DC and PR are not loaded'
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
  $$select * from public.postal_area_nearest(35.0, -45.0)$$,
  'postal_area_nearest returns nothing more than 40 km from any ZIP (mid-Atlantic)'
);
select is(
  (select pronargs::int from pg_proc where oid = 'public.postal_area_nearest'::regproc),
  2,
  'postal_area_nearest takes only lat/lon (search distance is fixed, not caller-controlled)'
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
  (select count(*) from public.postal_areas) > 33000,
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
