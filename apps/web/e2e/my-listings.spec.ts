import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';
import { deleteE2eUsers, localAdmin, signUpVerified, userIdFor } from './helpers/accounts';
import { seedListing } from './helpers/listings';
import { LOCAL_URL } from './support';

const members: string[] = [];
test.afterEach(async () => {
  // Deleting the member cascades their listings.
  await deleteE2eUsers(members.splice(0));
});

async function member(page: Page, testInfo: TestInfo) {
  const email = await signUpVerified(page, testInfo, { base: LOCAL_URL });
  members.push(email);
  return { id: await userIdFor(email), email };
}

const rows = (page: Page) => page.getByRole('main').getByRole('listitem');

test.describe('My Listings (Brief 03C.1 §3.6)', () => {
  test('each listing sits in exactly one tab: Drafts · Processing · Live · In review · Sold', async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);
    const owner = await member(page, testInfo);
    await seedListing(testInfo, { owner, title: 'Draft desk', stage: 'draft' });
    await seedListing(testInfo, { owner, title: 'Processing desk', stage: 'processing' });
    await seedListing(testInfo, { owner, title: 'Live desk' });
    await seedListing(testInfo, { owner, title: 'Pending desk', status: 'pending' });
    await seedListing(testInfo, { owner, title: 'Review desk', needsReview: true });
    const removed = await seedListing(testInfo, { owner, title: 'Removed desk' });
    await localAdmin()
      .from('listings')
      .update({ removed_at: new Date().toISOString() })
      .eq('id', removed.id);
    await seedListing(testInfo, { owner, title: 'Sold desk', status: 'sold' });
    // Someone else's listing never shows.
    const other = await seedListing(testInfo, { title: 'Not my desk' });
    members.push(other.sellerEmail);

    const expected: Record<string, string[]> = {
      Drafts: ['Draft desk'],
      Processing: ['Processing desk'],
      Live: ['Pending desk', 'Live desk'],
      'In review': ['Removed desk', 'Review desk'],
      Sold: ['Sold desk'],
    };
    await page.goto(`${LOCAL_URL}/listings`);
    const tabs = page.getByRole('navigation', { name: 'Listing status' });
    await expect(tabs.getByRole('link')).toHaveText(Object.keys(expected));
    await expect(tabs.getByRole('link', { name: 'Live' })).toHaveAttribute('aria-current', 'page');
    for (const [tab, titles] of Object.entries(expected)) {
      await tabs.getByRole('link', { name: tab }).click();
      await expect(tabs.getByRole('link', { name: tab })).toHaveAttribute('aria-current', 'page');
      await expect(rows(page).getByRole('heading', { level: 3 })).toHaveText(titles);
    }
    // No sideways scroll at phone widths (the tab strip scrolls on its own).
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
    ).toBeLessThanOrEqual(0);
    await page.goto(`${LOCAL_URL}/listings?tab=review`);
    await expect(rows(page).filter({ hasText: 'Removed desk' })).toContainText(
      'Removed by Hucxter',
    );
    await expect(rows(page).filter({ hasText: 'Review desk' })).toContainText(
      'We’re reviewing this listing',
    );
    await page.goto(`${LOCAL_URL}/listings?tab=drafts`);
    await rows(page).getByRole('link', { name: 'Continue' }).click();
    await expect(page).toHaveURL(/\/sell\?draft=.+&step=/);
  });

  test('edit changes the live listing; an edit with a prohibited word holds it for review', async ({
    page,
    browser,
  }, testInfo) => {
    const owner = await member(page, testInfo);
    const listing = await seedListing(testInfo, { owner, title: 'Oak chair', priceCents: 4000 });
    await page.goto(`${LOCAL_URL}/listings`);
    await rows(page).filter({ hasText: 'Oak chair' }).getByRole('link', { name: 'Edit' }).click();
    await expect(page).toHaveURL(`${LOCAL_URL}/listings/${listing.id}/edit`);
    await expect(page.getByLabel('Title')).toHaveValue('Oak chair');
    await page.getByLabel('Price').fill('35');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page).toHaveURL(`${LOCAL_URL}/l/${listing.id}`);
    await expect(page.getByText('$35', { exact: true })).toBeVisible();

    await page.goto(`${LOCAL_URL}/listings/${listing.id}/edit`);
    await page.getByLabel('Description (optional)').fill('Comes with a rifle rack.');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page).toHaveURL(`${LOCAL_URL}/l/${listing.id}`);
    await expect(page.getByText('We’re reviewing this listing.')).toBeVisible();
    const guest = await browser.newContext();
    expect((await (await guest.newPage()).goto(`${LOCAL_URL}/l/${listing.id}`))?.status()).toBe(
      404,
    );
    await guest.close();

    // Someone else can't open the edit page.
    const other = await seedListing(testInfo, { title: 'Not mine' });
    members.push(other.sellerEmail);
    expect((await page.goto(`${LOCAL_URL}/listings/${other.id}/edit`))?.status()).toBe(404);
  });

  test('delete from My Listings confirms, removes it, and says so', async ({ page }, testInfo) => {
    const owner = await member(page, testInfo);
    const listing = await seedListing(testInfo, { owner, title: 'Old lamp' });
    await page.goto(`${LOCAL_URL}/listings`);
    await rows(page)
      .filter({ hasText: 'Old lamp' })
      .getByRole('button', { name: 'Delete' })
      .click();
    const sheet = page.getByRole('dialog', { name: 'Delete listing?' });
    await expect(sheet).toBeVisible();
    await sheet.getByRole('button', { name: 'Delete listing' }).click();
    await expect(page).toHaveURL(`${LOCAL_URL}/listings?deleted=1`);
    await expect(page.getByRole('status').filter({ hasText: 'Listing deleted.' })).toBeVisible();
    await expect(rows(page).filter({ hasText: 'Old lamp' })).toHaveCount(0);
    expect((await page.goto(`${LOCAL_URL}/l/${listing.id}`))?.status()).toBe(404);
  });

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`axe: My Listings and the edit page (${colorScheme})`, async ({ page }, testInfo) => {
      const owner = await member(page, testInfo);
      const listing = await seedListing(testInfo, { owner, title: 'Axe chair' });
      await page.emulateMedia({ colorScheme });
      for (const path of ['/listings', '/listings?tab=sold', `/listings/${listing.id}/edit`]) {
        await page.goto(`${LOCAL_URL}${path}`);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        const results = await new AxeBuilder({ page }).analyze();
        const blocking = results.violations.filter(
          (v) => v.impact === 'serious' || v.impact === 'critical',
        );
        expect(
          blocking.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
          path,
        ).toEqual([]);
      }
    });
  }
});
