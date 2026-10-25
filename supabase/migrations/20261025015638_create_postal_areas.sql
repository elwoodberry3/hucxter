-- ZIP -> coarse area lookup for guest and member location (hucxter-geo-radius rules 5 and 7).
-- Rows come from US Census 2020 ZCTA data (public domain), seeded in supabase/seed.sql.
-- `point` is the ZCTA's Census internal point rounded to ~100 m: an area centroid, never a person.
-- Recovery: additive. `drop table public.postal_areas cascade;` undoes it (drops the functions too).

create table public.postal_areas (
  zip text primary key check (zip ~ '^[0-9]{5}$'),
  area_label text not null check (char_length(area_label) between 1 and 60),
  state text not null check (state ~ '^[A-Z]{2}$'),
  point extensions.geography (Point, 4326) not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.postal_areas is
  'ZIP (Census ZCTA) -> area label and coarse point. Public read of active rows (label columns only); writes via service role only.';

create index postal_areas_point_idx on public.postal_areas using gist (point);

create trigger postal_areas_set_updated_at
  before update on public.postal_areas
  for each row execute function public.set_updated_at();

alter table public.postal_areas enable row level security;

-- Browsers never write; they read only the label columns. The point stays server-side.
revoke all on public.postal_areas from anon, authenticated;
grant select (zip, area_label, state, is_active) on public.postal_areas to anon, authenticated;

create policy postal_areas_public_read_active
  on public.postal_areas
  for select
  to anon, authenticated
  using (is_active);

-- Look up one ZIP. Returns no row for unknown or inactive ZIPs.
create or replace function public.postal_area_lookup(p_zip text)
returns table (zip text, area_label text, state text)
language sql
stable
security invoker
set search_path = ''
as $$
  select pa.zip, pa.area_label, pa.state
  from public.postal_areas pa
  where pa.zip = p_zip and pa.is_active;
$$;

-- Nearest active ZIP to a browser-supplied location ("Use my current location").
-- Coordinates are rounded to 2 decimals (~1 km) before use and never stored. Returns no row if
-- nothing is within p_max_m (default 40 km). Security definer so callers never read `point`.
create or replace function public.postal_area_nearest(
  p_lat double precision,
  p_lon double precision,
  p_max_m double precision default 40000
)
returns table (zip text, area_label text, state text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_point extensions.geography;
begin
  if p_lat is null or p_lon is null or p_lat not between -90 and 90 or p_lon not between -180 and 180 then
    raise exception 'postal_area_nearest: coordinates out of range' using errcode = '22023';
  end if;
  v_point := extensions.st_setsrid(
    extensions.st_makepoint(round(p_lon::numeric, 2)::double precision, round(p_lat::numeric, 2)::double precision),
    4326
  )::extensions.geography;
  return query
    select pa.zip, pa.area_label, pa.state
    from public.postal_areas pa
    where pa.is_active
      and extensions.st_dwithin(pa.point, v_point, least(greatest(p_max_m, 0), 160934))
    order by extensions.st_distance(pa.point, v_point), pa.zip
    limit 1;
end;
$$;

revoke all on function public.postal_area_lookup(text) from public;
revoke all on function public.postal_area_nearest(double precision, double precision, double precision) from public;
grant execute on function public.postal_area_lookup(text) to anon, authenticated, service_role;
grant execute on function public.postal_area_nearest(double precision, double precision, double precision) to anon, authenticated, service_role;
