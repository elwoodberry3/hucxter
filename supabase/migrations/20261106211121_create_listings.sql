-- Listings (Brief 03C.1 §3.1; brief-03 §3C "Data"; hucxter-geo-radius). A listing starts as a
-- draft when the seller picks a video, and goes live through listing_publish() (M8).
--
-- Location (geo skill, Brief 03C.1 §3.1): we collect only a pickup ZIP. precise_point is that ZIP's
-- area point (postal_areas.point, already a Census centroid rounded to ~100 m); display_point is
-- snapped to a 0.01° grid by trigger. Neither column is ever returned to a browser: anon has no
-- access to this table, members can't select either point column, and the discovery functions
-- return distance buckets and area labels only.
--
-- History (D-45, §3.1): listing_price_history gets a row for every price change and
-- listing_status_history for every change to status, review state, removal or deletion, with a
-- computed `live` flag. The D-45 price-drop rule reads both. Members can't read or write either
-- table; listing_price_points() (M8) exposes what the rule needs.
--
-- Writes: none for anon/authenticated. Owners change listings only through the security-definer
-- mutators in M8 (ownership, verified-member, transition and rate-limit checks), called by
-- apps/web server code after contracts validation (single write path, CLAUDE.md rule 3).
--
-- Recovery: additive. `drop table public.listing_price_history, public.listing_status_history,
-- public.listings; drop function public.listings_set_location(), public.listings_record_history(),
-- public.snap_display_point(extensions.geography), public.distance_bucket(double precision),
-- public.is_verified_member(uuid); drop type public.listing_status, public.listing_review_state;`
-- (after M3–M8 are dropped).

create type public.listing_status as enum ('draft', 'available', 'pending', 'sold');
create type public.listing_review_state as enum ('ok', 'needs_review');

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid references public.categories (id) on delete restrict,
  title text check (title is null or (char_length(title) between 1 and 80 and title = btrim(title))),
  description text not null default '' check (char_length(description) <= 2000),
  -- Whole dollars (D-09: no payments; Free = 0). Upper bound keeps a typo from showing $1B.
  price_cents integer check (
    price_cents is null or (price_cents between 0 and 10000000 and price_cents % 100 = 0)
  ),
  condition text check (condition in ('new', 'like_new', 'good', 'fair', 'for_parts')),
  attributes jsonb not null default '{}'::jsonb check (jsonb_typeof(attributes) = 'object'),
  status public.listing_status not null default 'draft',
  review_state public.listing_review_state not null default 'ok',
  pickup_zip text references public.postal_areas (zip) on delete restrict,
  precise_point extensions.geography (Point, 4326),
  display_point extensions.geography (Point, 4326),
  area_label text,
  state text,
  publish_when_ready boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  removed_at timestamptz,
  search tsvector generated always as (
    to_tsvector('english'::regconfig, coalesce(title, '') || ' ' || description)
  ) stored,
  -- Anything past draft has every field a buyer sees.
  constraint listings_complete_when_published check (
    status = 'draft'
    or (
      title is not null and category_id is not null and price_cents is not null
      and condition is not null and pickup_zip is not null and precise_point is not null
      and area_label is not null and state is not null and published_at is not null
    )
  )
);

comment on table public.listings is
  'Marketplace listings. No anon access; members read own rows (no point columns); writes via M8 definer functions.';
comment on column public.listings.precise_point is
  'PRIVATE. Pickup ZIP area point. Never returned to a browser.';

create index listings_seller_idx on public.listings (seller_id, created_at desc);
create index listings_category_idx on public.listings (category_id);
create index listings_display_point_gix on public.listings using gist (display_point);
create index listings_live_recent_idx on public.listings (published_at desc, id desc)
  where status in ('available', 'pending') and review_state = 'ok'
    and deleted_at is null and removed_at is null;
create index listings_search_idx on public.listings using gin (search);

-- Snap to a ~0.01° grid (~1.1 km N–S) for discovery and display (geo skill reference).
create or replace function public.snap_display_point(p extensions.geography)
returns extensions.geography
language sql
immutable
set search_path = ''
as $$
  select extensions.st_snaptogrid(p::extensions.geometry, 0.01)::extensions.geography
$$;

-- Bucketed distance label, meters in. Labels match DistanceBucket in packages/contracts/feed.ts.
create or replace function public.distance_bucket(m double precision)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when m < 1609.34 then '<1 mi'
    when m < 8046.72 then '1–5 mi'
    when m < 16093.4 then '5–10 mi'
    when m < 40233.5 then '10–25 mi'
    when m < 80467.2 then '25–50 mi'
    else '50–100 mi'
  end
