import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';
import {
  deleteE2eUsers,
  handleFor,
  localAdmin,
  signUpVerified,
  userIdFor,
} from './helpers/accounts';
import { seedListing } from './helpers/listings';
import { LOCAL_URL } from './support';

const members: string[] = [];
test.afterEach(async () => {
  // Deleting the member cascades their listings.
  await deleteE2eUsers(members.splice(0));
});

async function member(page: Page, testInfo: TestInfo, zip?: string) {
  const email = await signUpVerified(page, testInfo, {
    base: LOCAL_URL,
    ...(zip === undefined ? {} : { zip }),
  });
  members.push(email);
  const id = await userIdFor(email);
  return { id, email, handle: await handleFor(id) };
}

const tiles = (page: Page) => page.getByRole('main').getByRole('article');

async function expectTiles(page: Page, titles: string[]) {
  await expect(tiles(page)).toHaveCount(titles.length);
  for (const title of titles) {
    await expect(tiles(page).filter({ hasText: title })).toHaveCount(1);
  }
}

/** Every stage of one owner's listings, plus someone else's listing that must never show. */
async function seedEveryStage(testInfo: TestInfo, owner: { id: string; email: string }) {
  await seedListing(testInfo, { owner, title: 'Draft desk', stage: 'draft' });
  await seedListing(testInfo, { owner, title: 'Processing desk', stage: 'processing' });
  const live = await seedListing(testInfo, { owner, title: 'Live desk' });
  await seedListing(testInfo, { owner, title: 'Pending desk', status: 'pending' });
  await seedListing(testInfo, { owner, title: 'Review desk', needsReview: true });
  const removed = await seedListing(testInfo, { owner, title: 'Removed desk' });
  await localAdmin()
    .from('listings')
    .update({ removed_at: new Date().toISOString() })
    .eq('id', removed.id);
  await seedListing(testInfo, { owner, title: 'Sold desk', status: 'sold' });
  const other = await seedListing(testInfo, { title: 'Not my desk' });
  members.push(other.sellerEmail);
  return { live };
}

