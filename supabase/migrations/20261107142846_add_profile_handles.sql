-- Public @handles (Brief 03C.2 §4.1, D-42 decided 2026-11-07). Every member with a display name
-- gets a unique handle: generated from the display name when it is first set (trigger), and
-- for existing members by the data migration at the end of this file. Rules mirror
-- packages/contracts/src/handle.ts (a unit test keeps the reserved lists in sync):
--   3–24 of [a-z0-9_.], no leading/trailing dot or "..", at least one letter, not reserved, and
--   none of the blocked terms (hucxter, admin, support, official) anywhere.
-- handle_holds keeps released handles unclaimable for 30 days (changes, moderation, account
-- deletion). Members can't write handle, handle_changed_at or name_reset_required_at directly;
-- the definer functions in create_profile_functions do (3C.2).
--
-- Recovery: additive. `drop trigger profiles_assign_handle on public.profiles;
-- drop function public.profiles_assign_handle(); drop function public.handle_generate(text);
-- alter table public.profiles drop column handle, drop column handle_changed_at,
-- drop column name_reset_required_at; drop function public.handle_is_valid(text);
-- drop function public.handle_is_reserved(text); drop table public.handle_holds;`
-- (Keep the unaccent extension; it is harmless.)

create extension if not exists unaccent with schema extensions;

-- Exact reserved handles and blocked terms. Keep in sync with HANDLE_RESERVED / BLOCKED_TERMS.
create or replace function public.handle_is_reserved(p_handle text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_handle = any (array[
    'about', 'account', 'admin', 'administrator', 'api', 'auth', 'billing', 'c', 'contact',
    'discover', 'edit', 'email', 'help', 'home', 'hucxter', 'inbox', 'info', 'l', 'legal',
    'login', 'logout', 'mail', 'me', 'messages', 'mod', 'moderator', 'new', 'null', 'payments',
    'privacy', 'profile', 'root', 'saved', 'search', 'security', 'sell', 'settings', 'shop',
    'signin', 'signup', 'staff', 'store', 'support', 'system', 'team', 'terms', 'u', 'undefined',
    'welcome', 'www'
  ]::text[])
  or p_handle ~ '(hucxter|admin|support|official)';
$$;

create or replace function public.handle_is_valid(p_handle text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_handle ~ '^[a-z0-9_.]{3,24}$'
    and p_handle !~ '(^\.|\.$|\.\.)'
    and p_handle ~ '[a-z]'
    and not public.handle_is_reserved(p_handle);
$$;

revoke execute on function public.handle_is_reserved(text) from public, anon;
revoke execute on function public.handle_is_valid(text) from public, anon;
grant execute on function public.handle_is_reserved(text) to authenticated, service_role;
grant execute on function public.handle_is_valid(text) to authenticated, service_role;

alter table public.profiles
  add column handle text check (handle is null or public.handle_is_valid(handle)),
  add column handle_changed_at timestamptz,
  add column name_reset_required_at timestamptz;

-- Handles are stored lowercase only (the CHECK above allows no capitals), so a plain unique index
-- is case-insensitive.
create unique index profiles_handle_key on public.profiles (handle);

comment on column public.profiles.handle is
  'Public @handle (D-42). Lowercase; written only by trigger and definer functions.';
comment on column public.profiles.name_reset_required_at is
  'Set by staff moderation: the member must choose a new display name and handle before acting.';

-- Released handles: nobody else can claim them until held_until. user_id is the member who may
-- take it back (a handle they changed away from); null means nobody (moderation, deletion).
create table public.handle_holds (
  handle text primary key,
  user_id uuid references auth.users (id) on delete set null,
  held_until timestamptz not null,
  reason text not null check (reason in ('changed', 'moderation', 'account_deleted')),
  created_at timestamptz not null default now()
);

comment on table public.handle_holds is
  'Handles released by a change, moderation or account deletion; unclaimable until held_until.';

alter table public.handle_holds enable row level security;
revoke all on public.handle_holds from anon, authenticated, service_role;
grant select on public.handle_holds to service_role;

-- A free handle for display name p_name: the name's letters and digits (accents folded, max 20),
-- or "member" when that isn't a valid handle; then the same with 2, 4 or 6 random characters.
-- Each candidate is checked under a transaction-scoped advisory lock, so two members generated
-- at the same time can't both take it (the unique index is the final guard).
create or replace function public.handle_generate(p_name text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_base text := left(
    regexp_replace(
      lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(p_name, ''))),
      '[^a-z0-9]', '', 'g'),
    20);
  v_suffix text;
  v_candidate text;
begin
  if not public.handle_is_valid(v_base) then
    v_base := 'member';
  end if;
  for i in 0..30 loop
    v_suffix := case
      when i = 0 then ''
      when i <= 5 then (10 + floor(random() * 90))::int::text
      when i <= 10 then (1000 + floor(random() * 9000))::int::text
      else substr(md5(random()::text), 1, 6)
    end;
    v_candidate := left(v_base, 24 - length(v_suffix)) || v_suffix;
    continue when not public.handle_is_valid(v_candidate);
    perform pg_advisory_xact_lock(hashtextextended('handle:' || v_candidate, 0));
    if not exists (select 1 from public.profiles where handle = v_candidate)
      and not exists (
        select 1 from public.handle_holds where handle = v_candidate and held_until > now()
      ) then
      return v_candidate;
    end if;
  end loop;
  raise exception 'no free handle for this name' using errcode = 'unique_violation';
end;
$$;

revoke execute on function public.handle_generate(text) from public, anon, authenticated;
grant execute on function public.handle_generate(text) to service_role;

-- New display name and no handle yet (onboarding's name step, or an older account): generate one.
create or replace function public.profiles_assign_handle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.handle is null and new.display_name is not null then
    new.handle := public.handle_generate(new.display_name);
  end if;
  return new;
end;
$$;

revoke execute on function public.profiles_assign_handle() from public, anon, authenticated;

create trigger profiles_assign_handle
  before insert or update of display_name on public.profiles
  for each row execute function public.profiles_assign_handle();

-- Data migration: existing local and QA members with a display name get a handle now. One
-- UPDATE per row, so each generation sees the handles assigned before it.
do $$
declare
  v_id uuid;
begin
  for v_id in
    select id from public.profiles
    where display_name is not null and handle is null
    order by created_at, id
  loop
    update public.profiles
    set handle = public.handle_generate(display_name)
    where id = v_id;
  end loop;
end;
$$;
