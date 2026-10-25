import { z } from 'zod';

/** US 5-digit ZIP (Census ZCTA in `postal_areas`). */
export const Zip = z.string().regex(/^[0-9]{5}$/, 'Enter a 5-digit ZIP code');

/** Radius choices in miles. Capped at 100 mi (160,934 m), the discovery limit. */
export const RADIUS_OPTIONS_MI = [1, 5, 10, 25, 50, 100] as const;
export const RadiusMi = z.union(RADIUS_OPTIONS_MI.map((value) => z.literal(value)));
export type RadiusMi = z.infer<typeof RadiusMi>;

/**
 * Default radius when the viewer hasn't chosen one. A product setting (Founder decision pending);
 * change it here, never in queries.
 */
export const DEFAULT_RADIUS_MI: RadiusMi = 25;

export const MAX_RADIUS_M = 160_934;

export function radiusMeters(radius: RadiusMi): number {
  return Math.min(Math.round(radius * 1609.344), MAX_RADIUS_M);
}

/** What the location cookie stores: ZIP + radius only. */
export const LocationPreference = z.object({ zip: Zip, radiusMi: RadiusMi }).strict();
export type LocationPreference = z.infer<typeof LocationPreference>;

/** A row from `postal_area_lookup` / `postal_area_nearest`. */
export const PostalArea = z.object({
  zip: Zip,
  area_label: z.string().min(1).max(60),
  state: z.string().regex(/^[A-Z]{2}$/),
});
export type PostalArea = z.infer<typeof PostalArea>;

/** Browser geolocation input. Rounded to 2 decimals (~1 km) before it leaves the server action. */
export const Coordinates = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});
