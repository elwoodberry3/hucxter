import { beforeEach, describe, expect, it, vi } from 'vitest';

// CSRF on the cookie-only actions (PR #9 follow-up; Founder amendment 6, Brief 03C.1).
const headerStore = new Map<string, string>();
const set = vi.fn();
vi.mock('next/headers', () => ({
  headers: () => Promise.resolve({ get: (name: string) => headerStore.get(name) ?? null }),
  cookies: () => Promise.resolve({ set }),
}));
vi.mock('@/lib/postal-areas', () => ({
  lookupPostalArea: () => Promise.resolve({ zip: '97205', area_label: 'Portland, OR' }),
  nearestPostalArea: () => Promise.resolve({ zip: '97205', area_label: 'Portland, OR' }),
}));

process.env.APP_ORIGIN = 'https://qa.hucxter.test';

const { setLocationByZip, setLocationFromCoordinates } = await import('./location');
const { dismissLaunchNotice } = await import('./launch-notice');

describe('cookie-only actions check Origin', () => {
  beforeEach(() => {
    headerStore.clear();
    set.mockReset();
  });

  it.each([undefined, 'https://evil.example', 'null', 'http://qa.hucxter.test'])(
    'refuses origin %s and sets no cookie',
    async (origin) => {
      if (origin !== undefined) headerStore.set('origin', origin);
      await expect(setLocationByZip({ zip: '97205', radiusMi: 25 })).resolves.toMatchObject({
        ok: false,
      });
      await expect(
        setLocationFromCoordinates({ lat: 45.5, lon: -122.7, radiusMi: 25 }),
      ).resolves.toMatchObject({ ok: false });
      await dismissLaunchNotice();
      expect(set).not.toHaveBeenCalled();
    },
  );

  it('sets the cookies for the app origin', async () => {
    headerStore.set('origin', 'https://qa.hucxter.test');
    await expect(setLocationByZip({ zip: '97205', radiusMi: 25 })).resolves.toMatchObject({
      ok: true,
    });
    await dismissLaunchNotice();
    expect(set).toHaveBeenCalledTimes(2);
  });
});
