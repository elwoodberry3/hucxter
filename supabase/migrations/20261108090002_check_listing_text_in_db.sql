-- The prohibited-item decision moves into SQL (Brief 03C.1b H1; PR #10 review M1).
-- * listing_update_details loses p_needs_review: it locks the row (select … for update) and holds a
--   published or scheduled listing for review when listing_text_flagged matches the new text. It
--   still never clears review. Returns the resulting review state.
-- * listing_publish loses p_needs_review and gains p_version (the updated_at the seller reviewed,
--   as text, compared exactly): it locks the row, returns 'changed' when the listing was edited
--   since, and computes review from the locked row's text. An edit and a publish can't race.
-- * media_apply_webhook re-checks the text when "Publish when ready" publishes a scheduled draft.
-- * listings.attributes is capped at 4 KB (CHECK added NOT VALID, validated when no row breaks it).
--
-- Recovery: `alter table public.listings drop constraint listings_attributes_size;` drop the new
-- listing_update_details(uuid, text, text, text, integer, jsonb, text, text) and
-- listing_publish(uuid, boolean, text); re-run listing_update_details (9 arguments) and its grants
-- from 20261106233358_hold_scheduled_drafts_for_review.sql / 20261106222340, listing_publish
-- (uuid, boolean, boolean) and media_apply_webhook from 20261106211132_create_listing_functions.sql.

alter table public.listings
  add constraint listings_attributes_size check (octet_length(attributes::text) <= 4096) not valid;

do $$
declare
  v_over int;
begin
  select count(*) into v_over from public.listings where octet_length(attributes::text) > 4096;
  if v_over = 0 then
    alter table public.listings validate constraint listings_attributes_size;
  else
    raise notice 'listings_attributes_size left NOT VALID: % rows', v_over;
  end if;
end;
$$;

-- The caller's own listing, locked for this transaction (verified member, not deleted or removed).
create or replace function public.lock_own_listing(p_id uuid)
returns public.listings
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.listings;
begin
  select * into v_row from public.listings l
  where l.id = p_id and l.seller_id = public.assert_verified_member()
    and l.deleted_at is null and l.removed_at is null
  for update;
  if not found then
    raise exception 'listing not found' using errcode = 'no_data_found';
  end if;
  return v_row;
end;
$$;

drop function public.listing_update_details(uuid, text, text, text, integer, jsonb, text, text, boolean);

/**
 * Saves the details step (draft) or an edit (live or scheduled). The category must be an active
 * subcategory; a free-only department (Free Stuff) forces $0. Attributes are validated against
 * the category's schema by apps/web before this is called, and capped at 4 KB here. Published and
 * scheduled listings are re-checked for prohibited items; drafts are checked at publish.
 */
create function public.listing_update_details(
  p_id uuid,
  p_title text,
  p_category_slug text,
  p_condition text,
  p_price_cents integer,
  p_attributes jsonb,
  p_description text,
  p_pickup_zip text
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_listing public.listings := public.lock_own_listing(p_id);
  v_category uuid;
  v_free_only boolean;
  v_review public.listing_review_state;
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
    pickup_zip = p_pickup_zip,
    review_state = case
      when (v_listing.status <> 'draft' or v_listing.publish_when_ready)
        and public.listing_text_flagged(p_title, p_description)
        then 'needs_review'::public.listing_review_state
      else review_state
    end
  where id = p_id
  returning review_state into v_review;
  return v_review::text;
end;
$$;

drop function public.listing_publish(uuid, boolean, boolean);

/**
 * Publishes a complete draft, if it is still the version the seller reviewed (p_version is the
 * updated_at text they were shown; otherwise 'changed'). Media ready → live now ('published', or
 * 'in_review' when the prohibited-item check matches). Media still processing and p_when_ready →
 * 'scheduled': the ready webhook publishes it. Otherwise 'not_ready'.
 */
create function public.listing_publish(p_id uuid, p_when_ready boolean, p_version text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_listing public.listings := public.lock_own_listing(p_id);
  v_media public.media_status;
  v_flagged boolean;
  v_review public.listing_review_state;
  v_version timestamptz;
begin
  if v_listing.status <> 'draft' then
    raise exception 'already published' using errcode = 'check_violation';
  end if;
  begin
    v_version := p_version::timestamptz;
  exception when others then
    raise exception 'invalid version' using errcode = 'invalid_parameter_value';
  end;
  if v_version is null or v_listing.updated_at <> v_version then
    return 'changed';
  end if;
  if v_listing.title is null or v_listing.category_id is null or v_listing.price_cents is null
    or v_listing.condition is null or v_listing.pickup_zip is null then
    raise exception 'details missing' using errcode = 'check_violation';
  end if;
  v_flagged := public.listing_text_flagged(v_listing.title, v_listing.description);
  v_review := case when v_flagged then 'needs_review'::public.listing_review_state
                   else v_listing.review_state end;
  select status into v_media from public.listing_media where listing_id = p_id;
  if v_media = 'ready' then
    update public.listings
    set status = 'available', review_state = v_review, published_at = now(), publish_when_ready = false
    where id = p_id;
    return case when v_review = 'needs_review' then 'in_review' else 'published' end;
  end if;
  if v_media in ('awaiting_upload', 'processing') and p_when_ready then
    update public.listings set publish_when_ready = true, review_state = v_review where id = p_id;
    return 'scheduled';
  end if;
  return 'not_ready';
end;
$$;

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
      -- Re-check the text as it is now (Brief 03C.1b H1): edits after scheduling can't go live.
      update public.listings
      set status = 'available', published_at = now(), publish_when_ready = false,
          review_state = case
            when public.listing_text_flagged(v_listing.title, v_listing.description)
              then 'needs_review'::public.listing_review_state
            else review_state
          end
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

revoke execute on function public.lock_own_listing(uuid) from public, anon, authenticated;
revoke execute on function public.listing_update_details(uuid, text, text, text, integer, jsonb, text, text) from public, anon;
revoke execute on function public.listing_publish(uuid, boolean, text) from public, anon;
grant execute on function public.listing_update_details(uuid, text, text, text, integer, jsonb, text, text) to authenticated;
grant execute on function public.listing_publish(uuid, boolean, text) to authenticated;
