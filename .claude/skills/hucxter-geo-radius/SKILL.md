---
name: hucxter-geo-radius
description: PostGIS location, 100-mile radius, local feed queries, distance display, and location privacy for HUCXTER. Use when writing migrations, feed/search APIs, or any code that stores, queries, or displays a location.
---

# Geo radius & location privacy

## Rules
1. **Radius cap**: discovery queries use `ST_DWithin(display_point, viewer, r)` with
   `r = least(requested_radius_m, 160934)`. Default radius is a product setting (Founder decision);
   never hard-code a default in queries.
2. **Two points per listing**:
   - `precise_point geography(Point,4326)` — private. Never selected into API responses, logs, or
     analytics. Readable only by the owner's own edit flow and server-side jobs.
   - `display_point geography(Point,4326)` — precise point snapped to a ~1 km grid at write time
     (see `reference/schema.sql`). All discovery filtering and distance math use this column.
3. **Distance is bucketed**, never exact: `<1 mi`, `1–5 mi`, `5–10 mi`, `10–25 mi`, `25–50 mi`,
   `50–100 mi`, via `public.distance_bucket(meters)`. Exact distances ("3.2 miles") enable
   trilateration of a seller's home — do not ship them.
4. **Area label** (e.g., "Downtown McKinney") comes from a coarse lookup, stored on the listing.
   Never reverse-geocode to a street address for display.
5. **Viewer location** arrives per request, rounded client-side to 2 decimal places, and is not
   stored as history. A profile may store one coarse home area (display point only).
6. **Coordinates order**: PostGIS is `ST_MakePoint(lon, lat)`. Always wrap with
   `ST_SetSRID(..., 4326)::geography`. Validate lat ∈ [-90, 90], lon ∈ [-180, 180] in zod first.
7. **Fallback**: if location permission is denied, ask for a ZIP / area; never guess from IP silently.
8. **Pagination**: keyset on `(created_at, id)`, limit ≤ 50. No OFFSET.
9. **Blocks**: every discovery query excludes listings from users the viewer blocked or who
   blocked the viewer.

## Known tradeoff
Filtering on the snapped display point can include/exclude items up to ~1 km past the radius
boundary. Accepted: privacy outweighs edge precision at a 100-mile scale.

## Testing (required for any change here)
pgTAP or SQL tests in `supabase/tests/` must cover: listing at 99 mi included, 101 mi excluded,
requested radius > 100 mi clamped, `precise_point` absent from the feed function's output columns,
blocked seller excluded, keyset pagination stable across equal `created_at`.

## Reference files
- `reference/schema.sql` — columns, snapping trigger, indexes, `distance_bucket()`.
- `reference/feed-query.sql` — canonical local feed query. Copy its shape; don't improvise.
