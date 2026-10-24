-- Enable PostGIS for location features (ADR-0001, hucxter-geo-radius).
-- Installed in the `extensions` schema, Supabase's convention, to keep `public` clean.
-- Forward-only: later migrations will depend on PostGIS types.
create extension if not exists postgis with schema extensions;
