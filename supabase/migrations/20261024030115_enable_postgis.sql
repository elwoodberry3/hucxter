-- Enable PostGIS for location features (ADR-0001, hucxter-geo-radius).
-- Installed in the `extensions` schema, Supabase's convention, to keep `public` clean.
-- Recovery: until a later migration uses PostGIS types, `drop extension postgis;` undoes this
-- with no data loss. After that, roll forward only.
create extension if not exists postgis with schema extensions;
