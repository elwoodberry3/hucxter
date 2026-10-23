-- Canonical local feed (Phase I: recency within radius).
-- Supersedes assets/docs/drafts/spatial-query-pattern.sql, which: lacked ST_SetSRID, filtered on
-- the precise point, returned exact distance, had no status/block filters, and had no LIMIT.
--
-- Params: $1 viewer_lon, $2 viewer_lat (rounded to 2 dp), $3 radius_m,
--         $4 cursor_created_at (nullable), $5 cursor_id (nullable), $6 page_size, $7 viewer_id
with viewer as (
  select extensions.st_setsrid(extensions.st_makepoint($1, $2), 4326)::extensions.geography as g
)
select
  l.id,
  l.title,
  l.price_cents,
  l.condition,
  l.area_label,
  l.primary_media_id,
  l.created_at,
  public.distance_bucket(extensions.st_distance(l.display_point, v.g)) as distance_bucket
from public.listings l
cross join viewer v
where l.status = 'active'
  and extensions.st_dwithin(l.display_point, v.g, least($3, 160934))
  and not exists (
    select 1 from public.blocks b
    where (b.blocker_id = $7 and b.blocked_id = l.seller_id)
       or (b.blocker_id = l.seller_id and b.blocked_id = $7)
  )
  and ($4::timestamptz is null or (l.created_at, l.id) < ($4, $5))
order by l.created_at desc, l.id desc
limit least($6, 50);