test.describe('Profile: owner view (Brief 03C.2 §4.2, replaces My Listings)', () => {
  test('filter chips cover every stage; tabs are Listings · Sold · Saved', async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);
    const owner = await member(page, testInfo);
    await seedEveryStage(testInfo, owner);

    await page.goto(`${LOCAL_URL}/profile`);
    await expect(page).toHaveURL(`${LOCAL_URL}/u/${owner.handle}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sam');
    await expect(page.getByText(`@${owner.handle}`)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Edit profile' })).toBeVisible();
    // Real counts: 2 live (available + pending), 1 sold.
    await expect(page.getByText('2 listed · 1 sold')).toBeVisible();

    const sections = page.getByRole('navigation', { name: 'Profile sections' });
    await expect(sections.getByRole('link')).toHaveText(['Listings', 'Sold', 'Saved']);
    const chips = page.getByRole('navigation', { name: 'Listing status' });
    await expect(chips.getByRole('link')).toHaveText([
      'All',
      'Live',
      'Pending',
      'Drafts',
      'In review',
    ]);
    await expect(chips.getByRole('link', { name: 'All' })).toHaveAttribute('aria-current', 'page');
    await expectTiles(page, [
      'Draft desk',
      'Processing desk',
      'Live desk',
      'Pending desk',
      'Review desk',
      'Removed desk',
      'Sold desk',
    ]);

    const expected: Record<string, string[]> = {
      Live: ['Live desk'],
      Pending: ['Pending desk'],
      Drafts: ['Draft desk', 'Processing desk'],
      'In review': ['Review desk', 'Removed desk'],
    };
    for (const [chip, titles] of Object.entries(expected)) {
      await chips.getByRole('link', { name: chip }).click();
      await expect(chips.getByRole('link', { name: chip })).toHaveAttribute('aria-current', 'page');
      await expectTiles(page, titles);
    }
    await expect(tiles(page).filter({ hasText: 'Removed desk' })).toContainText('Removed');
    await expect(tiles(page).filter({ hasText: 'Review desk' })).toContainText('In review');

    await sections.getByRole('link', { name: 'Sold' }).click();
    await expectTiles(page, ['Sold desk']);
    // Owner-only real view counts (no events seeded: zero).
    await page.goto(`${LOCAL_URL}/u/${owner.handle}?filter=live`);
    await expect(tiles(page).filter({ hasText: 'Live desk' })).toContainText('0 views');
    // No sideways scroll at phone widths (the tab and chip strips scroll on their own).
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
    ).toBeLessThanOrEqual(0);

    await page.goto(`${LOCAL_URL}/u/${owner.handle}?filter=drafts`);
    await expect(tiles(page).filter({ hasText: 'Processing desk' })).toContainText('Processing');
    await tiles(page).filter({ hasText: 'Draft desk' }).getByRole('link').first().click();
    await expect(page).toHaveURL(/\/sell\?draft=.+&step=/);
  });

  test('old My Listings, Saved and Profile URLs land on the profile', async ({
    page,
  }, testInfo) => {
    const owner = await member(page, testInfo);
    const base = `${LOCAL_URL}/u/${owner.handle}`;
    const cases: [string, string][] = [
      ['/listings', base],
      ['/listings?tab=review', `${base}?filter=review`],
      ['/listings?tab=processing', `${base}?filter=drafts`],
      ['/listings?tab=sold', `${base}?tab=sold`],
      ['/listings?deleted=1', `${base}?deleted=1`],
      ['/saved', `${base}?tab=saved`],
      ['/profile', base],
      ['/profile?filter=drafts', `${base}?filter=drafts`],
    ];
    for (const [from, to] of cases) {
      await page.goto(`${LOCAL_URL}${from}`);
      await expect(page, from).toHaveURL(to);
    }
    await page.goto(`${base}?tab=saved`);
    await expect(page.getByRole('heading', { name: 'Nothing saved yet' })).toBeVisible();
    await page.goto(base);
    await expect(page.getByRole('heading', { name: 'No items yet' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Post your first item' })).toHaveAttribute(
      'href',
      '/sell',
    );
  });

  test('edit changes the live listing; an edit with a prohibited word holds it for review', async ({
    page,
    browser,
  }, testInfo) => {
    const owner = await member(page, testInfo);
    const listing = await seedListing(testInfo, { owner, title: 'Oak chair', priceCents: 4000 });
    await page.goto(`${LOCAL_URL}/u/${owner.handle}`);
    await tiles(page)
      .filter({ hasText: 'Oak chair' })
      .getByRole('link', { name: 'Edit Oak chair' })
      .click();
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

  test('delete from the profile confirms, removes it, and says so', async ({ page }, testInfo) => {
    const owner = await member(page, testInfo);
    const listing = await seedListing(testInfo, { owner, title: 'Old lamp', stage: 'draft' });
    await page.goto(`${LOCAL_URL}/u/${owner.handle}?filter=drafts`);
    await tiles(page)
      .filter({ hasText: 'Old lamp' })
      .getByRole('button', { name: 'Delete' })
      .click();
    const sheet = page.getByRole('dialog', { name: 'Delete draft?' });
    await expect(sheet).toBeVisible();
    await sheet.getByRole('button', { name: 'Delete draft' }).click();
    await expect(page).toHaveURL(`${LOCAL_URL}/u/${owner.handle}?deleted=1`);
    await expect(page.getByRole('status').filter({ hasText: 'Listing deleted.' })).toBeVisible();
    await expect(tiles(page).filter({ hasText: 'Old lamp' })).toHaveCount(0);
    expect((await page.goto(`${LOCAL_URL}/l/${listing.id}`))?.status()).toBe(404);
  });

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`axe: owner profile, empty Saved, and the edit page (${colorScheme})`, async ({
      page,
    }, testInfo) => {
      const owner = await member(page, testInfo);
      const listing = await seedListing(testInfo, { owner, title: 'Axe chair' });
      await seedListing(testInfo, { owner, title: 'Axe draft', stage: 'draft' });
      await page.emulateMedia({ colorScheme });
      for (const path of [
        `/u/${owner.handle}`,
        `/u/${owner.handle}?tab=sold`,
        `/u/${owner.handle}?tab=saved`,
        `/listings/${listing.id}/edit`,
      ]) {
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

test.describe('Profile: public view (Brief 03C.2 §4.2)', () => {
  test('others see only live and sold listings, never drafts, review, Saved, ZIP or area', async ({
    page,
    browser,
  }, testInfo) => {
    test.setTimeout(90_000);
    // Home ZIP 98660 (Vancouver, WA): the guest's location chip says Portland 97205.
    const owner = await member(page, testInfo, '98660');
    const { live } = await seedEveryStage(testInfo, owner);

    const guest = await browser.newContext();
    const view = await guest.newPage();
    const response = await view.goto(`${LOCAL_URL}/u/${owner.handle}`);
    expect(response?.status()).toBe(200);
    const sections = view.getByRole('navigation', { name: 'Profile sections' });
    await expect(sections.getByRole('link')).toHaveText(['Listings', 'Sold']);
    await expect(view.getByRole('navigation', { name: 'Listing status' })).toHaveCount(0);
    await expect(view.getByRole('link', { name: 'Edit profile' })).toHaveCount(0);
    await expect(view.getByRole('button', { name: 'Share profile' })).toBeVisible();
    await expectTiles(view, ['Live desk', 'Pending desk']);
    await expect(view.getByText(/views?$/)).toHaveCount(0);
    // An owner-only filter or Saved in the URL falls back to the public Listings tab.
    for (const query of ['?filter=drafts', '?filter=review', '?tab=saved']) {
      await view.goto(`${LOCAL_URL}/u/${owner.handle}${query}`);
      await expectTiles(view, ['Live desk', 'Pending desk']);
    }
    await sections.getByRole('link', { name: 'Sold' }).click();
    await expectTiles(view, ['Sold desk']);
    const html =
      (await (await view.request.get(`${LOCAL_URL}/u/${owner.handle}`)).text()) +
      (await (await view.request.get(`${LOCAL_URL}/u/${owner.handle}?tab=sold`)).text());
    for (const secret of ['98660', 'Vancouver', 'Draft desk', 'Review desk', 'Removed desk']) {
      expect(html, secret).not.toContain(secret);
    }

    // The seller card on the listing page links to the profile.
    await view.goto(`${LOCAL_URL}/l/${live.id}`);
    await view.getByRole('link', { name: new RegExp(`@${owner.handle}`) }).click();
    await expect(view).toHaveURL(`${LOCAL_URL}/u/${owner.handle}`);

    // Handles are case-insensitive: /u/SAM… redirects to the stored lowercase handle.
    await view.goto(`${LOCAL_URL}/u/${owner.handle.toUpperCase()}`);
    await expect(view).toHaveURL(`${LOCAL_URL}/u/${owner.handle}`);
    await guest.close();
  });

  test('unknown, invalid and deleted handles are 404', async ({ page, request }, testInfo) => {
    const owner = await member(page, testInfo);
    for (const handle of ['nobody-here-xyz', 'no_such_member_e2e', 'a', '..x']) {
      expect((await request.get(`${LOCAL_URL}/u/${handle}`)).status(), handle).toBe(404);
    }
    expect((await request.get(`${LOCAL_URL}/u/${owner.handle}`)).status()).toBe(200);
    await localAdmin()
      .from('profiles')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', owner.id);
    expect((await request.get(`${LOCAL_URL}/u/${owner.handle}`)).status()).toBe(404);
  });
});
