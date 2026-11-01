import 'server-only';
import { DEFAULT_RADIUS_MI } from '@hucxter/contracts';
import type { RadiusMi } from '@hucxter/contracts';
import { cookies, headers } from 'next/headers';
import { cache } from 'react';
import { serverConfig } from './env';
import { LOCATION_COOKIE, parseLocationCookie } from './location-cookie';
import { lookupPostalArea } from './postal-areas';

export interface ViewerLocation {
  zip: string;
  areaLabel: string;
  radiusMi: RadiusMi;
  /** True until the viewer confirms or changes it (an IP- or default-based guess). */
  isGuess: boolean;
  /** Where a guess came from, so the UI can describe it truthfully. */
  guessSource: 'ip' | 'default' | null;
}

/** The ZIP Vercel derived from the request IP, if we're on Vercel. Never logged or stored. */
export function ipPostalCode(
  requestHeaders: Pick<Headers, 'get'>,
  isVercel: boolean,
): string | undefined {
  if (!isVercel) return undefined;
  const value = requestHeaders.get('x-vercel-ip-postal-code')?.trim();
  return value !== undefined && /^\d{5}$/.test(value) ? value : undefined;
}

/**
 * Viewer location (hucxter-geo-radius rule 7). Order: the confirmed cookie (ZIP + radius) →
 * (Brief 03B) the member's home ZIP → Vercel IP ZIP → DEFAULT_AREA_ZIP (97205). Anything but the
 * cookie is a visible guess ("Near Portland 97205?"). Cached per request.
 */
export const getViewerLocation = cache(async (): Promise<ViewerLocation | null> => {
  const config = serverConfig();
  const preference = parseLocationCookie((await cookies()).get(LOCATION_COOKIE)?.value);
  if (preference !== null) {
    const area = await lookupPostalArea(preference.zip);
    if (area !== null) {
      return {
        zip: area.zip,
        areaLabel: area.area_label,
        radiusMi: preference.radiusMi,
        isGuess: false,
        guessSource: null,
      };
    }
  }

  // Brief 03B inserts the signed-in member's home ZIP here, before the IP guess.
  const candidates = [
    { zip: ipPostalCode(await headers(), config.isVercel), source: 'ip' as const },
    { zip: config.defaultAreaZip, source: 'default' as const },
  ];
  for (const { zip, source } of candidates) {
    if (zip === undefined) continue;
    const area = await lookupPostalArea(zip);
    if (area !== null) {
      return {
        zip: area.zip,
        areaLabel: area.area_label,
        radiusMi: DEFAULT_RADIUS_MI,
        isGuess: true,
        guessSource: source,
      };
    }
  }
  return null;
});

export function locationText(location: ViewerLocation | null): string | null {
  if (location === null) return null;
  return `Near ${location.areaLabel} ${location.zip}${location.isGuess ? '?' : ''}`;
}
