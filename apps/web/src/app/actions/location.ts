'use server';

import { Coordinates, DEFAULT_RADIUS_MI, RadiusMi, Zip } from '@hucxter/contracts';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { serverConfig } from '@/lib/env';
import { LOCATION_COOKIE, locationCookieOptions, serializeLocation } from '@/lib/location-cookie';
import { lookupPostalArea, nearestPostalArea } from '@/lib/postal-areas';

export type LocationResult =
  { ok: true; zip: string; areaLabel: string } | { ok: false; error: string };

const ZipInput = z.object({ zip: Zip, radiusMi: RadiusMi.catch(DEFAULT_RADIUS_MI) });
const CoordinatesInput = Coordinates.extend({ radiusMi: RadiusMi.catch(DEFAULT_RADIUS_MI) });

async function remember(zip: string, radiusMi: RadiusMi): Promise<void> {
  const config = serverConfig();
  (await cookies()).set(
    LOCATION_COOKIE,
    serializeLocation({ zip, radiusMi }),
    locationCookieOptions({
      secure: config.isProduction || config.appOrigin.protocol === 'https:',
    }),
  );
}

/** Saves a ZIP + radius chosen in the location popover (also confirms a guess). */
export async function setLocationByZip(input: unknown): Promise<LocationResult> {
  const parsed = ZipInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Enter a 5-digit ZIP code.' };
  const area = await lookupPostalArea(parsed.data.zip);
  if (area === null) {
    return { ok: false, error: 'Hucxter isn’t in that area yet. Try a North Texas ZIP code.' };
  }
  await remember(area.zip, parsed.data.radiusMi);
  return { ok: true, zip: area.zip, areaLabel: area.area_label };
}

/**
 * "Use my current location": converts browser coordinates to the nearest covered ZIP. Only the
 * ZIP is kept; the coordinates are never stored, logged, or sent to analytics.
 */
export async function setLocationFromCoordinates(input: unknown): Promise<LocationResult> {
  const parsed = CoordinatesInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'We couldn’t read your location.' };
  try {
    const area = await nearestPostalArea({ lat: parsed.data.lat, lon: parsed.data.lon });
    if (area === null) {
      return {
        ok: false,
        error: 'Hucxter isn’t near you yet. Enter a North Texas ZIP code instead.',
      };
    }
    await remember(area.zip, parsed.data.radiusMi);
    return { ok: true, zip: area.zip, areaLabel: area.area_label };
  } catch {
    return { ok: false, error: 'We couldn’t look up your location. Enter your ZIP code instead.' };
  }
}
