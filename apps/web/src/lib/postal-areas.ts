import 'server-only';
import { Coordinates, PostalArea, Zip } from '@hucxter/contracts';
import { unstable_cache } from 'next/cache';
import { publicDb } from './supabase';

async function lookup(zip: string): Promise<PostalArea | null> {
  const response = await publicDb().rpc('postal_area_lookup', { p_zip: zip });
  if (response.error) throw new Error(`postal_area_lookup failed: ${response.error.message}`);
  const rows = PostalArea.array().parse(response.data);
  return rows[0] ?? null;
}

const cachedLookup = unstable_cache(lookup, ['postal-area-v1'], { revalidate: 86_400 });

/** ZIP -> area label, or null if the ZIP isn't in a covered region. */
export async function lookupPostalArea(zip: string): Promise<PostalArea | null> {
  const parsed = Zip.safeParse(zip);
  return parsed.success ? cachedLookup(parsed.data) : null;
}

/**
 * Nearest covered ZIP to a browser location. Coordinates are rounded to 2 decimals (~1 km) here
 * and again in SQL, used once, and never stored or logged.
 */
export async function nearestPostalArea(coordinates: Coordinates): Promise<PostalArea | null> {
  const { lat, lon } = Coordinates.parse(coordinates);
  const round = (value: number) => Math.round(value * 100) / 100;
  const response = await publicDb().rpc('postal_area_nearest', {
    p_lat: round(lat),
    p_lon: round(lon),
  });
  if (response.error) throw new Error('postal_area_nearest failed');
  return PostalArea.array().parse(response.data)[0] ?? null;
}
