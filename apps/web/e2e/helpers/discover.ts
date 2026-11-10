import { expect } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';
import { seedListing } from './listings';
import type { SeededListing } from './listings';
import { LOCAL_URL, viewFrom } from '../support';

// Discover feed fixtures (Brief 03 3D). Every test seeds its own small town (viewed at a 1 mi
// radius) per project, so parallel specs never leak listings into each other's feed.
export const PROJECTS = ['desktop-1440', 'desktop-1280', 'mobile-chromium', 'mobile-webkit'];
// Distinct small towns in Iowa, South Dakota and Kansas, far from every other fixture.
export const TOWNS = [
  '50001',
  '50040',
  '50070',
  '50120',
  '50147',
  '50201',
  '50236',
  '50271',
  '50434',
  '50465',
  '50518',
  '50546',
  '50578',
  '50609',
  '50642',
  '50672',
  '50847',
  '51012',
  '51041',
  '51235',
  '51346',
  '51445',
  '51525',
  '51553',
  '51631',
  '52037',
  '52071',
  '52157',
  '52211',
  '52241',
  '52320',
  '52348',
  '52548',
  '52580',
  '52637',
  '52726',
  '52759',
  '57014',
  '57041',
  '57069',
  '57231',
  '57264',
  '57325',
  '57361',
  '57421',
  '57455',
  '57528',
  '66429',
  '66527',
  '66717',
  '66769',
  '66853',
  '66942',
  '67012',
];
export const FAR_TOWN = '57567';

export function town(slot: number, testInfo: TestInfo): string {
  const zip = TOWNS[slot * PROJECTS.length + PROJECTS.indexOf(testInfo.project.name)];
  if (zip === undefined) throw new Error(`no fixture town for slot ${String(slot)}`);
  return zip;
}

/** Seeds `count` live listings in `zip`, one seller, newest first. Returns their ids in feed order. */
export async function seedFeed(
  testInfo: TestInfo,
  zip: string,
  count: number,
  seeded: SeededListing[],
): Promise<string[]> {
  const ids: string[] = [];
  let owner: { id: string; email: string } | undefined;
  for (let i = 0; i < count; i += 1) {
    const listing = await seedListing(testInfo, {
      zip,
      title: `Feed lamp ${String(i + 1)}`,
      priceCents: i === 1 ? 0 : 1500 + i * 100,
      publishedDaysAgo: i * 0.01,
      ...(owner === undefined ? {} : { owner }),
    });
    owner ??= { id: listing.sellerId, email: listing.sellerEmail };
    seeded.push(listing);
    ids.push(listing.id);
  }
  return ids;
}

export async function openFeed(page: Page, zip: string, query = '') {
  await viewFrom(page.context(), zip, 1);
  await page.goto(`${LOCAL_URL}/discover${query}`);
  await expect(page.locator('[data-feed-item]').first()).toBeVisible();
}

export const activeItem = (page: Page) => page.locator('[data-feed-item][data-active="true"]');
export const activeId = (page: Page) => activeItem(page).getAttribute('data-id');
export const sheet = (page: Page) => page.getByRole('dialog');

/** Per mux-player: paused, muted, has a source, inside the active item. */
export function players(page: Page) {
  return page.locator('mux-player').evaluateAll((elements) =>
    elements.map((element) => {
      const media = element as HTMLMediaElement;
      return {
        paused: media.paused,
        muted: media.muted,
        hasSource: (media.getAttribute('src') ?? media.getAttribute('playback-id') ?? '') !== '',
        active: element.closest('[data-active="true"]') !== null,
      };
    }),
  );
}
