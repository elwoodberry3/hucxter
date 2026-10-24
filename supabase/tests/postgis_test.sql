begin;

create extension if not exists pgtap with schema extensions;

select plan(2);

select has_extension('postgis', 'PostGIS extension is installed');

select isnt(
  extensions.postgis_version(),
  null,
  'postgis_version() returns a version'
);

select * from finish();

rollback;
