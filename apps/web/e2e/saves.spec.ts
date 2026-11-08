import { expect, test } from '@playwright/test';
import type { Locator, Page, TestInfo } from '@playwright/test';
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
  await deleteE2eUsers(members.splice(0));
});

async function member(page: Page, testInfo: TestInfo) {
  const email = await signUpVerified(page, testInfo, { base: LOCAL_URL });
  members.push(email);
  const id = await userIdFor(email);
  return { id, email, handle: await handleFor(id) };
}

/** A live listing by a throwaway seller, with a title unique to this test. */
async function liveListing(testInfo: TestInfo, title: string) {
  const listing = await seedListing(testInfo, { title });
  members.push(listing.sellerEmail);
  return listing;
}

/** Clicks a save toggle and waits for the server action's answer (the UI flips before it). */
async function toggle(page: Page, button: Locator) {
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.request().headers()['next-action'] !== undefined,
    ),
    button.click(),
  ]);
}

const card = (page: Page, title: string) =>
  page.getByRole('main').getByRole('article').filter({ hasText: title });

const unique = (testInfo: TestInfo, base: string) =>
  `${base} ${testInfo.project.name.replace(/[^a-z0-9]/gi, '')} ${String(testInfo.workerIndex)}`;

test.describe('Saves (Brief 03C.2 §4.3)', () => {
  test('guests: Save on a card opens the sign-in sheet', async ({ page }, testInfo) => {
    const title = unique(testInfo, 'Guest save lamp');
    await liveListing(testInfo, title);
    await page.goto(`${LOCAL_URL}/search?q=${encodeURIComponent(title)}`);
    await card(page, title)
      .getByRole('button', { name: `Save ${title}` })
      .click();
    await expect(page.getByRole('dialog', { name: 'Sign in to save listings' })).toBeVisible();
  });

  test('save from a card and the listing page; the Saved tab lists it; unsave removes it', async ({
    page,
  }, testInfo) => {
    const viewer = await member(page, testInfo);
    const title = unique(testInfo, 'Brass floor lamp');
    const listing = await liveListing(testInfo, title);

    await page.goto(`${LOCAL_URL}/search?q=${encodeURIComponent(title)}`);
    const save = card(page, title).getByRole('button', { name: `Save ${title}` });
    await expect(save).toHaveAttribute('aria-pressed', 'false');
    await toggle(page, save);
    await expect(save).toHaveAttribute('aria-pressed', 'true');
    // The server state survives a reload.
    await page.reload();
    await expect(save).toHaveAttribute('aria-pressed', 'true');

    await page.goto(`${LOCAL_URL}/saved`);
    await expect(page).toHaveURL(`${LOCAL_URL}/u/${viewer.handle}?tab=saved`);
    await expect(card(page, title)).toHaveCount(1);
    // No public save counts anywhere.
    expect(await page.getByRole('main').innerText()).not.toMatch(/\d+\s+saves?\b/i);

    await page.goto(`${LOCAL_URL}/l/${listing.id}`);
    const pageSave = page
      .getByRole('main')
      .getByRole('button', { name: 'Save', exact: true })
      .filter({ visible: true });
    await expect(pageSave).toHaveAttribute('aria-pressed', 'true');
    await toggle(page, pageSave);
    await expect(pageSave).toHaveAttribute('aria-pressed', 'false');
    await page.goto(`${LOCAL_URL}/u/${viewer.handle}?tab=saved`);
    await expect(page.getByRole('heading', { name: 'Nothing saved yet' })).toBeVisible();
  });

  test('a failed save rolls back with a message', async ({ page }, testInfo) => {
    await member(page, testInfo);
    const title = unique(testInfo, 'Rollback rug');
    await liveListing(testInfo, title);
    await page.goto(`${LOCAL_URL}/search?q=${encodeURIComponent(title)}`);
    // Server actions are POSTs with a Next-Action header: fail exactly those.
    await page.route('**/*', async (route) => {
      const request = route.request();
      if (request.method() === 'POST' && request.headers()['next-action'] !== undefined) {
        await route.abort('failed');
      } else {
        await route.fallback();
      }
    });
    const save = card(page, title).getByRole('button', { name: `Save ${title}` });
    await save.click();
    await expect(
      page.getByText('Couldn’t save that. Check your connection and try again.'),
    ).toBeVisible();
    await expect(save).toHaveAttribute('aria-pressed', 'false');
    await page.unroute('**/*');
    await page.reload();
    await expect(save).toHaveAttribute('aria-pressed', 'false');
  });

  test('a listing that sells drops out of Saved; sellers get no Save on their own items', async ({
    page,
  }, testInfo) => {
    const viewer = await member(page, testInfo);
    const title = unique(testInfo, 'Teak stool');
    const listing = await liveListing(testInfo, title);
    await page.goto(`${LOCAL_URL}/l/${listing.id}`);
    await toggle(
      page,
      page
        .getByRole('main')
        .getByRole('button', { name: 'Save', exact: true })
        .filter({ visible: true }),
    );
    await page.goto(`${LOCAL_URL}/u/${viewer.handle}?tab=saved`);
    await expect(card(page, title)).toHaveCount(1);
    await localAdmin().from('listings').update({ status: 'sold' }).eq('id', listing.id);
    await page.reload();
    await expect(card(page, title)).toHaveCount(0);

    const ownTitle = unique(testInfo, 'My own bench');
    const own = await seedListing(testInfo, { owner: viewer, title: ownTitle });
    await page.goto(`${LOCAL_URL}/search?q=${encodeURIComponent(ownTitle)}`);
    await expect(card(page, ownTitle)).toHaveCount(1);
    await expect(card(page, ownTitle).getByRole('button', { name: /^Save/ })).toHaveCount(0);
    await page.goto(`${LOCAL_URL}/l/${own.id}`);
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0);
  });
});

