-- Reference only: the real migration is authored via `supabase migration new`.
-- Requires: create extension if not exists postgis with schema extensions;

-- Columns on public.listings (excerpt)
--   precise_point  extensions.geography(Point, 4326) not null  -- PRIVATE
--   display_point  extensions.geography(Point, 4326) not null  -- derived, public-safe
--   area_label     text not null

-- Snap precise point to a ~0.01° grid (~1.1 km N–S) for display / discovery.
create or replace function public.snap_display_point(p extensions.geography)
returns extensions.geography
language sql immutable
as $$
  select extensions.st_snaptogrid(p::extensions.geometry, 0.01)::extensions.geography
$$;

create or replace function public.listings_set_display_point()
returns trigger
language plpgsql
as $$
begin
  new.display_point := public.snap_display_point(new.precise_point);
  return new;
end;
$$;

create trigger listings_display_point
before insert or update of precise_point on public.listings
for each row execute function public.listings_set_display_point();

create index listings_display_point_gix on public.listings using gist (display_point);
create index listings_active_recent_idx on public.listings (created_at desc, id desc)
  where status = 'active';

-- Bucketed distance label. Input in meters.
create or replace function public.distance_bucket(m double precision)
returns text
language sql immutable
as $$
  select case
    when m < 1609.34  then '<1 mi'
    when m < 8046.72  then '1–5 mi'
    when m < 16093.4  then '5–10 mi'
    when m < 40233.5  then '10–25 mi'
    when m < 80467.2  then '25–50 mi'
    else '50–100 mi'
  end
$$;

-- Column privilege: API role must not be able to select precise_point.
-- revoke select (precise_point) on public.listings from anon, authenticated;
