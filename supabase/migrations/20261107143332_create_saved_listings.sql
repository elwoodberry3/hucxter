-- Saves (Brief 03C.2 §4.3): a private list of listings a member saved. Members read their own rows
-- under RLS; every write goes through listing_save() (verified member, live listing that isn't
-- theirs, rate limit). No public save counts exist anywhere.
-- Also adds the 3C.2 action limits (Chair defaults, Founder to tune):
--   listing_save  200/day (50 for accounts younger than 7 days)
--   avatar_upload 10/day (5)
--   handle_check  60 per 10 minutes (same for new accounts; Founder amendment 4)
--
-- Recovery: additive. `drop function public.my_saved_listings(text, jsonb, int);
-- drop function public.listing_save(uuid, boolean); drop table public.saved_listings;
-- delete from public.action_attempts where action in ('listing_save', 'avatar_upload', 'handle_check');
-- delete from public.action_limit_config where action in ('listing_save', 'avatar_upload', 'handle_check');`

create table public.saved_listings (
  user_id uuid not null references auth.users (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

comment on table public.saved_listings is 'Private saves (3C.2). Own rows only; written by listing_save().';

create index saved_listings_user_created_idx on public.saved_listings (user_id, created_at desc, listing_id);
create index saved_listings_listing_idx on public.saved_listings (listing_id);

alter table public.saved_listings enable row level security;
revoke all on public.saved_listings from anon, authenticated;
grant select on public.saved_listings to authenticated;

create policy saved_listings_select_own
  on public.saved_listings
  for select
  to authenticated
  using (user_id = (select auth.uid()));

insert into public.action_limit_config values
  ('listing_save', 86400, 200, 50, 7),
  ('avatar_upload', 86400, 10, 5, 7),
  ('handle_check', 600, 60, 60, 7);

-- Save (p_saved true) or unsave (false). Returns 'saved', 'unsaved', 'not_found' (not a live
-- listing, or the caller's own) or 'retry_after:<seconds>'. Saving twice is a no-op.
create or replace function public.listing_save(p_id uuid, p_saved boolean)
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
  if not coalesce(p_saved, false) then
    delete from public.saved_listings where user_id = v_uid and listing_id = p_id;
    return 'unsaved';
  end if;
  if exists (select 1 from public.saved_listings where user_id = v_uid and listing_id = p_id) then
    return 'saved';
  end if;
  if not exists (
    select 1 from public.listings l
    join public.listing_media m on m.listing_id = l.id and m.status = 'ready'
    where l.id = p_id and l.seller_id <> v_uid and l.status in ('available', 'pending')
      and l.review_state = 'ok' and l.deleted_at is null and l.removed_at is null
  ) then
    return 'not_found';
  end if;
  v_retry := public.action_limit_take(v_uid, 'listing_save');
  if v_retry > 0 then
    return 'retry_after:' || v_retry::text;
  end if;
  insert into public.saved_listings (user_id, listing_id) values (v_uid, p_id)
  on conflict do nothing;
  return 'saved';
end;
$$;

/**
 * The caller's saved listings that are still live (available or pending, approved, not removed
 * or deleted, video ready); sold or removed ones drop out. p_sort: 'newest' | 'oldest' (by save
 * time) | 'price_asc' | 'price_desc'. Keyset cursor {k, id} from the last row's `cursor`.
 */
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
        when 'oldest' then extract(epoch from s.created_at)
        when 'price_asc' then l.price_cents::numeric
        when 'price_desc' then -l.price_cents::numeric
        else -extract(epoch from s.created_at)
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

revoke execute on function public.listing_save(uuid, boolean) from public, anon;
revoke execute on function public.my_saved_listings(text, jsonb, int) from public, anon;
grant execute on function public.listing_save(uuid, boolean) to authenticated;
grant execute on function public.my_saved_listings(text, jsonb, int) to authenticated;