test.describe('Profile reports (Brief 03C.2 §4.2)', () => {
  test('a member reports another profile by handle; the report is stored, the id never shown', async ({
    page,
  }, testInfo) => {
    await member(page, testInfo);
    const listing = await liveListing(testInfo, unique(testInfo, 'Reported seller chair'));
    const handle = await handleFor(listing.sellerId);
    await page.goto(`${LOCAL_URL}/u/${handle}`);
    await page.getByRole('button', { name: 'Report profile' }).click();
    const sheet = page.getByRole('dialog', { name: 'Report this profile' });
    await expect(sheet.getByRole('radio')).toHaveCount(5);
    await expect(sheet.getByLabel('It’s counterfeit')).toHaveCount(0);
    await sheet.getByLabel('Harassment or hate').check();
    await sheet.getByRole('button', { name: 'Send report' }).click();
    await expect(page.getByText('Thanks. Our team will review this profile.')).toBeVisible();
    const { data } = await localAdmin()
      .from('reports')
      .select('target_type, reason')
      .eq('target_id', listing.sellerId);
    expect(data).toEqual([{ target_type: 'profile', reason: 'harassment' }]);
    expect(await page.content()).not.toContain(listing.sellerId);
  });

  test('guests get the sign-in sheet; owners see no Report', async ({
    page,
    browser,
  }, testInfo) => {
    const owner = await member(page, testInfo);
    await page.goto(`${LOCAL_URL}/u/${owner.handle}`);
    await expect(page.getByRole('button', { name: 'Report profile' })).toHaveCount(0);
    const guest = await browser.newContext();
    const view = await guest.newPage();
    await view.goto(`${LOCAL_URL}/u/${owner.handle}`);
    await view.getByRole('button', { name: 'Report profile' }).click();
    await expect(view.getByRole('dialog', { name: 'Sign in to report a profile' })).toBeVisible();
    await guest.close();
  });
});