$$;

revoke execute on function public.snap_display_point(extensions.geography) from public, anon, authenticated;
revoke execute on function public.distance_bucket(double precision) from public, anon, authenticated;

-- Pickup ZIP → points and labels, always derived (a point can't be set directly). Runs as the
-- table owner, so it can read postal_areas.point.
create or replace function public.listings_set_location()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_area record;
begin
  if new.pickup_zip is null then
    new.precise_point := null;
    new.display_point := null;
    new.area_label := null;
    new.state := null;
    return new;
  end if;
  select pa.point, pa.area_label, pa.state into v_area
  from public.postal_areas pa where pa.zip = new.pickup_zip and pa.is_active;
  if not found then
    raise exception 'unknown pickup ZIP' using errcode = 'foreign_key_violation';
  end if;
  new.precise_point := v_area.point;
  new.display_point := public.snap_display_point(v_area.point);
  new.area_label := v_area.area_label;
  new.state := v_area.state;
  return new;
end;
$$;

revoke execute on function public.listings_set_location() from public, anon, authenticated;

create trigger listings_location
  before insert or update of pickup_zip, precise_point on public.listings
  for each row execute function public.listings_set_location();

create trigger listings_set_updated_at
  before update on public.listings
  for each row execute function public.set_updated_at();

create table public.listing_price_history (
  id bigint generated always as identity primary key,
  listing_id uuid not null references public.listings (id) on delete cascade,
  price_cents integer not null check (price_cents >= 0),
  effective_from timestamptz not null default now()
);

create index listing_price_history_listing_idx
  on public.listing_price_history (listing_id, effective_from);

create table public.listing_status_history (
  id bigint generated always as identity primary key,
  listing_id uuid not null references public.listings (id) on delete cascade,
  status public.listing_status not null,
  review_state public.listing_review_state not null,
  -- Visible to buyers at this moment (available/pending, approved, not removed or deleted).
  live boolean not null,
  changed_at timestamptz not null default now()
);

create index listing_status_history_listing_idx
  on public.listing_status_history (listing_id, changed_at);

create or replace function public.listings_record_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_live boolean := new.status in ('available', 'pending') and new.review_state = 'ok'
    and new.deleted_at is null and new.removed_at is null;
begin
  if new.price_cents is not null
    and (tg_op = 'INSERT' or new.price_cents is distinct from old.price_cents) then
    insert into public.listing_price_history (listing_id, price_cents) values (new.id, new.price_cents);
  end if;
  if tg_op = 'INSERT'
    or new.status is distinct from old.status
    or new.review_state is distinct from old.review_state
    or (new.deleted_at is null) <> (old.deleted_at is null)
    or (new.removed_at is null) <> (old.removed_at is null) then
    insert into public.listing_status_history (listing_id, status, review_state, live)
    values (new.id, new.status, new.review_state, v_live);
  end if;
  return null;
end;
$$;

revoke execute on function public.listings_record_history() from public, anon, authenticated;

create trigger listings_history
  after insert or update on public.listings
  for each row execute function public.listings_record_history();

-- Verified = all four of D-34 (mirrors verificationState in apps/web/src/server/auth): email and
-- phone confirmed, 18+ attested, home ZIP set, and the profile not deleted. Used by M8 mutators as
-- defense in depth behind requireVerifiedMember().
create or replace function public.is_verified_member(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users u
    join public.profiles p on p.id = u.id
    where u.id = p_user_id
      and u.email_confirmed_at is not null
      and u.phone_confirmed_at is not null
      and p.age_attested_at is not null
      and p.home_zip is not null
      and p.deleted_at is null
  )
$$;

revoke execute on function public.is_verified_member(uuid) from public, anon, authenticated;

alter table public.listings enable row level security;
alter table public.listing_price_history enable row level security;
alter table public.listing_status_history enable row level security;

revoke all on public.listings, public.listing_price_history, public.listing_status_history
  from anon, authenticated;

-- Owners read their own rows (drafts and in-review included) for /listings, without the points.
grant select (
  id, seller_id, category_id, title, description, price_cents, condition, attributes, status,
  review_state, pickup_zip, area_label, state, publish_when_ready, published_at, created_at,
  updated_at, deleted_at, removed_at
) on public.listings to authenticated;

create policy listings_select_own
  on public.listings
  for select
  to authenticated
  using (seller_id = (select auth.uid()) and deleted_at is null);
