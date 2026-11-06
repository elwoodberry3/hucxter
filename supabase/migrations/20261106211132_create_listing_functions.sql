-- Listing functions (Brief 03C.1 §3.1–3.6). Every function: `set search_path = ''`, EXECUTE
-- revoked from public, then granted to exactly the roles listed at the bottom.
--
-- Discovery (anon + authenticated; definer so callers never touch the point columns):
--   listings_nearby  — the storefront/search feed (geo skill reference query). Radius must be one
--                      of the UI's options (1, 5, 10, 25, 50, 100 mi; Founder amendment 3) and is
--                      never more than 160,934 m. Viewer point = the viewer ZIP's area point.
--                      Returns distance buckets and area labels only; keyset-paginated, ≤ 50 rows.
--   listing_public   — one listing for /l/[id]: live or sold for everyone, anything but deleted or
--                      removed for its owner. Distance bucket only (null past 100 mi).
--   listing_price_points — price and live-status history for the D-45 price-drop rule.
-- Owner (authenticated; definer so they can write history and check limits):
--   listing_create_draft, media_begin_upload, listing_update_details, listing_publish,
--   listing_set_status, listing_delete, listing_owner_view_count, report_create.
--   Each checks auth.uid() ownership and is_verified_member().
-- Service role (webhooks, cron, admin, account deletion; called through apps/web admin-db):
--   media_upload_created, media_apply_webhook, media_playback, media_sweep_orphans,
--   admin_listing_approve, admin_listing_remove, admin_report_dismiss, account_delete_prepare.
--
-- Recovery: additive. Drop the functions listed in the grant section at the bottom.

-- Radius allowlist (contracts RADIUS_OPTIONS_MI). Anything else is an error, not a clamp.
create or replace function public.radius_meters(p_radius_mi int)
returns double precision
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_radius_mi is null or p_radius_mi not in (1, 5, 10, 25, 50, 100) then
    raise exception 'radius must be one of 1, 5, 10, 25, 50, 100 miles'
      using errcode = 'invalid_parameter_value';
  end if;
  return least(round(p_radius_mi * 1609.344), 160934)::double precision;
end;
$$;

create or replace function public.viewer_area_point(p_zip text)
returns extensions.geography
language sql
stable
security definer
set search_path = ''
as $$
  select pa.point from public.postal_areas pa where pa.zip = p_zip and pa.is_active
$$;

-- ---------------------------------------------------------------------------------------------
-- Discovery
-- ---------------------------------------------------------------------------------------------

/**
 * p_filters (all optional): price_min / price_max (cents), free (bool), conditions (text[]),
 * posted ('24h' | '7d' | '30d' | 'any'), include_pending (bool), attributes (object; equality),
 * sort ('newest' | 'nearest' | 'price_asc' | 'price_desc').
 * p_cursor: the `cursor` of the last row of the previous page ({k, t, id}); null for page one.
 */
