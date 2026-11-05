-- Launch areas (D-35): where Hucxter is actively recruiting buyers and sellers. Location never
-- blocks a feature (D-36); this only drives the "Hucxter is starting in …" notice and, later,
-- launch-area metrics. Radius is data, so it's easy to change.
-- Recovery: additive. `drop function public.in_launch_area(text); drop table public.service_areas;`

create table public.service_areas (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  name text not null check (char_length(name) between 1 and 60),
  center_zip text not null references public.postal_areas (zip) on delete restrict,
  radius_mi numeric(5, 1) not null check (radius_mi > 0 and radius_mi <= 100),
  is_launch boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.service_areas is
  'Launch/service areas (center ZIP + radius). Public read of active rows; writes via service role only.';

create index service_areas_center_zip_idx on public.service_areas (center_zip);

create trigger service_areas_set_updated_at
  before update on public.service_areas
  for each row execute function public.set_updated_at();

alter table public.service_areas enable row level security;

revoke all on public.service_areas from anon, authenticated;
grant select on public.service_areas to anon, authenticated;

create policy service_areas_public_read_active
  on public.service_areas
  for select
  to anon, authenticated
  using (is_active);

-- D-35: Portland–Vancouver metro, 30 mi from 97205 (radius is the Chair's proposal).
insert into public.service_areas (slug, name, center_zip, radius_mi, is_launch)
values ('portland-vancouver', 'Portland–Vancouver', '97205', 30, true)
on conflict (slug) do update set
  name = excluded.name,
  center_zip = excluded.center_zip,
  radius_mi = excluded.radius_mi,
  is_launch = excluded.is_launch,
  is_active = true;

-- True when the ZIP's area point is within an active launch area's radius. Returns a boolean
-- only, never a point or distance. Security definer because postal_areas.point is not readable
-- by anon/authenticated.
create or replace function public.in_launch_area(p_zip text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.service_areas sa
    join public.postal_areas center on center.zip = sa.center_zip
    join public.postal_areas viewer on viewer.zip = p_zip and viewer.is_active
    where sa.is_launch
      and sa.is_active
      and extensions.st_dwithin(viewer.point, center.point, sa.radius_mi * 1609.344)
  );
$$;

revoke all on function public.in_launch_area(text) from public;
grant execute on function public.in_launch_area(text) to anon, authenticated, service_role;
