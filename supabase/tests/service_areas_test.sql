begin;

create extension if not exists pgtap with schema extensions;

select plan(12);

select has_table('public', 'service_areas', 'service_areas table exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.service_areas'::regclass),
  'RLS is enabled on service_areas'
);
select results_eq(
  $$select slug, name, center_zip, radius_mi::int, is_launch from public.service_areas where is_active$$,
  $$values ('portland-vancouver'::text, 'Portland–Vancouver'::text, '97205'::text, 30, true)$$,
  'Portland–Vancouver launch area is seeded by migration (D-35)'
);

select ok(public.in_launch_area('97205'), '97205 (Portland) is in the launch area');
select ok(public.in_launch_area('98660'), '98660 (Vancouver, WA) is in the launch area');
select ok(not public.in_launch_area('75009'), '75009 (Celina, TX) is not in the launch area');
select ok(not public.in_launch_area('99999'), 'an unknown ZIP is not in the launch area');

-- No function callable by browsers' roles takes or returns PostGIS geometry/geography.
select is_empty(
  $$select p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (has_function_privilege('anon', p.oid, 'execute')
        or has_function_privilege('authenticated', p.oid, 'execute'))
      and exists (
        select 1
        from unnest(coalesce(p.proallargtypes, p.proargtypes::oid[]) || p.prorettype) as t (type_oid)
        join pg_type ty on ty.oid = t.type_oid
        where ty.typname in ('geography', 'geometry')
      )$$,
  'no anon/authenticated-executable public function takes or returns a geometry or geography'
);

set local role anon;
select ok(public.in_launch_area('97205'), 'anon can call in_launch_area');
select is(
  (select count(*)::int from public.service_areas),
  1,
  'anon can read active service areas'
);
select throws_ok(
  $$insert into public.service_areas (slug, name, center_zip, radius_mi) values ('x', 'X', '97205', 5)$$,
  '42501',
  null,
  'anon cannot insert service areas'
);
reset role;

set local role authenticated;
select throws_ok(
  $$update public.service_areas set radius_mi = 100$$,
  '42501',
  null,
  'authenticated cannot update service areas'
);
reset role;

select * from finish();

rollback;
