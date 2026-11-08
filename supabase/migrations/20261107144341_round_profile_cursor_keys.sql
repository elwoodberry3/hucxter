-- Keyset cursors (Brief 03C.2): the time sort key was epoch seconds with microseconds (16
-- significant digits), which a JavaScript number can't round-trip, so "Load more" could repeat a
-- row. Keys are now whole epoch milliseconds; ties still break on id. Same signatures and grants.
--
-- Recovery: re-run the two function bodies from 20261107143332_create_saved_listings.sql and
-- 20261107143553_create_profile_functions.sql.

create or replace function public.my_saved_listings(
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
  published_at timestamptz,
  category_slug text,
  saved_at timestamptz,
  cursor jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_sort text := coalesce(p_sort, 'newest');
  v_ck numeric := (p_cursor ->> 'k')::numeric;
  v_cid uuid := (p_cursor ->> 'id')::uuid;
begin
  if v_uid is null then
    raise exception 'sign in required' using errcode = 'insufficient_privilege';
  end if;
  if v_sort not in ('newest', 'oldest', 'price_asc', 'price_desc') then
    raise exception 'unknown sort' using errcode = 'invalid_parameter_value';
  end if;
  return query
  with keyed as (
    select l.id, l.title, l.price_cents, l.condition, l.status, l.published_at,
      c.slug as category_slug, s.created_at as saved_at,
      case v_sort
        when 'oldest' then floor(extract(epoch from s.created_at) * 1000)
        when 'price_asc' then l.price_cents::numeric
        when 'price_desc' then -l.price_cents::numeric
        else -floor(extract(epoch from s.created_at) * 1000)
      end as k
    from public.saved_listings s
    join public.listings l on l.id = s.listing_id
    join public.categories c on c.id = l.category_id
    join public.listing_media m on m.listing_id = l.id and m.status = 'ready'
    where s.user_id = v_uid and l.status in ('available', 'pending') and l.review_state = 'ok'
      and l.deleted_at is null and l.removed_at is null
  )
  select kd.id, kd.title, kd.price_cents, kd.condition, kd.status, kd.published_at,
    kd.category_slug, kd.saved_at, jsonb_build_object('k', kd.k, 'id', kd.id)
  from keyed kd
  where p_cursor is null or (kd.k, kd.id) > (v_ck, v_cid)
  order by kd.k, kd.id
  limit least(greatest(coalesce(p_limit, 24), 1), 50);
end;
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
