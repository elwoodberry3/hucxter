import { describe, expect, it } from 'vitest';
import { locationCookieOptions, parseLocationCookie, serializeLocation } from './location-cookie';

describe('location cookie', () => {
  it('round-trips ZIP and radius only', () => {
    const value = serializeLocation({ zip: '75009', radiusMi: 25 });
    expect(value).toBe('75009.25');
    expect(parseLocationCookie(value)).toEqual({ zip: '75009', radiusMi: 25 });
  });

  it.each([
    undefined,
    '',
    '75009',
    '75009.30',
    '7500.25',
    '75009.25.1',
    '33.12,-96.6',
    'x'.repeat(50),
  ])('treats %j as no preference', (value) => {
    expect(parseLocationCookie(value)).toBeNull();
  });

  it('refuses to serialize anything beyond ZIP and radius', () => {
    expect(() => serializeLocation({ zip: '75009', radiusMi: 25, lat: 1 } as never)).toThrow();
  });

  it('is httpOnly, SameSite=Lax, and Secure when asked', () => {
    expect(locationCookieOptions({ secure: true })).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
    });
    expect(locationCookieOptions({ secure: false }).secure).toBe(false);
  });
});
