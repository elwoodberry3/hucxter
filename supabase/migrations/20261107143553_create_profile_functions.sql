-- Profile functions (Brief 03C.2 §4.1–4.6; Founder notes and amendments of 2026-11-07).
--
-- Public (anon, authenticated): profile_by_handle, profile_listings. Never return a member id,
-- home ZIP, area or any point.
-- Members (authenticated): handle_status (rate-limited, amendment 4), profile_set_handle (30-day
-- rule, holds), profile_complete_reset (after staff required a new name and handle).
-- Service role: profile_set_avatar, admin_profile_action (every action needs a reason and writes
-- audit_log).
-- Redefined: listing_public (+ seller handle and photo path, so the seller card links to the
-- profile), is_verified_member (false while a name reset is required, so every mutator blocks),
-- account_delete_prepare (+ holds the handle for 30 days, amendment 1, and enqueues the photo
-- delete). jobs.kind gains storage_delete_avatar.
--
-- Recovery: drop the new functions listed in the grant section; re-run the previous definitions
-- of listing_public, is_verified_member and account_delete_prepare from
-- 20261106211132_create_listing_functions.sql / 20261106211121_create_listings.sql (with their
-- grants); restore jobs_kind_check without storage_delete_avatar.

alter table public.jobs drop constraint jobs_kind_check;
alter table public.jobs add constraint jobs_kind_check
  check (kind in ('mux_delete_asset', 'mux_delete_playback_id', 'mux_cancel_upload', 'storage_delete_avatar'));

-- ---------------------------------------------------------------------------------------------
-- Verification: a staff-required name reset blocks every action until it is done.
-- ---------------------------------------------------------------------------------------------

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
      and p.name_reset_required_at is null
  )
$$;

-- ---------------------------------------------------------------------------------------------
-- Public profile
-- ---------------------------------------------------------------------------------------------

