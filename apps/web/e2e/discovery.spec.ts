import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { localAdmin } from './helpers/accounts';
import { deleteSeeded, seedListing } from './helpers/listings';
import type { SeededListing } from './helpers/listings';
import { LOCAL_URL, SERVER_ONLY, viewFrom } from './support';

const seeded: SeededListing[] = [];
test.afterEach(async () => {
  await deleteSeeded(seeded.splice(0));
});

/** A word no other listing has, so search finds exactly this spec's fixtures. */
const token = () => `zq${randomUUID().replace(/-/g, '').slice(0, 10)}`;

const cards = (page: Page, text: string) =>
  page.getByRole('main').getByRole('article').filter({ hasText: text });

test.describe('storefront discovery (Brief 03C.1 §3.5)', () => {
  test('a live listing shows on the home rails, its category and search inside the radius, and nowhere outside it', async ({
    page,
    context,
  }, testInfo) => {
    const word = token();
    const listing = await seedListing(testInfo, {
      title: `Walnut side table ${word}`,
      priceCents: 0,
    });
    seeded.push(listing);

    // Portland viewer (97205, 25 mi): home rails, category, search.
    await viewFrom(context, '97205');
    await page.goto(`${LOCAL_URL}/`);
    const newRail = page.getByRole('region', { name: 'New near Portland' });
    await expect(newRail.getByRole('article').filter({ hasText: word })).toBeVisible();
    const freeRail = page.getByRole('region', { name: 'Free stuff near Portland' });
    const card = freeRail.getByRole('article').filter({ hasText: word });
    await expect(card).toContainText('Free');
    await expect(card).toContainText('Good · <1 mi · Portland');
    // The poster comes through the same-origin poster route and loads.
    await expect
      .poll(() => card.locator('img').evaluate((img) => (img as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0);

    await page.goto(`${LOCAL_URL}/c/home/furniture`);
    await expect(cards(page, word)).toHaveCount(1);
    await page.goto(`${LOCAL_URL}/search?q=${word}`);
    await expect(cards(page, word)).toHaveCount(1);
    await cards(page, word).getByRole('link').click();
    await expect(page).toHaveURL(`${LOCAL_URL}/l/${listing.id}`);

    // Celina, TX (75009) is far outside even the 100 mi maximum.
    await viewFrom(context, '75009', 100);
    await page.goto(`${LOCAL_URL}/search?q=${word}`);
    await expect(cards(page, word)).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /^No results for/ })).toBeVisible();
    await page.goto(`${LOCAL_URL}/c/home/furniture`);
    await expect(cards(page, word)).toHaveCount(0);
    await page.goto(`${LOCAL_URL}/`);
    await expect(page.getByRole('main').getByRole('article').filter({ hasText: word })).toHaveCount(
      0,
    );
  });

  test('pending shows only with "include pending"; sold, removed and in-review listings never show', async ({
    page,
    context,
  }, testInfo) => {
    const word = token();
    const pending = await seedListing(testInfo, {
      title: `Pending lamp ${word}`,
      status: 'pending',
    });
    const sold = await seedListing(testInfo, { title: `Sold lamp ${word}`, status: 'sold' });
    const removed = await seedListing(testInfo, { title: `Removed lamp ${word}` });
    const review = await seedListing(testInfo, { title: `Review lamp ${word}`, needsReview: true });
    seeded.push(pending, sold, removed, review);
    await localAdmin()
      .from('listings')
      .update({ removed_at: new Date().toISOString() })
      .eq('id', removed.id);
    await viewFrom(context, '97205');

    await page.goto(`${LOCAL_URL}/search?q=${word}`);
    await expect(page.getByRole('heading', { name: /^No results for/ })).toBeVisible();
    await page.goto(`${LOCAL_URL}/search?q=${word}&status=include_pending`);
    await expect(cards(page, word)).toHaveCount(1);
    await expect(cards(page, word)).toContainText('Pending lamp');
    await expect(cards(page, word)).toContainText('Pending: someone’s on the way');
  });

  test('Load more appends the next keyset page; without JavaScript it links to it', async ({
    page,
    context,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1440', SERVER_ONLY);
    test.setTimeout(120_000);
    const word = token();
    for (let i = 0; i < 25; i += 1) {
      seeded.push(await seedListing(testInfo, { title: `Chair ${String(i)} ${word}` }));
    }
    await viewFrom(context, '97205');
    await page.goto(`${LOCAL_URL}/search?q=${word}`);
    await expect(cards(page, word)).toHaveCount(24);
    const more = page.getByRole('link', { name: 'Load more' });
    await expect(more).toHaveAttribute('href', new RegExp(`^/search\\?q=${word}&after=`));
    // No duplicates across pages: the first page holds the 24 newest.
    await expect(cards(page, `Chair 0 ${word}`)).toHaveCount(0);

    // The no-JS path: the link renders the next page on its own.
    const href = (await more.getAttribute('href')) ?? '';
    const next = await context.newPage();
    await next.goto(`${LOCAL_URL}${href}`);
    await expect(cards(next, word)).toHaveCount(1);
    await expect(cards(next, word)).toContainText(`Chair 0 ${word}`);
    await next.close();

    await more.click();
    await expect(cards(page, word)).toHaveCount(25);
    // Focus moves to the first new card.
    await expect(cards(page, `Chair 0 ${word}`).getByRole('link')).toBeFocused();
    await expect(page.getByRole('link', { name: 'Load more' })).toHaveCount(0);
  });
});
