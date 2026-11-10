-- Discover feed events (Brief 03 Milestone 3D). Two new event names, deduplicated like
-- listing_viewed and bounded by daily caps in events_insert:
--   discover_viewed       one per actor per UTC day; no listing.
--   discover_item_viewed  one per (listing, actor, UTC day); never for the seller. Guest rows have
--                         their own per-listing cap (200 a day), so they never use up the
--                         listing_viewed guest budget that feeds the owner's view count. Both count
--                         toward the existing 1,000 events per listing per day.
-- Events with no listing were uncapped. They now get a per-name daily counter: at most 20,000 rows
-- per name per UTC day (event_day_counts). Counts only; no actors.
--
-- Recovery: re-run events_insert and its grants from 20261108110000_cap_listing_events_daily.sql;
-- then `drop index public.events_discover_item_viewed_once_idx;
-- drop index public.events_discover_viewed_once_idx; drop table public.event_day_counts;
-- alter table public.listing_event_counts drop column guest_discover_views;`

create unique index events_discover_item_viewed_once_idx on public.events (listing_id, actor_hash, day)
  where name = 'discover_item_viewed';
create unique index events_discover_viewed_once_idx on public.events (actor_hash, day)
  where name = 'discover_viewed';

alter table public.listing_event_counts
  add column guest_discover_views int not null default 0 check (guest_discover_views >= 0);

create table public.event_day_counts (
  day date not null,
  name text not null check (name ~ '^[a-z]+(_[a-z]+)*$' and char_length(name) <= 60),
  total int not null default 0 check (total >= 0),
  primary key (day, name)
);

comment on table public.event_day_counts is
  'Per-name per-day counters for events without a listing (caps in events_insert). Counts only.';

alter table public.event_day_counts enable row level security;
revoke all on public.event_day_counts from anon, authenticated, service_role;
grant select on public.event_day_counts to service_role;

create or replace function public.events_insert(
  p_name text,
  p_listing_id uuid,
  p_actor_hash text,
  p_viewer_id uuid,
  p_props jsonb,
  p_schema_version smallint,
  p_consent_version text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  -- Caps per UTC day (docs/runbooks/video.md "Events").
  c_guest_views constant int := 200;
  c_guest_discover_views constant int := 200;
  c_total constant int := 1000;
  c_unlisted_per_name constant int := 20000;
  v_day date := (now() at time zone 'utc')::date;
  v_guest_view boolean := p_name = 'listing_viewed' and p_viewer_id is null;
  v_guest_discover boolean := p_name = 'discover_item_viewed' and p_viewer_id is null;
  v_counts public.listing_event_counts;
  v_day_total int;
begin
  if p_name in ('listing_viewed', 'discover_item_viewed') then
    if p_listing_id is null or p_actor_hash is null then
      raise exception '% needs a listing and an actor', p_name using errcode = 'invalid_parameter_value';
    end if;
    if p_viewer_id is not null and exists (
      select 1 from public.listings l where l.id = p_listing_id and l.seller_id = p_viewer_id
    ) then
      return;
    end if;
  elsif p_name = 'discover_viewed' then
    if p_listing_id is not null or p_actor_hash is null then
      raise exception 'discover_viewed needs an actor and no listing' using errcode = 'invalid_parameter_value';
    end if;
  end if;

  if p_listing_id is not null then
    insert into public.listing_event_counts (listing_id, day) values (p_listing_id, v_day)
    on conflict (listing_id, day) do nothing;
    select * into v_counts from public.listing_event_counts
    where listing_id = p_listing_id and day = v_day
    for update;
    if v_counts.total >= c_total
      or (v_guest_view and v_counts.guest_views >= c_guest_views)
      or (v_guest_discover and v_counts.guest_discover_views >= c_guest_discover_views) then
      return;
    end if;
  else
    insert into public.event_day_counts (day, name) values (v_day, p_name)
    on conflict (day, name) do nothing;
    select total into v_day_total from public.event_day_counts
    where day = v_day and name = p_name
    for update;
    if v_day_total >= c_unlisted_per_name then
      return;
    end if;
  end if;

  insert into public.events (name, listing_id, actor_hash, props, schema_version, consent_version)
  values (p_name, p_listing_id, p_actor_hash, coalesce(p_props, '{}'::jsonb), p_schema_version, p_consent_version)
  on conflict do nothing;

  -- Count only rows that were really written (a repeat the same day is deduplicated).
  if found then
    if p_listing_id is not null then
      update public.listing_event_counts
      set total = total + 1,
        guest_views = guest_views + case when v_guest_view then 1 else 0 end,
        guest_discover_views = guest_discover_views + case when v_guest_discover then 1 else 0 end
      where listing_id = p_listing_id and day = v_day;
      delete from public.listing_event_counts where day < v_day - 1;
    else
      update public.event_day_counts set total = total + 1 where day = v_day and name = p_name;
      delete from public.event_day_counts where day < v_day - 1;
    end if;
  end if;
end;
$$;

revoke execute on function public.events_insert(text, uuid, text, uuid, jsonb, smallint, text)
  from public, anon, authenticated;
grant execute on function public.events_insert(text, uuid, text, uuid, jsonb, smallint, text)
  to service_role;