create or replace function public.profile_by_handle(p_handle text)
returns table (
  handle text,
  display_name text,
  bio text,
  avatar_path text,
  joined_at timestamptz,
  phone_verified boolean,
  listed_count bigint,
  sold_count bigint,
  is_owner boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.handle, p.display_name, p.bio, p.avatar_path, p.created_at,
    u.phone_confirmed_at is not null,
    (select count(*) from public.listings l
     join public.listing_media m on m.listing_id = l.id and m.status = 'ready'
     where l.seller_id = p.id and l.status in ('available', 'pending') and l.review_state = 'ok'
       and l.deleted_at is null and l.removed_at is null),
    (select count(*) from public.listings l
     where l.seller_id = p.id and l.status = 'sold' and l.review_state = 'ok'
       and l.deleted_at is null and l.removed_at is null),
    coalesce(p.id = auth.uid(), false)
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.handle = lower(btrim(p_handle)) and p.deleted_at is null and p.display_name is not null
$$;

/**
 * Listings on a profile. Everyone: p_filter 'listings' (available + pending) or 'sold'; only live,
 * approved, not removed, video ready. The owner (auth.uid() is the profile) also gets 'all',
 * 'live', 'pending', 'drafts' (including processing) and 'review' (held or removed), plus real
 * view counts. p_sort: 'newest' | 'oldest' | 'price_asc' | 'price_desc'; keyset cursor {k, id}.
 */
create or replace function public.profile_listings(
  p_handle text,
  p_filter text default 'listings',
  p_sort text default 'newest',
  p_cursor jsonb default null,
  p_limit int default 24
)
returns table (
  id uuid,
  title text,
  price_cents integer,
  condition text,
  status public.listing_status,
  review_state public.listing_review_state,
  removed boolean,
  published_at timestamptz,
  updated_at timestamptz,
  category_slug text,
  media_status public.media_status,
  views bigint,
  cursor jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile uuid;
  v_owner boolean;
  v_filter text := coalesce(p_filter, 'listings');
  v_sort text := coalesce(p_sort, 'newest');
  v_ck numeric := (p_cursor ->> 'k')::numeric;
  v_cid uuid := (p_cursor ->> 'id')::uuid;
begin
  select p.id into v_profile from public.profiles p
  where p.handle = lower(btrim(p_handle)) and p.deleted_at is null and p.display_name is not null;
  if v_profile is null then
    return;
  end if;
  -- coalesce: for guests auth.uid() is null, and null must never mean "owner".
  v_owner := coalesce(v_profile = auth.uid(), false);
  if v_sort not in ('newest', 'oldest', 'price_asc', 'price_desc') then
    raise exception 'unknown sort' using errcode = 'invalid_parameter_value';
  end if;
  if not (v_filter in ('listings', 'sold')
          or (v_owner and v_filter in ('all', 'live', 'pending', 'drafts', 'review'))) then
    raise exception 'unknown filter' using errcode = 'invalid_parameter_value';
  end if;
  return query
  with candidates as (
    select l.*, c.slug as category_slug, m.status as media_status
    from public.listings l
    left join public.categories c on c.id = l.category_id
    left join public.listing_media m on m.listing_id = l.id
    where l.seller_id = v_profile and l.deleted_at is null
      and case
        when v_filter = 'listings' and not v_owner then
          l.status in ('available', 'pending') and l.review_state = 'ok' and l.removed_at is null
          and m.status = 'ready'
        when v_filter = 'sold' and not v_owner then
          l.status = 'sold' and l.review_state = 'ok' and l.removed_at is null and m.status = 'ready'
        when v_filter in ('listings', 'all') then true
        when v_filter = 'live' then
          l.status = 'available' and l.review_state = 'ok' and l.removed_at is null
        when v_filter = 'pending' then
          l.status = 'pending' and l.review_state = 'ok' and l.removed_at is null
        when v_filter = 'sold' then l.status = 'sold' and l.removed_at is null
        when v_filter = 'drafts' then l.status = 'draft' and l.removed_at is null
        when v_filter = 'review' then
          l.status <> 'draft' and (l.review_state = 'needs_review' or l.removed_at is not null)
        else false
      end
  ),
  keyed as (
    select cd.*,
      case v_sort
        when 'oldest' then extract(epoch from coalesce(cd.published_at, cd.created_at))
        when 'price_asc' then coalesce(cd.price_cents, 0)::numeric
        when 'price_desc' then -coalesce(cd.price_cents, 0)::numeric
        else -extract(epoch from coalesce(cd.published_at, cd.created_at))
      end as k
    from candidates cd
  )
  select kd.id, kd.title, kd.price_cents, kd.condition, kd.status,
    case when v_owner then kd.review_state else null end,
    case when v_owner then kd.removed_at is not null else false end,
    kd.published_at,
    case when v_owner then kd.updated_at else null end,
    kd.category_slug,
    case when v_owner then kd.media_status else null end,
    case when v_owner then (
      select count(*) from public.events e where e.name = 'listing_viewed' and e.listing_id = kd.id
    ) else null end,
    jsonb_build_object('k', kd.k, 'id', kd.id)
  from keyed kd
  where p_cursor is null or (kd.k, kd.id) > (v_ck, v_cid)
  order by kd.k, kd.id
  limit least(greatest(coalesce(p_limit, 24), 1), 50);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Handles (members)
-- ---------------------------------------------------------------------------------------------

-- Who may check and choose a handle: verified members, and members in a staff-required reset.
create or replace function public.assert_profile_editor()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not (
    public.is_verified_member(v_uid)
    or exists (
      select 1 from public.profiles p
      where p.id = v_uid and p.deleted_at is null and p.name_reset_required_at is not null
    )
  ) then
    raise exception 'verified member required' using errcode = 'insufficient_privilege';
  end if;
  return v_uid;
end;
$$;

-- Why p_handle can't be taken by the caller, or null when it can (no rate limit; internal).
create or replace function public.handle_unavailable_reason(p_uid uuid, p_handle text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.handle_is_reserved(p_handle) then 'reserved'
    when not public.handle_is_valid(p_handle) then 'invalid'
    when exists (select 1 from public.profiles p where p.handle = p_handle and p.id = p_uid) then 'yours'
    when exists (select 1 from public.profiles p where p.handle = p_handle) then 'taken'
    when exists (
      select 1 from public.handle_holds h
      where h.handle = p_handle and h.held_until > now() and h.user_id is distinct from p_uid
    ) then 'held'
    else null
  end
$$;

-- 'available' | 'yours' | 'taken' | 'held' | 'reserved' | 'invalid' | 'limited'.
create or replace function public.handle_status(p_handle text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.assert_profile_editor();
begin
  if public.action_limit_take(v_uid, 'handle_check') > 0 then
    return 'limited';
  end if;
  return coalesce(public.handle_unavailable_reason(v_uid, lower(btrim(left(coalesce(p_handle, ''), 100)))), 'available');
end;
$$;

-- Changes the caller's handle. Returns 'ok', 'too_soon:<iso date>' or why it isn't available.
-- At most once per 30 days; the old handle is held for 30 days (only its owner may take it back).
create or replace function public.profile_set_handle(p_handle text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.assert_verified_member();
  v_handle text := lower(btrim(left(coalesce(p_handle, ''), 100)));
  v_profile public.profiles;
  v_reason text;
begin
  select * into v_profile from public.profiles where id = v_uid for update;
  if v_profile.handle = v_handle then
    return 'ok';
  end if;
  if v_profile.handle_changed_at > now() - interval '30 days' then
    return 'too_soon:' || to_char((v_profile.handle_changed_at + interval '30 days') at time zone 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  end if;
  perform pg_advisory_xact_lock(hashtextextended('handle:' || v_handle, 0));
  v_reason := public.handle_unavailable_reason(v_uid, v_handle);
  if v_reason is not null then
    return v_reason;
  end if;
  if v_profile.handle is not null then
    insert into public.handle_holds (handle, user_id, held_until, reason)
    values (v_profile.handle, v_uid, now() + interval '30 days', 'changed')
    on conflict (handle) do update
      set user_id = excluded.user_id, held_until = excluded.held_until, reason = excluded.reason;
  end if;
  delete from public.handle_holds where handle = v_handle and user_id = v_uid;
  update public.profiles set handle = v_handle, handle_changed_at = now() where id = v_uid;
  return 'ok';
exception
  when unique_violation then
    return 'taken';
end;
$$;

-- After staff required a new name and handle: sets both and ends the reset. Doesn't count toward
-- the 30-day handle rule. Returns 'ok' or why the handle isn't available; a bad display name
-- raises check_violation (the profiles CHECKs).
create or replace function public.profile_complete_reset(p_display_name text, p_handle text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_handle text := lower(btrim(left(coalesce(p_handle, ''), 100)));
  v_reason text;
begin
  if v_uid is null or not exists (
    select 1 from public.profiles p
    where p.id = v_uid and p.deleted_at is null and p.name_reset_required_at is not null
  ) then
    raise exception 'no reset required' using errcode = 'insufficient_privilege';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('handle:' || v_handle, 0));
  v_reason := public.handle_unavailable_reason(v_uid, v_handle);
  if v_reason is not null and v_reason <> 'yours' then
    return v_reason;
  end if;
  update public.profiles
  set display_name = btrim(p_display_name), handle = v_handle, name_reset_required_at = null
  where id = v_uid;
  delete from public.handle_holds where handle = v_handle and user_id = v_uid;
  return 'ok';
exception
  when unique_violation then
    return 'taken';
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Service role: photos and moderation
-- ---------------------------------------------------------------------------------------------

-- Sets (or clears, with null) a member's photo; returns the previous object name to delete.
create or replace function public.profile_set_avatar(p_user_id uuid, p_path text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_old text;
begin
  select avatar_path into v_old from public.profiles
  where id = p_user_id and deleted_at is null
  for update;
  if not found then
    raise exception 'profile not found' using errcode = 'no_data_found';
  end if;
  update public.profiles set avatar_path = p_path where id = p_user_id;
  return v_old;
end;
$$;

/**
 * Staff action on an open profile report. p_action: 'dismiss' | 'remove_photo' | 'clear_bio' |
 * 'require_new_name'. A reason is required for every action and goes to audit_log. Returns the
 * removed photo's object name for 'remove_photo' (the caller deletes the file), otherwise null.
 * 'require_new_name' sets the display name to the "Hucxter member" placeholder, gives a new
 * generated handle, holds the old one for 30 days for nobody, and blocks every action until the
 * member chooses a new name and handle (is_verified_member).
 */
create or replace function public.admin_profile_action(
  p_actor uuid,
  p_report_id uuid,
  p_action text,
  p_reason text
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_reason text := nullif(left(btrim(coalesce(p_reason, '')), 500), '');
  v_report public.reports;
  v_profile public.profiles;
  v_old_path text;
begin
  perform public.assert_staff(p_actor);
  if v_reason is null then
    raise exception 'a reason is required' using errcode = 'invalid_parameter_value';
  end if;
  if p_action not in ('dismiss', 'remove_photo', 'clear_bio', 'require_new_name') then
    raise exception 'unknown action' using errcode = 'invalid_parameter_value';
  end if;
  select * into v_report from public.reports
  where id = p_report_id and target_type = 'profile' and status = 'open'
  for update;
  if not found then
    raise exception 'report not found' using errcode = 'no_data_found';
  end if;

  if p_action = 'dismiss' then
    update public.reports set status = 'dismissed', resolved_by = p_actor, resolved_at = now()
    where id = p_report_id;
    insert into public.audit_log (actor_id, action, target_type, target_id, reason)
    values (p_actor, 'report.dismissed', 'report', p_report_id, v_reason);
    return null;
  end if;

  select * into v_profile from public.profiles
  where id = v_report.target_id and deleted_at is null
  for update;
  if not found then
    raise exception 'profile not found' using errcode = 'no_data_found';
  end if;

  if p_action = 'remove_photo' then
    v_old_path := v_profile.avatar_path;
    update public.profiles set avatar_path = null where id = v_profile.id;
  elsif p_action = 'clear_bio' then
    update public.profiles set bio = '' where id = v_profile.id;
  else
    if v_profile.handle is not null then
      insert into public.handle_holds (handle, user_id, held_until, reason)
      values (v_profile.handle, null, now() + interval '30 days', 'moderation')
      on conflict (handle) do update
        set user_id = null, held_until = greatest(public.handle_holds.held_until, excluded.held_until),
            reason = 'moderation';
    end if;
    update public.profiles
    set display_name = 'Hucxter member', name_reset_required_at = now(),
        handle = public.handle_generate('')
    where id = v_profile.id;
  end if;

  update public.reports set status = 'actioned', resolved_by = p_actor, resolved_at = now()
  where id = p_report_id;
  insert into public.audit_log (actor_id, action, target_type, target_id, reason)
  values (
    p_actor,
    case p_action
      when 'remove_photo' then 'profile.photo_removed'
      when 'clear_bio' then 'profile.bio_cleared'
      else 'profile.name_reset'
    end,
    'user', v_profile.id, v_reason);
  return v_old_path;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Listing page: seller handle and photo for the seller card (otherwise unchanged)
-- ---------------------------------------------------------------------------------------------

drop function public.listing_public(uuid, text);

create function public.listing_public(p_id uuid, p_viewer_zip text)
returns table (
  id uuid,
  is_owner boolean,
  title text,
  description text,
  price_cents integer,
  condition text,
  attributes jsonb,
  status public.listing_status,
  review_state public.listing_review_state,
  published_at timestamptz,
  created_at timestamptz,
  area_label text,
  state text,
  distance_bucket text,
  category_slug text,
  category_name text,
  department_slug text,
  department_name text,
  media_id uuid,
  media_status public.media_status,
  seller_display_name text,
  seller_joined_at timestamptz,
  seller_phone_verified boolean,
  seller_items_sold bigint,
  publish_when_ready boolean,
  pickup_zip text,
  seller_handle text,
  seller_avatar_path text
)
language sql
stable
security definer
set search_path = ''
as $$
  with v as (select public.viewer_area_point(p_viewer_zip) as g)
  select
    l.id,
    l.seller_id = auth.uid(),
    l.title, l.description, l.price_cents, l.condition, l.attributes, l.status, l.review_state,
    l.published_at, l.created_at, l.area_label, l.state,
    case
      when v.g is null or l.display_point is null then null
      when extensions.st_distance(l.display_point, v.g) > 160934 then null
      else public.distance_bucket(extensions.st_distance(l.display_point, v.g))
    end,
    c.slug, c.name, d.slug, d.name,
    m.id, m.status,
    p.display_name, p.created_at, u.phone_confirmed_at is not null,
    (select count(*) from public.listings s
     where s.seller_id = l.seller_id and s.status = 'sold' and s.deleted_at is null and s.removed_at is null),
    -- Owner-only fields (null for everyone else).
    case when l.seller_id = auth.uid() then l.publish_when_ready end,
    case when l.seller_id = auth.uid() then l.pickup_zip end,
    p.handle, p.avatar_path
  from public.listings l
  cross join v
  left join public.categories c on c.id = l.category_id
  left join public.categories d on d.id = c.parent_id
  left join public.listing_media m on m.listing_id = l.id
  join public.profiles p on p.id = l.seller_id
  join auth.users u on u.id = l.seller_id
  where l.id = p_id
    and l.deleted_at is null and l.removed_at is null
    and (
      l.seller_id = auth.uid()
      or (l.status in ('available', 'pending', 'sold') and l.review_state = 'ok'
          and m.status = 'ready')
    )
$$;

-- ---------------------------------------------------------------------------------------------
-- Account deletion, step 1 of 2: also holds the handle for 30 days for nobody (amendment 1) and
-- enqueues the photo delete. Otherwise unchanged from create_listing_functions.
-- ---------------------------------------------------------------------------------------------

create or replace function public.account_delete_prepare(p_user_id uuid)
returns int
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row record;
  v_jobs int := 0;
  v_handle text;
  v_avatar text;
begin
  insert into public.audit_log (actor_id, action, target_type, target_id, reason)
  values (p_user_id, 'account.deleted', 'user', p_user_id, 'self-service');
  for v_row in
    select mux_asset_id, mux_playback_id, mux_upload_id from public.listing_media
    where owner_id = p_user_id
  loop
    if v_row.mux_asset_id is not null and v_row.mux_playback_id is not null then
      perform public.jobs_enqueue('mux_delete_playback_id', jsonb_build_object(
        'asset_id', v_row.mux_asset_id, 'playback_id', v_row.mux_playback_id));
      v_jobs := v_jobs + 1;
    end if;
    if v_row.mux_asset_id is not null then
      perform public.jobs_enqueue('mux_delete_asset', jsonb_build_object('asset_id', v_row.mux_asset_id));
      v_jobs := v_jobs + 1;
    elsif v_row.mux_upload_id is not null then
      perform public.jobs_enqueue('mux_cancel_upload', jsonb_build_object('upload_id', v_row.mux_upload_id));
      v_jobs := v_jobs + 1;
    end if;
  end loop;
  update public.listings set deleted_at = now() where seller_id = p_user_id and deleted_at is null;

  select handle, avatar_path into v_handle, v_avatar from public.profiles where id = p_user_id;
  if v_handle is not null then
    insert into public.handle_holds (handle, user_id, held_until, reason)
    values (v_handle, null, now() + interval '30 days', 'account_deleted')
    on conflict (handle) do update
      set user_id = null, held_until = greatest(public.handle_holds.held_until, excluded.held_until),
          reason = 'account_deleted';
  end if;
  if v_avatar is not null then
    perform public.jobs_enqueue('storage_delete_avatar', jsonb_build_object('path', v_avatar));
    v_jobs := v_jobs + 1;
  end if;
  return v_jobs;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------------------------

revoke execute on function public.profile_by_handle(text) from public;
revoke execute on function public.profile_listings(text, text, text, jsonb, int) from public;
revoke execute on function public.assert_profile_editor() from public, anon, authenticated;
revoke execute on function public.handle_unavailable_reason(uuid, text) from public, anon, authenticated;
revoke execute on function public.handle_status(text) from public, anon;
revoke execute on function public.profile_set_handle(text) from public, anon;
revoke execute on function public.profile_complete_reset(text, text) from public, anon;
revoke execute on function public.profile_set_avatar(uuid, text) from public, anon, authenticated;
revoke execute on function public.admin_profile_action(uuid, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.listing_public(uuid, text) from public;

grant execute on function public.profile_by_handle(text) to anon, authenticated, service_role;
grant execute on function public.profile_listings(text, text, text, jsonb, int) to anon, authenticated, service_role;
grant execute on function public.handle_status(text) to authenticated;
grant execute on function public.profile_set_handle(text) to authenticated;
grant execute on function public.profile_complete_reset(text, text) to authenticated;
grant execute on function public.profile_set_avatar(uuid, text) to service_role;
grant execute on function public.admin_profile_action(uuid, uuid, text, text) to service_role;
grant execute on function public.listing_public(uuid, text) to anon, authenticated, service_role;
