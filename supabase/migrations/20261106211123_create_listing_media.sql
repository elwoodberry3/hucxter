-- Listing media (Brief 03C.1 §3.2; brief-03 §3C "Mux"; hucxter-video-pipeline). One video per
-- listing. Mux ids are server-only: members can read only id, status and duration of their own
-- media, and nobody outside the service role sees an upload, asset or playback id. Playback tokens
-- are signed by apps/web per request, only for `ready` media the viewer may see.
--
-- States: awaiting_upload → processing → ready | errored; ready/processing/errored → removed
-- (moderation or deletion). Anything else is rejected by trigger.
-- mux_webhook_events makes webhook handling idempotent (Mux may deliver an event more than once).
--
-- Recovery: additive. `drop table public.mux_webhook_events, public.listing_media; drop function
-- public.listing_media_check_transition(); drop type public.media_status;`

create type public.media_status as enum ('awaiting_upload', 'processing', 'ready', 'errored', 'removed');

create table public.listing_media (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  listing_id uuid not null unique references public.listings (id) on delete cascade,
  status public.media_status not null default 'awaiting_upload',
  mux_upload_id text unique check (mux_upload_id is null or char_length(mux_upload_id) <= 200),
  mux_asset_id text unique check (mux_asset_id is null or char_length(mux_asset_id) <= 200),
  mux_playback_id text check (mux_playback_id is null or char_length(mux_playback_id) <= 200),
  duration_s numeric(8, 2) check (duration_s is null or duration_s >= 0),
  -- Short machine reason for errored media (e.g. 'too_long', 'mux_errored'); never Mux's message.
  error_code text check (error_code is null or error_code ~ '^[a-z_]{1,40}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.listing_media is
  'One video per listing. Mux ids are service-role only; owners see id, status, duration.';

create index listing_media_owner_idx on public.listing_media (owner_id);
create index listing_media_status_idx on public.listing_media (status, created_at);

create trigger listing_media_set_updated_at
  before update on public.listing_media
  for each row execute function public.set_updated_at();

create or replace function public.listing_media_check_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = old.status then
    return new;
  end if;
  if (old.status = 'awaiting_upload' and new.status in ('processing', 'errored', 'removed'))
    or (old.status = 'processing' and new.status in ('ready', 'errored', 'removed'))
    or (old.status = 'ready' and new.status = 'removed')
    or (old.status = 'errored' and new.status = 'removed') then
    return new;
  end if;
  raise exception 'illegal media transition % -> %', old.status, new.status
    using errcode = 'check_violation';
end;
$$;

revoke execute on function public.listing_media_check_transition() from public, anon, authenticated;

create trigger listing_media_transition
  before update of status on public.listing_media
  for each row execute function public.listing_media_check_transition();

create table public.mux_webhook_events (
  event_id text primary key check (char_length(event_id) between 1 and 200),
  type text not null check (char_length(type) <= 100),
  received_at timestamptz not null default now()
);

alter table public.listing_media enable row level security;
alter table public.mux_webhook_events enable row level security;

revoke all on public.listing_media, public.mux_webhook_events from anon, authenticated;
grant select (id, listing_id, status, duration_s, created_at) on public.listing_media to authenticated;

create policy listing_media_select_own
  on public.listing_media
  for select
  to authenticated
  using (owner_id = (select auth.uid()));
