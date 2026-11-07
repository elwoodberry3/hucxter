-- Hardening from the 3C.2 trust-safety review.
-- 1. Blocked terms can't hide behind look-alike letters, fullwidth forms or invisible characters:
--    display names and bios are checked on a folded copy (text_fold: NFKC, lowercase, Cyrillic and
--    Greek look-alikes → Latin, hidden characters removed), and hidden/bidi characters are refused.
--    The two strings and the character class match packages/contracts handle.ts (a unit test
--    keeps them equal).
-- 2. Profiles are public only once onboarding is done (phone verified, 18+, home ZIP):
--    profile_by_handle, profile_listings and report_profile skip anyone else.
-- 3. profile_set_handle and profile_complete_reset take the handle_check limit too (they answer
--    taken/held as well); profile_complete_reset refuses an empty name.
-- 4. A member with a handle always has a display name.
-- New CHECKs are added NOT VALID and validated only when no existing row breaks them (counts
-- only, no names, in the NOTICE).
--
-- Recovery: additive. Drop profiles_display_name_folded, profiles_bio_folded and
-- profiles_handle_has_name; re-run the previous definitions of the four functions (migrations
-- 20261107143553, 20261107144341, 20261107145834); then
-- `drop function public.profile_is_public(uuid), public.text_fold(text), public.has_hidden_chars(text);`

create or replace function public.text_fold(p_value text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select regexp_replace(
    translate(lower(normalize(p_value, NFKC)), 'аеорсухіѕјԁһӏкмтвнԛԝοαρνικτυı', 'aeopcyxisjdhlkmtbhqwoapviktui'),
    '[\u00ad\u034f\u061c\u115f\u1160\u17b4\u17b5\u180b-\u180f\u200b-\u200f\u202a-\u202e\u2060-\u206f\u3164\ufe00-\ufe0f\ufeff]', '', 'g')
$$;

create or replace function public.has_hidden_chars(p_value text)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select p_value ~ '[\u00ad\u034f\u061c\u115f\u1160\u17b4\u17b5\u180b-\u180f\u200b-\u200f\u202a-\u202e\u2060-\u206f\u3164\ufe00-\ufe0f\ufeff]'
$$;

-- Pure helpers. CHECK constraints run them as the writing role, so members (their own profile
-- updates) and the service role need EXECUTE.
revoke execute on function public.text_fold(text) from public, anon;
revoke execute on function public.has_hidden_chars(text) from public, anon;
grant execute on function public.text_fold(text) to authenticated, service_role;
grant execute on function public.has_hidden_chars(text) to authenticated, service_role;

alter table public.profiles
  add constraint profiles_display_name_folded check (
    display_name is null
    or (display_name = 'Hucxter member' and name_reset_required_at is not null)
    or (
      not public.has_hidden_chars(display_name)
      and public.text_fold(display_name) !~ '(hucxter|admin|support|official)'
    )
  ) not valid,
  add constraint profiles_bio_folded check (
    not public.has_hidden_chars(bio)
    and public.text_fold(bio) !~ '(hucxter|admin|support|official)'
  ) not valid,
  add constraint profiles_handle_has_name check (handle is null or display_name is not null)
    not valid;

do $$
declare
  v_name int;
  v_bio int;
  v_nameless int;
begin
  select
    count(*) filter (where display_name is not null
      and not (display_name = 'Hucxter member' and name_reset_required_at is not null)
      and (public.has_hidden_chars(display_name)
        or public.text_fold(display_name) ~ '(hucxter|admin|support|official)')),
    count(*) filter (where public.has_hidden_chars(bio)
      or public.text_fold(bio) ~ '(hucxter|admin|support|official)'),
    count(*) filter (where handle is not null and display_name is null)
  into v_name, v_bio, v_nameless
  from public.profiles;
  if v_name = 0 then
    alter table public.profiles validate constraint profiles_display_name_folded;
  end if;
  if v_bio = 0 then
    alter table public.profiles validate constraint profiles_bio_folded;
  end if;
  if v_nameless = 0 then
    alter table public.profiles validate constraint profiles_handle_has_name;
  end if;
  if v_name + v_bio + v_nameless > 0 then
    raise notice 'profile CHECKs left NOT VALID: % names, % bios, % handles without a name',
      v_name, v_bio, v_nameless;
  end if;
end;
$$;

-- Public profile = onboarding done. Not is_verified_member: a member in a staff-required name
-- reset stays visible (under the placeholder) so reports and moderation still work.
create or replace function public.profile_is_public(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    join auth.users u on u.id = p.id
    where p.id = p_user_id and p.deleted_at is null and p.age_attested_at is not null
      and p.home_zip is not null and u.phone_confirmed_at is not null
  )
$$;

revoke execute on function public.profile_is_public(uuid) from public, anon, authenticated;

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
    and public.profile_is_public(p.id)
$$;

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
  where p.handle = lower(btrim(p_handle)) and p.deleted_at is null and p.display_name is not null
    and public.profile_is_public(p.id);
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
        when 'oldest' then floor(extract(epoch from coalesce(cd.published_at, cd.created_at)) * 1000)
        when 'price_asc' then coalesce(cd.price_cents, 0)::numeric
        when 'price_desc' then -coalesce(cd.price_cents, 0)::numeric
        else -floor(extract(epoch from coalesce(cd.published_at, cd.created_at)) * 1000)
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

create or replace function public.report_profile(
  p_handle text,
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
  v_target uuid;
begin
  select p.id into v_target from public.profiles p
  where p.handle = lower(btrim(p_handle)) and p.deleted_at is null and p.display_name is not null
    and public.profile_is_public(p.id);
  if v_target is null or v_target = v_uid then
    return 'not_found';
  end if;
  return public.report_create('profile', v_target, p_reason, p_note);
end;
$$;

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
  -- Every answer here also tells whether a handle exists: same limit as handle_status.
  if public.action_limit_take(v_uid, 'handle_check') > 0 then
    return 'limited';
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
  if nullif(btrim(coalesce(p_display_name, '')), '') is null then
    raise exception 'display name required' using errcode = 'check_violation';
  end if;
  -- Every answer here also tells whether a handle exists: same limit as handle_status.
  if public.action_limit_take(v_uid, 'handle_check') > 0 then
    return 'limited';
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
