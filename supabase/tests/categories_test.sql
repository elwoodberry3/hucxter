begin;

create extension if not exists pgtap with schema extensions;

select plan(18);

-- Shape and security
select has_table('public', 'categories', 'categories table exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.categories'::regclass),
  'RLS is enabled on categories'
);

-- Seed (taxonomy v1)
select is(
  (select count(*)::int from public.categories where parent_id is null and is_active),
  14,
  '14 active departments are seeded'
);
select is(
  (select count(*)::int from public.categories d
    where d.parent_id is null
      and not exists (select 1 from public.categories s where s.parent_id = d.id)),
  0,
  'every department has at least one subcategory'
);
select results_eq(
  $$select slug from public.categories where nav_rank is not null order by nav_rank$$,
  $$values ('electronics'), ('home'), ('fashion'), ('sports-outdoors'), ('tools'), ('baby-kids'), ('free')$$,
  'header category bar order matches the taxonomy spec'
);
select is(
  (select count(*)::int from public.categories
    where slug ~ '(^|-)(vehicles?|cars?|trucks?|motorcycles|boats?|rvs?)$'
       or name ~* '^(vehicles|cars|trucks|motorcycles|boats)\b'),
  0,
  'no motor-vehicle categories (D-24); parts and accessories only'
);
select ok(
  exists (select 1 from public.categories where slug = 'auto-parts' and parent_id is null),
  'Auto Parts & Accessories department exists'
);
select is(
  (select count(*)::int from public.categories
    where jsonb_typeof(attributes -> 'filters') <> 'array'),
  0,
  'every row has an attributes.filters array'
);

-- Two-level rule
select throws_ok(
  $$insert into public.categories (parent_id, slug, name)
    select id, 'too-deep', 'Too deep' from public.categories where slug = 'furniture'$$,
  '23514',
  null,
  'a third level is rejected'
);

-- Fixture for RLS checks: an inactive department, created as the table owner.
insert into public.categories (slug, name, hero_key, is_active)
values ('test-inactive', 'Inactive test', 'misc', false);

-- anon
set local role anon;
select is(
  (select count(*)::int from public.categories where slug = 'test-inactive'),
  0,
  'anon cannot see inactive categories'
);
select ok(
  (select count(*) from public.categories) > 14,
  'anon can read active categories'
);
select throws_ok(
  $$insert into public.categories (slug, name, hero_key) values ('anon-insert', 'X', 'misc')$$,
  '42501',
  null,
  'anon cannot insert categories'
);
select throws_ok(
  $$update public.categories set name = 'Hacked' where slug = 'electronics'$$,
  '42501',
  null,
  'anon cannot update categories'
);
select throws_ok(
  $$delete from public.categories where slug = 'electronics'$$,
  '42501',
  null,
  'anon cannot delete categories'
);
select throws_ok(
  $$truncate public.categories cascade$$,
  '42501',
  null,
  'anon cannot truncate categories'
);
reset role;

-- authenticated
set local role authenticated;
select is(
  (select count(*)::int from public.categories where slug = 'test-inactive'),
  0,
  'authenticated cannot see inactive categories'
);
select throws_ok(
  $$insert into public.categories (slug, name, hero_key) values ('auth-insert', 'X', 'misc')$$,
  '42501',
  null,
  'authenticated cannot insert categories'
);
select throws_ok(
  $$update public.categories set name = 'Hacked' where slug = 'electronics'$$,
  '42501',
  null,
  'authenticated cannot update categories'
);
reset role;

select * from finish();

rollback;
