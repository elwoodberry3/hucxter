-- Account deletion and Mux webhook hardening (Brief 03C.1b H4; PR #10 review L1, L2).
-- * account_delete_prepare is idempotent: one account.deleted audit row however often it runs; it
--   marks the member's media removed (so a video that becomes ready before deleteUser is deleted by
--   the webhook, not left in Mux) and clears avatar_path once its delete job is queued, so a retry
--   enqueues nothing twice.
-- * media_apply_webhook applies a video.asset.ready that arrives before video.upload.asset_created
--   (awaiting_upload → processing → ready in one transaction) instead of failing with a 500 until
--   Mux retries. It keeps the 3C.1b H1 re-check for "Publish when ready".
-- Same signatures and grants.
--
-- Recovery: re-run account_delete_prepare from 20261107143553_create_profile_functions.sql and
-- media_apply_webhook from 20261108090002_check_listing_text_in_db.sql.

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
  -- Idempotent (Brief 03C.1b H4): a retry after a failed deleteUser writes no second audit row
  -- and enqueues nothing twice.
  if not exists (
    select 1 from public.audit_log a
    where a.action = 'account.deleted' and a.target_type = 'user' and a.target_id = p_user_id
  ) then
    insert into public.audit_log (actor_id, action, target_type, target_id, reason)
    values (p_user_id, 'account.deleted', 'user', p_user_id, 'self-service');
  end if;
  for v_row in
    select id, mux_asset_id, mux_playback_id, mux_upload_id from public.listing_media
    where owner_id = p_user_id and status <> 'removed'
    for update
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
    -- Removed now, so a video that becomes ready before the user row is gone is deleted by the
    -- webhook (removed media → mux_delete_asset) instead of left behind.
    update public.listing_media set status = 'removed' where id = v_row.id;
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
    update public.profiles set avatar_path = null where id = p_user_id;
  end if;
  return v_jobs;
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
    -- Out of order (Brief 03C.1b H4): Mux can deliver ready before upload.asset_created. Step
    -- through processing (a legal transition) and apply it, instead of failing until a retry.
    if v_media.status = 'awaiting_upload' then
      update public.listing_media
      set mux_asset_id = coalesce(p_asset_id, mux_asset_id), status = 'processing'
      where id = v_media.id;
    end if;
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