create or replace function public.listings_nearby(
  p_zip text,
  p_radius_mi int,
  p_department text default null,
  p_subcategory text default null,
  p_query text default null,
  p_filters jsonb default '{}'::jsonb,
  p_cursor jsonb default null,
  p_limit int default 24
)
returns table (
  id uuid,
  title text,
  price_cents integer,
  condition text,
  status public.listing_status,
  distance_bucket text,
  area_label text,
  state text,
  published_at timestamptz,
  category_slug text,
  department_slug text,
  media_id uuid,
  cursor jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_radius double precision := public.radius_meters(p_radius_mi);
  v_point extensions.geography := public.viewer_area_point(p_zip);
  v_filters jsonb := coalesce(p_filters, '{}'::jsonb);
  v_sort text := coalesce(v_filters ->> 'sort', 'newest');
  v_posted interval := case v_filters ->> 'posted'
    when '24h' then interval '24 hours' when '7d' then interval '7 days'
    when '30d' then interval '30 days' else null end;
  v_query text := nullif(btrim(left(coalesce(p_query, ''), 100)), '');
  v_conditions text[];
  v_ck numeric := (p_cursor ->> 'k')::numeric;
  v_ct timestamptz := (p_cursor ->> 't')::timestamptz;
  v_cid uuid := (p_cursor ->> 'id')::uuid;
begin
  if v_point is null then
    raise exception 'unknown ZIP' using errcode = 'invalid_parameter_value';
  end if;
  if v_sort not in ('newest', 'nearest', 'price_asc', 'price_desc') then
    raise exception 'unknown sort' using errcode = 'invalid_parameter_value';
  end if;
  if jsonb_typeof(v_filters -> 'conditions') = 'array' then
    select array_agg(value) into v_conditions from jsonb_array_elements_text(v_filters -> 'conditions');
  end if;

  return query
  with candidates as (
    select
      l.id, l.title, l.price_cents, l.condition, l.status, l.area_label, l.state, l.published_at,
      c.slug as category_slug, d.slug as department_slug, m.id as media_id,
      extensions.st_distance(l.display_point, v_point) as meters
    from public.listings l
    join public.categories c on c.id = l.category_id
    join public.categories d on d.id = c.parent_id
    join public.listing_media m on m.listing_id = l.id and m.status = 'ready'
    where l.status in ('available', 'pending')
      and (l.status = 'available' or coalesce((v_filters ->> 'include_pending')::boolean, false))
      and l.review_state = 'ok' and l.deleted_at is null and l.removed_at is null
      and extensions.st_dwithin(l.display_point, v_point, v_radius)
      and (p_department is null or d.slug = p_department)
      and (p_subcategory is null or c.slug = p_subcategory)
      and (v_query is null or l.search @@ websearch_to_tsquery('english'::regconfig, v_query))
      and (v_filters ->> 'price_min' is null or l.price_cents >= (v_filters ->> 'price_min')::int)
      and (v_filters ->> 'price_max' is null or l.price_cents <= (v_filters ->> 'price_max')::int)
      and (not coalesce((v_filters ->> 'free')::boolean, false) or l.price_cents = 0)
      and (v_conditions is null or l.condition = any (v_conditions))
      and (v_posted is null or l.published_at > now() - v_posted)
      and (jsonb_typeof(v_filters -> 'attributes') is distinct from 'object'
           or l.attributes @> (v_filters -> 'attributes'))
  ),
  keyed as (
    select cd.*,
      case v_sort
        when 'price_asc' then cd.price_cents::numeric
        when 'price_desc' then -cd.price_cents::numeric
        when 'nearest' then (case
          when cd.meters < 1609.34 then 0 when cd.meters < 8046.72 then 1
          when cd.meters < 16093.4 then 2 when cd.meters < 40233.5 then 3
          when cd.meters < 80467.2 then 4 else 5 end)::numeric
        else 0::numeric
      end as k
    from candidates cd
  )
  select kd.id, kd.title, kd.price_cents, kd.condition, kd.status,
    public.distance_bucket(kd.meters), kd.area_label, kd.state, kd.published_at,
    kd.category_slug, kd.department_slug, kd.media_id,
    jsonb_build_object('k', kd.k, 't', kd.published_at, 'id', kd.id)
  from keyed kd
  where p_cursor is null
    or kd.k > v_ck
    or (kd.k = v_ck and (kd.published_at, kd.id) < (v_ct, v_cid))
  order by kd.k, kd.published_at desc, kd.id desc
  limit least(greatest(coalesce(p_limit, 24), 1), 50);
end;
$$;

-- Visible to buyers: live, or sold (stays visible with the Sold badge, §3.4).
create or replace function public.listing_publicly_visible(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.listings l
    where l.id = p_id and l.status in ('available', 'pending', 'sold') and l.review_state = 'ok'
      and l.deleted_at is null and l.removed_at is null
  )
$$;

create or replace function public.listing_public(p_id uuid, p_viewer_zip text)
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
  pickup_zip text
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
    case when l.seller_id = auth.uid() then l.pickup_zip end
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

-- Price and live-status history for D-45 (no personal data). Same visibility as listing_public.
create or replace function public.listing_price_points(p_id uuid)
returns table (kind text, at timestamptz, price_cents integer, live boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select 'price', ph.effective_from, ph.price_cents, null::boolean
  from public.listing_price_history ph
  where ph.listing_id = p_id
    and (public.listing_publicly_visible(p_id)
         or exists (select 1 from public.listings l where l.id = p_id and l.seller_id = auth.uid()))
  union all
  select 'status', sh.changed_at, null::integer, sh.live
  from public.listing_status_history sh
  where sh.listing_id = p_id
    and (public.listing_publicly_visible(p_id)
         or exists (select 1 from public.listings l where l.id = p_id and l.seller_id = auth.uid()))
  order by 2, 1
$$;

-- ---------------------------------------------------------------------------------------------
-- Owner actions
-- ---------------------------------------------------------------------------------------------

create or replace function public.assert_verified_member()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not public.is_verified_member(v_uid) then
    raise exception 'verified member required' using errcode = 'insufficient_privilege';
  end if;
  return v_uid;
end;
$$;

create or replace function public.assert_own_listing(p_id uuid)
returns public.listings
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_row public.listings;
begin
  select * into v_row from public.listings l
  where l.id = p_id and l.seller_id = public.assert_verified_member()
    and l.deleted_at is null and l.removed_at is null;
  if not found then
    raise exception 'listing not found' using errcode = 'no_data_found';
  end if;
  return v_row;
end;
$$;

-- Returns {listing_id} or {retry_after}.
create or replace function public.listing_create_draft()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.assert_verified_member();
  v_retry int := public.action_limit_take(v_uid, 'listing_create');
  v_id uuid;
begin
  if v_retry > 0 then
    return jsonb_build_object('retry_after', v_retry);
  end if;
  insert into public.listings (seller_id, pickup_zip)
  select v_uid, p.home_zip from public.profiles p where p.id = v_uid
  returning id into v_id;
  return jsonb_build_object('listing_id', v_id);
end;
$$;

-- Starts a (re)upload for a draft: returns {media_id} or {retry_after}. A previous video is
-- removed and its Mux asset (or pending upload) queued for deletion.
create or replace function public.media_begin_upload(p_listing_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_listing public.listings := public.assert_own_listing(p_listing_id);
  v_retry int;
  v_old public.listing_media;
  v_id uuid;
begin
  if v_listing.status <> 'draft' then
    raise exception 'the video can only be changed on a draft' using errcode = 'check_violation';
  end if;
  v_retry := public.action_limit_take(v_listing.seller_id, 'upload_create');
  if v_retry > 0 then
    return jsonb_build_object('retry_after', v_retry);
  end if;
  select * into v_old from public.listing_media where listing_id = p_listing_id;
  if found then
    if v_old.mux_asset_id is not null then
      perform public.jobs_enqueue('mux_delete_asset', jsonb_build_object('asset_id', v_old.mux_asset_id));
    elsif v_old.mux_upload_id is not null then
      perform public.jobs_enqueue('mux_cancel_upload', jsonb_build_object('upload_id', v_old.mux_upload_id));
    end if;
    delete from public.listing_media where id = v_old.id;
  end if;
  insert into public.listing_media (owner_id, listing_id) values (v_listing.seller_id, p_listing_id)
  returning id into v_id;
  return jsonb_build_object('media_id', v_id);
end;
$$;

/**
 * Saves the details step (draft) or an edit (live). The category must be an active subcategory;
 * a free-only department (Free Stuff) forces $0. Attributes are validated against the category's
 * schema by apps/web (contracts listingAttributesSchema) before this is called.
 */
create or replace function public.listing_update_details(
  p_id uuid,
  p_title text,
  p_category_slug text,
  p_condition text,
  p_price_cents integer,
  p_attributes jsonb,
  p_description text,
  p_pickup_zip text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_listing public.listings := public.assert_own_listing(p_id);
  v_category uuid;
  v_free_only boolean;
begin
  if v_listing.status = 'sold' then
    raise exception 'sold listings can''t be edited' using errcode = 'check_violation';
  end if;
  select c.id, coalesce((d.attributes ->> 'free_only')::boolean, false)
  into v_category, v_free_only
  from public.categories c join public.categories d on d.id = c.parent_id
  where c.slug = p_category_slug and c.is_active and d.is_active;
  if v_category is null then
    raise exception 'unknown category' using errcode = 'invalid_parameter_value';
  end if;
  if v_free_only and p_price_cents <> 0 then
    raise exception 'free stuff is $0' using errcode = 'check_violation';
  end if;
  update public.listings set
    title = p_title,
    category_id = v_category,
    condition = p_condition,
    price_cents = p_price_cents,
    attributes = coalesce(p_attributes, '{}'::jsonb),
    description = coalesce(p_description, ''),
    pickup_zip = p_pickup_zip
  where id = p_id;
end;
$$;

/**
 * Publishes a complete draft. Media ready → live now ('published', or 'in_review' when the
 * prohibited-item check matched). Media still processing and p_when_ready → 'scheduled': the
 * ready webhook publishes it. Otherwise 'not_ready'.
 */
create or replace function public.listing_publish(p_id uuid, p_needs_review boolean, p_when_ready boolean)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_listing public.listings := public.assert_own_listing(p_id);
  v_media public.media_status;
  v_review public.listing_review_state :=
    case when p_needs_review then 'needs_review'::public.listing_review_state else 'ok' end;
begin
  if v_listing.status <> 'draft' then
    raise exception 'already published' using errcode = 'check_violation';
  end if;
  if v_listing.title is null or v_listing.category_id is null or v_listing.price_cents is null
    or v_listing.condition is null or v_listing.pickup_zip is null then
    raise exception 'details missing' using errcode = 'check_violation';
  end if;
  select status into v_media from public.listing_media where listing_id = p_id;
  if v_media = 'ready' then
    update public.listings
    set status = 'available', review_state = v_review, published_at = now(), publish_when_ready = false
    where id = p_id;
    return case when p_needs_review then 'in_review' else 'published' end;
  end if;
  if v_media in ('awaiting_upload', 'processing') and p_when_ready then
    update public.listings set publish_when_ready = true, review_state = v_review where id = p_id;
    return 'scheduled';
  end if;
  return 'not_ready';
end;
$$;

-- Available → Pending ("someone's on the way") → Available ("They didn't show") → Sold.
create or replace function public.listing_set_status(p_id uuid, p_status public.listing_status)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_listing public.listings := public.assert_own_listing(p_id);
begin
  if not (
    (v_listing.status = 'available' and p_status in ('pending', 'sold'))
    or (v_listing.status = 'pending' and p_status in ('available', 'sold'))
  ) then
    raise exception 'illegal status change % -> %', v_listing.status, p_status
      using errcode = 'check_violation';
  end if;
  update public.listings set status = p_status where id = p_id;
end;
$$;

-- Soft delete; the video is removed and its Mux asset (or pending upload) queued for deletion.
create or replace function public.listing_delete(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_listing public.listings := public.assert_own_listing(p_id);
  v_media public.listing_media;
begin
  update public.listings set deleted_at = now() where id = v_listing.id;
  select * into v_media from public.listing_media where listing_id = p_id;
  if found then
    if v_media.mux_asset_id is not null then
      perform public.jobs_enqueue('mux_delete_asset', jsonb_build_object('asset_id', v_media.mux_asset_id));
    elsif v_media.mux_upload_id is not null then
      perform public.jobs_enqueue('mux_cancel_upload', jsonb_build_object('upload_id', v_media.mux_upload_id));
    end if;
    if v_media.status <> 'removed' then
      update public.listing_media set status = 'removed' where id = v_media.id;
    end if;
  end if;
end;
$$;

-- Owner-only: real listing views (deduplicated per viewer per day; owners' own views excluded).
create or replace function public.listing_owner_view_count(p_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select count(*) from public.events e
  where e.name = 'listing_viewed' and e.listing_id = p_id
    and exists (select 1 from public.listings l where l.id = p_id and l.seller_id = auth.uid())
$$;

-- Returns 'created', 'duplicate', 'not_found' or 'retry_after:<seconds>'.
create or replace function public.report_create(
  p_target_type public.report_target,
  p_target_id uuid,
  p_reason public.report_reason,
  p_note text
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.assert_verified_member();
  v_retry int;
begin
  if p_target_type = 'listing' and not public.listing_publicly_visible(p_target_id) then
    return 'not_found';
  end if;
  if p_target_type = 'profile' and not exists (
    select 1 from public.profiles p where p.id = p_target_id and p.deleted_at is null
  ) then
    return 'not_found';
  end if;
  if exists (
    select 1 from public.reports r
    where r.reporter_id = v_uid and r.target_type = p_target_type and r.target_id = p_target_id
      and r.status = 'open'
  ) then
    return 'duplicate';
  end if;
  v_retry := public.action_limit_take(v_uid, 'report_create');
  if v_retry > 0 then
    return 'retry_after:' || v_retry::text;
  end if;
  insert into public.reports (reporter_id, target_type, target_id, reason, note)
  values (v_uid, p_target_type, p_target_id, p_reason, nullif(btrim(p_note), ''));
  return 'created';
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Service role: Mux webhooks, playback, sweeps
-- ---------------------------------------------------------------------------------------------

create or replace function public.media_upload_created(p_media_id uuid, p_upload_id text)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.listing_media set mux_upload_id = p_upload_id
  where id = p_media_id and status = 'awaiting_upload' and mux_upload_id is null;
$$;

/**
 * Applies one verified Mux webhook event, idempotently (event id). p_media_id is the upload's
 * passthrough (our media id). Returns 'duplicate', 'ignored', or the new media status. Over-long
 * videos (MEDIA_MAX_SECONDS) become errored ('too_long') and their asset is queued for deletion.
 * A listing waiting with "Publish when ready" goes live when its video is ready.
 */
create or replace function public.media_apply_webhook(
  p_event_id text,
  p_type text,
  p_media_id uuid,
  p_upload_id text,
  p_asset_id text,
  p_playback_id text,
  p_duration_s numeric,
  p_max_seconds int
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_media public.listing_media;
  v_listing public.listings;
begin
  insert into public.mux_webhook_events (event_id, type) values (p_event_id, p_type)
  on conflict (event_id) do nothing;
  if not found then
    return 'duplicate';
  end if;

  select * into v_media from public.listing_media m
  where (p_media_id is not null and m.id = p_media_id)
     or (p_asset_id is not null and m.mux_asset_id = p_asset_id)
     or (p_upload_id is not null and m.mux_upload_id = p_upload_id)
  limit 1
  for update;

  if not found then
    -- Not ours (any more): make sure a stray asset doesn't linger.
    if p_type = 'video.asset.ready' and p_asset_id is not null then
      perform public.jobs_enqueue('mux_delete_asset', jsonb_build_object('asset_id', p_asset_id));
    end if;
    return 'ignored';
  end if;

  if v_media.status = 'removed' then
    if p_asset_id is not null and p_type in ('video.upload.asset_created', 'video.asset.ready') then
      perform public.jobs_enqueue('mux_delete_asset', jsonb_build_object('asset_id', p_asset_id));
    end if;
    return 'ignored';
  end if;

  if p_type = 'video.upload.asset_created' and v_media.status = 'awaiting_upload' then
    update public.listing_media
    set mux_asset_id = p_asset_id, status = 'processing'
    where id = v_media.id;
    return 'processing';
  end if;

  if p_type = 'video.asset.ready' and v_media.status in ('awaiting_upload', 'processing') then
    if p_duration_s is null or p_duration_s > p_max_seconds then
      update public.listing_media
      set mux_asset_id = coalesce(p_asset_id, mux_asset_id), duration_s = p_duration_s,
          status = 'errored', error_code = 'too_long'
      where id = v_media.id;
      perform public.jobs_enqueue('mux_delete_asset', jsonb_build_object('asset_id', coalesce(p_asset_id, v_media.mux_asset_id)));
      return 'errored';
    end if;
    update public.listing_media
    set mux_asset_id = coalesce(p_asset_id, mux_asset_id), mux_playback_id = p_playback_id,
        duration_s = p_duration_s, status = 'ready'
    where id = v_media.id;
    select * into v_listing from public.listings where id = v_media.listing_id for update;
    if v_listing.status = 'draft' and v_listing.publish_when_ready and v_listing.deleted_at is null
      and v_listing.removed_at is null and v_listing.title is not null
      and v_listing.category_id is not null and v_listing.price_cents is not null
      and v_listing.condition is not null and v_listing.pickup_zip is not null then
      update public.listings
      set status = 'available', published_at = now(), publish_when_ready = false
      where id = v_listing.id;
    end if;
    return 'ready';
  end if;

  if p_type in ('video.asset.errored', 'video.upload.errored', 'video.upload.cancelled')
    and v_media.status in ('awaiting_upload', 'processing') then
    update public.listing_media
    set status = 'errored', error_code = case p_type
      when 'video.asset.errored' then 'mux_errored'
      when 'video.upload.errored' then 'upload_errored'
      else 'upload_cancelled' end
    where id = v_media.id;
    return 'errored';
  end if;

  return 'ignored';
end;
$$;

-- The playback id for a ready video whose listing is visible to the viewer (checked by the caller
-- through listing_public). Null otherwise: no token for removed or errored media.
create or replace function public.media_playback(p_media_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.mux_playback_id from public.listing_media m
  join public.listings l on l.id = m.listing_id
  where m.id = p_media_id and m.status = 'ready' and l.deleted_at is null and l.removed_at is null
$$;

-- Uploads never finished after 24 h: errored, and the Mux upload cancelled.
create or replace function public.media_sweep_orphans()
returns int
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_count int := 0;
  v_row record;
begin
  for v_row in
    select id, mux_upload_id from public.listing_media
    where status = 'awaiting_upload' and created_at < now() - interval '24 hours'
    for update skip locked
  loop
    update public.listing_media set status = 'errored', error_code = 'upload_abandoned' where id = v_row.id;
    if v_row.mux_upload_id is not null then
      perform public.jobs_enqueue('mux_cancel_upload', jsonb_build_object('upload_id', v_row.mux_upload_id));
    end if;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Service role: admin moderation (every action in audit_log)
-- ---------------------------------------------------------------------------------------------

create or replace function public.assert_staff(p_actor uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.app_roles r where r.user_id = p_actor and r.role in ('moderator', 'admin')
  ) then
    raise exception 'staff only' using errcode = 'insufficient_privilege';
  end if;
end;
$$;

-- Approves a listing held for review; open reports about it stay open.
create or replace function public.admin_listing_approve(p_actor uuid, p_listing_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform public.assert_staff(p_actor);
  update public.listings set review_state = 'ok'
  where id = p_listing_id and review_state = 'needs_review' and deleted_at is null and removed_at is null;
  if not found then
    raise exception 'nothing to approve' using errcode = 'no_data_found';
  end if;
  insert into public.audit_log (actor_id, action, target_type, target_id)
  values (p_actor, 'listing.approved', 'listing', p_listing_id);
end;
$$;

-- Removes a listing: hidden at once, playback revoked (Mux playback id deleted by a job), open
-- reports about it marked actioned.
create or replace function public.admin_listing_remove(p_actor uuid, p_listing_id uuid, p_reason text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_media public.listing_media;
begin
  perform public.assert_staff(p_actor);
  update public.listings set removed_at = now()
  where id = p_listing_id and removed_at is null and deleted_at is null;
  if not found then
    raise exception 'nothing to remove' using errcode = 'no_data_found';
  end if;
  select * into v_media from public.listing_media where listing_id = p_listing_id for update;
  if found then
    if v_media.mux_asset_id is not null and v_media.mux_playback_id is not null then
      perform public.jobs_enqueue('mux_delete_playback_id', jsonb_build_object(
        'asset_id', v_media.mux_asset_id, 'playback_id', v_media.mux_playback_id));
    end if;
    if v_media.status <> 'removed' then
      update public.listing_media set status = 'removed' where id = v_media.id;
    end if;
  end if;
  update public.reports set status = 'actioned', resolved_by = p_actor, resolved_at = now()
  where target_type = 'listing' and target_id = p_listing_id and status = 'open';
  insert into public.audit_log (actor_id, action, target_type, target_id, reason)
  values (p_actor, 'listing.removed', 'listing', p_listing_id, nullif(left(btrim(coalesce(p_reason, '')), 500), ''));
end;
$$;

create or replace function public.admin_report_dismiss(p_actor uuid, p_report_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform public.assert_staff(p_actor);
  update public.reports set status = 'dismissed', resolved_by = p_actor, resolved_at = now()
  where id = p_report_id and status = 'open';
  if not found then
    raise exception 'nothing to dismiss' using errcode = 'no_data_found';
  end if;
  insert into public.audit_log (actor_id, action, target_type, target_id)
  values (p_actor, 'report.dismissed', 'report', p_report_id);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Service role: account deletion, step 1 of 2 (Founder amendment 2). In one transaction: the
-- audit row, then a delete-playback-id job and a delete-asset job for every video (payloads hold
-- the Mux ids, so they survive the cascade), and cancel jobs for unfinished uploads. apps/web
-- then calls auth.admin.deleteUser, which cascades listings and media away.
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
  return v_jobs;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------------------------

revoke execute on function public.radius_meters(int) from public;
revoke execute on function public.viewer_area_point(text) from public, anon, authenticated;
revoke execute on function public.listings_nearby(text, int, text, text, text, jsonb, jsonb, int) from public;
revoke execute on function public.listing_publicly_visible(uuid) from public, anon, authenticated;
revoke execute on function public.listing_public(uuid, text) from public;
revoke execute on function public.listing_price_points(uuid) from public;
revoke execute on function public.assert_verified_member() from public, anon, authenticated;
revoke execute on function public.assert_own_listing(uuid) from public, anon, authenticated;
revoke execute on function public.listing_create_draft() from public, anon;
revoke execute on function public.media_begin_upload(uuid) from public, anon;
revoke execute on function public.listing_update_details(uuid, text, text, text, integer, jsonb, text, text) from public, anon;
revoke execute on function public.listing_publish(uuid, boolean, boolean) from public, anon;
revoke execute on function public.listing_set_status(uuid, public.listing_status) from public, anon;
revoke execute on function public.listing_delete(uuid) from public, anon;
revoke execute on function public.listing_owner_view_count(uuid) from public, anon;
revoke execute on function public.report_create(public.report_target, uuid, public.report_reason, text) from public, anon;
revoke execute on function public.media_upload_created(uuid, text) from public, anon, authenticated;
revoke execute on function public.media_apply_webhook(text, text, uuid, text, text, text, numeric, int) from public, anon, authenticated;
revoke execute on function public.media_playback(uuid) from public, anon, authenticated;
revoke execute on function public.media_sweep_orphans() from public, anon, authenticated;
revoke execute on function public.assert_staff(uuid) from public, anon, authenticated;
revoke execute on function public.admin_listing_approve(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.admin_listing_remove(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.admin_report_dismiss(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.account_delete_prepare(uuid) from public, anon, authenticated;

grant execute on function public.radius_meters(int) to anon, authenticated, service_role;
grant execute on function public.listings_nearby(text, int, text, text, text, jsonb, jsonb, int) to anon, authenticated, service_role;
grant execute on function public.listing_public(uuid, text) to anon, authenticated, service_role;
grant execute on function public.listing_price_points(uuid) to anon, authenticated, service_role;
grant execute on function public.listing_create_draft() to authenticated;
grant execute on function public.media_begin_upload(uuid) to authenticated;
grant execute on function public.listing_update_details(uuid, text, text, text, integer, jsonb, text, text) to authenticated;
grant execute on function public.listing_publish(uuid, boolean, boolean) to authenticated;
grant execute on function public.listing_set_status(uuid, public.listing_status) to authenticated;
grant execute on function public.listing_delete(uuid) to authenticated;
grant execute on function public.listing_owner_view_count(uuid) to authenticated;
grant execute on function public.report_create(public.report_target, uuid, public.report_reason, text) to authenticated;
grant execute on function public.media_upload_created(uuid, text) to service_role;
grant execute on function public.media_apply_webhook(text, text, uuid, text, text, text, numeric, int) to service_role;
grant execute on function public.media_playback(uuid) to service_role;
grant execute on function public.media_sweep_orphans() to service_role;
grant execute on function public.admin_listing_approve(uuid, uuid) to service_role;
grant execute on function public.admin_listing_remove(uuid, uuid, text) to service_role;
grant execute on function public.admin_report_dismiss(uuid, uuid) to service_role;
grant execute on function public.account_delete_prepare(uuid) to service_role;
