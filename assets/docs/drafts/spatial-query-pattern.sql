SELECT id, title, price_cents, ST_Distance(location, ST_MakePoint($user_lon,$user_lat)::geography) / 1609.34 AS distance_miles
FROM listings
WHERE ST_DWithin(location, ST_MakePoint($user_lon,$user_lat)::geography, 160934)
ORDER BY created_at DESC;