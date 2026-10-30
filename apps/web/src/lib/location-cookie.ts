import { LocationPreference } from '@hucxter/contracts';

/** First-party cookie holding the viewer's confirmed location: ZIP + radius only. */
export const LOCATION_COOKIE = 'hx_loc';

const MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

export function serializeLocation(preference: LocationPreference): string {
  const { zip, radiusMi } = LocationPreference.parse(preference);
  return `${zip}.${String(radiusMi)}`;
}

/** Parses the cookie value; anything malformed is treated as no preference. */
export function parseLocationCookie(value: string | undefined): LocationPreference | null {
  if (value === undefined) return null;
  const match = /^(\d{5})\.(\d{1,3})$/.exec(value);
  if (match === null) return null;
  const parsed = LocationPreference.safeParse({ zip: match[1], radiusMi: Number(match[2]) });
  return parsed.success ? parsed.data : null;
}

export function locationCookieOptions({ secure }: { secure: boolean }) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure,
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  };
}
