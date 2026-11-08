-- Daily caps on listing events (Brief 03C.1b H3; PR #10 review M2). A script that drops hx_vid on
-- every request gets a new guest id each time, so guest views were unbounded. Per listing per UTC
-- day: at most 200 guest listing_viewed rows and at most 1,000 events rows of any name. Members
-- are still one view per member per day (the unique index), bounded by phone verification. The
-- route also counts only same-origin page loads (Sec-Fetch-Site). No IP is read or stored.
--
-- Recovery: re-run events_insert and its grants from 20261106211128_create_events.sql; then
-- `drop table public.listing_event_counts;`

create table public.listing_event_counts (
  listing_id uuid not null,
  day date not null,
  guest_views int not null default 0 check (guest_views >= 0),
  total int not null default 0 check (total >= 0),
  primary key (listing_id, day)
);

comment on table public.listing_event_counts is
  'Per-listing per-day event counters for the caps in events_insert. Counts only; no actors.';

create index listing_event_counts_day_idx on public.listing_event_counts (day);

alter table public.listing_event_counts enable row level security;
revoke all on public.listing_event_counts from anon, authenticated, service_role;
grant select on public.listing_event_counts to service_role;

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
  -- Caps per listing per UTC day (docs/runbooks/video.md "Events").
  c_guest_views constant int := 200;
  c_total constant int := 1000;
  v_day date := (now() at time zone 'utc')::date;
  v_guest boolean := p_name = 'listing_viewed' and p_viewer_id is null;
  v_counts public.listing_event_counts;
begin
  if p_name = 'listing_viewed' then
    if p_listing_id is null or p_actor_hash is null then
      raise exception 'listing_viewed needs a listing and an actor' using errcode = 'invalid_parameter_value';
    end if;
    if p_viewer_id is not null and exists (
      select 1 from public.listings l where l.id = p_listing_id and l.seller_id = p_viewer_id
    ) then
      return;
    end if;
  end if;

  if p_listing_id is not null then
    insert into public.listing_event_counts (listing_id, day) values (p_listing_id, v_day)
    on conflict (listing_id, day) do nothing;
    select * into v_counts from public.listing_event_counts
    where listing_id = p_listing_id and day = v_day
    for update;
    if v_counts.total >= c_total or (v_guest and v_counts.guest_views >= c_guest_views) then
      return;
    end if;
  end if;

  insert into public.events (name, listing_id, actor_hash, props, schema_version, consent_version)
  values (p_name, p_listing_id, p_actor_hash, coalesce(p_props, '{}'::jsonb), p_schema_version, p_consent_version)
  on conflict do nothing;

  -- Count only rows that were really written (a repeat view the same day is deduplicated).
  if found and p_listing_id is not null then
    update public.listing_event_counts
    set total = total + 1, guest_views = guest_views + case when v_guest then 1 else 0 end
    where listing_id = p_listing_id and day = v_day;
    delete from public.listing_event_counts where day < v_day - 1;
  end if;
end;
$$;

revoke execute on function public.events_insert(text, uuid, text, uuid, jsonb, smallint, text)
  from public, anon, authenticated;
grant execute on function public.events_insert(text, uuid, text, uuid, jsonb, smallint, text)
  to service_role;
