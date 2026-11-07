-- First-party analytics events (Brief 03C.1 §3.6; hucxter-event-taxonomy; ADR-0006). No vendor,
-- no PII: no email, phone, IP, coordinates, message text or raw search text. listing_id has no
-- foreign key so history survives deletion (Founder amendment 2).
--
-- listing_viewed (Founder amendment 4): actor_hash is an HMAC of the member id, or of a random
-- per-day guest id (hx_vid), keyed with a salt derived from the UTC date, so the same person can't
-- be linked across days. One row per (listing, actor, day). Owners' own views are never stored:
-- events_insert() drops a listing_viewed whose viewer is the seller (the viewer id isn't stored).
--
-- Recovery: additive. `drop function public.events_insert(text, uuid, text, uuid, jsonb, smallint,
-- text); drop table public.events;`

create table public.events (
  id bigint generated always as identity primary key,
  name text not null check (name ~ '^[a-z]+(_[a-z]+)*$' and char_length(name) <= 60),
  occurred_at timestamptz not null default now(),
  day date not null default (now() at time zone 'utc')::date,
  schema_version smallint not null,
  consent_version text not null check (char_length(consent_version) <= 40),
  listing_id uuid,
  actor_hash text check (actor_hash is null or actor_hash ~ '^[0-9a-f]{64}$'),
  props jsonb not null default '{}'::jsonb check (
    jsonb_typeof(props) = 'object' and pg_column_size(props) < 2048
  )
);

create index events_name_idx on public.events (name, occurred_at desc);
create index events_listing_idx on public.events (listing_id, name) where listing_id is not null;
create unique index events_listing_viewed_once_idx on public.events (listing_id, actor_hash, day)
  where name = 'listing_viewed';

alter table public.events enable row level security;
revoke all on public.events from anon, authenticated, service_role;
grant select on public.events to service_role;

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
  insert into public.events (name, listing_id, actor_hash, props, schema_version, consent_version)
  values (p_name, p_listing_id, p_actor_hash, coalesce(p_props, '{}'::jsonb), p_schema_version, p_consent_version)
  on conflict do nothing;
end;
$$;

revoke execute on function public.events_insert(text, uuid, text, uuid, jsonb, smallint, text)
  from public, anon, authenticated;
grant execute on function public.events_insert(text, uuid, text, uuid, jsonb, smallint, text)
  to service_role;
