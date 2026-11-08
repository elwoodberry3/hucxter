import AxeBuilder from '@axe-core/playwright';
import { expect, request, test } from '@playwright/test';
import { deleteE2eUsers, localAdmin, signUpVerified, userIdFor } from './helpers/accounts';
import { deleteSeeded, seedListing } from './helpers/listings';
import type { SeededListing } from './helpers/listings';
import { LOCAL_URL, SERVER_ONLY } from './support';

const seeded: SeededListing[] = [];
const members: string[] = [];
test.afterEach(async () => {
  await deleteSeeded(seeded.splice(0));
  await deleteE2eUsers(members.splice(0));
});

const url = (id: string) => `${LOCAL_URL}/l/${id}`;

test.describe('listing page (Brief 03C.1 §3.4)', () => {
  test('guest: title, price, status, area, details, seller facts; message disabled; no counts or ratings', async ({
    page,
  }, testInfo) => {
    const listing = await seedListing(testInfo, {
      title: 'Oak bookshelf',
      priceCents: 4500,
      description: 'Five shelves.\nSome wear on the top edge. https://example.test',
    });
    seeded.push(listing);
    await page.goto(url(listing.id));
    await expect(page.getByRole('heading', { level: 1, name: 'Oak bookshelf' })).toBeVisible();
    await expect(page.getByText('$45', { exact: true })).toBeVisible();
    await expect(page.getByText('Available', { exact: true })).toBeVisible();
    await expect(
      page.getByText(/^Listed (just now|\d+ minutes? ago) in Portland, OR · <1 mi away$/),
    ).toBeVisible();
    const details = page.getByRole('region', { name: 'Details' });
    await expect(details.getByRole('term').first()).toHaveText('Condition');
    await expect(details.getByRole('definition').first()).toHaveText('Good');
    const seller = page.getByRole('region', { name: 'Seller' });
    await expect(seller).toContainText('Test Seller');
    await expect(seller).toContainText(/Joined [A-Z][a-z]{2} \d{4}/);
    await expect(seller).toContainText('0 items sold');
    // Plain text: line breaks kept, links not linked.
    const description = page.getByRole('region', { name: 'Description' });
    await expect(description.getByRole('link')).toHaveCount(0);
    await expect(description).toContainText('Five shelves.');

    const ask = page.getByRole('button', { name: 'Is this still available?' });
    await expect(ask).toBeDisabled();
    await expect(page.getByText('Messaging arrives in the next QA build')).toBeVisible();
    const main = await page.getByRole('main').innerText();
    expect(main).not.toMatch(/\bviews?\b|\brated\b|\brating|★|followers|likes\b/i);
    await expect(page.getByRole('button', { name: 'Edit' })).toHaveCount(0);
  });

  test('guest: Report and Save open the sign-in sheet', async ({ page }, testInfo) => {
    const listing = await seedListing(testInfo);
    seeded.push(listing);
    await page.goto(url(listing.id));
    const report = page
      .getByRole('main')
      .getByRole('button', { name: 'Report' })
      .filter({ visible: true })
      .first();
    await report.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: 'Sign in to report a listing' })).toBeVisible();
    await page.keyboard.press('Escape');
    // Desktop: the video rail; phones: the sticky action bar.
    const save = page
      .getByRole('main')
      .getByRole('button', { name: 'Save', exact: true })
      .filter({ visible: true });
    await expect(save).toHaveCount(1);
    await save.click();
    await expect(page.getByRole('dialog', { name: 'Sign in to save listings' })).toBeVisible();
    await expect(page.getByText('Saving arrives soon')).toHaveCount(0);
  });

  test('sold stays visible with the Sold badge and no primary action', async ({
    page,
  }, testInfo) => {
    const listing = await seedListing(testInfo, { status: 'sold' });
    seeded.push(listing);
    await page.goto(url(listing.id));
    await expect(page.getByText('Sold', { exact: true })).toBeVisible();
    await expect(page.getByText('This item has sold.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Is this still available?' })).toHaveCount(0);
  });

  test('pending shows "Pending: someone’s on the way"', async ({ page }, testInfo) => {
    const listing = await seedListing(testInfo, { status: 'pending' });
    seeded.push(listing);
    await page.goto(url(listing.id));
    await expect(page.getByText('Pending: someone’s on the way')).toBeVisible();
  });

  test('removed, deleted, in review and unknown listings are 404 for others', async ({
    page,
  }, testInfo) => {
    const removed = await seedListing(testInfo);
    const deleted = await seedListing(testInfo);
    const review = await seedListing(testInfo, { needsReview: true });
    seeded.push(removed, deleted, review);
    const db = localAdmin();
    await db.from('listings').update({ removed_at: new Date().toISOString() }).eq('id', removed.id);
    await db.from('listings').update({ deleted_at: new Date().toISOString() }).eq('id', deleted.id);
    for (const id of [
      removed.id,
      deleted.id,
      review.id,
      '00000000-0000-4000-8000-000000000000',
      'nope',
    ]) {
      const response = await page.goto(url(id));
      expect(response?.status(), id).toBe(404);
    }
  });

  test('D-45: a real drop after 7+ live days shows the struck price with accessible text', async ({
    page,
  }, testInfo) => {
    const dropped = await seedListing(testInfo, {
      priceCents: 5000,
      priceHistory: [{ priceCents: 7500, daysAgo: 20 }],
      priceChangedDaysAgo: 2,
      publishedDaysAgo: 20,
    });
    const tooShort = await seedListing(testInfo, {
      priceCents: 5000,
      priceHistory: [{ priceCents: 7500, daysAgo: 5 }],
      priceChangedDaysAgo: 1,
      publishedDaysAgo: 5,
    });
    seeded.push(dropped, tooShort);
    await page.goto(url(dropped.id));
    await expect(page.getByText('Price dropped')).toBeVisible();
    await expect(page.getByText('Was $75, now $50')).toBeAttached();
    await expect(page.locator('s', { hasText: '$75' })).toBeVisible();
    await page.goto(url(tooShort.id));
    await expect(page.getByText('$50', { exact: true })).toBeVisible();
    await expect(page.getByText('Price dropped')).toHaveCount(0);
  });

  test('phones: price and the primary action are visible without scrolling (320–430 px)', async ({
    page,
  }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith('mobile'), 'phone widths only');
    const listing = await seedListing(testInfo, {
      title: 'A fairly long listing title for a small phone screen',
    });
    seeded.push(listing);
    for (const width of [320, 360, 375, 390, 414, 430]) {
      await page.setViewportSize({ width, height: width < 375 ? 568 : 740 });
      await page.goto(url(listing.id));
      const viewport = page.viewportSize();
      for (const target of [
        page.getByText('$45', { exact: true }),
        page.getByRole('button', { name: 'Is this still available?' }),
      ]) {
        const box = await target.boundingBox();
        expect(box, `${String(width)}px`).not.toBeNull();
        expect((box?.y ?? 0) + (box?.height ?? 0), `${String(width)}px`).toBeLessThanOrEqual(
          viewport?.height ?? 0,
        );
      }
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow, `${String(width)}px horizontal scroll`).toBeLessThanOrEqual(0);
    }
  });

  test('the player loads with no CSP violations and no Cast, Mux Data or other third-party requests', async ({
    page,
  }, testInfo) => {
    const listing = await seedListing(testInfo);
    seeded.push(listing);
    const violations: string[] = [];
    const thirdParty: string[] = [];
    page.on('console', (message) => {
      if (/Content Security Policy|Refused to/i.test(message.text()))
        violations.push(message.text());
    });
    page.on('request', (request) => {
      const host = new URL(request.url()).host;
      if (
        host !== new URL(LOCAL_URL).host &&
        !request.url().startsWith('data:') &&
        !request.url().startsWith('blob:')
      ) {
        thirdParty.push(host);
      }
    });
    await page.goto(url(listing.id));
    const player = page.locator('mux-player');
    await expect(player).toBeAttached();
    // The lazy player upgrades when it scrolls into view; then play it muted.
    await expect
      .poll(() => player.evaluate((element) => (element as HTMLMediaElement).readyState), {
        timeout: 15_000,
      })
      .toBeGreaterThanOrEqual(1);
    await player.evaluate((element) => {
      const media = element as HTMLMediaElement;
      media.muted = true;
      void media.play().catch(() => undefined);
    });
    await expect
      .poll(() => player.evaluate((element) => (element as HTMLMediaElement).currentTime), {
        timeout: 15_000,
      })
      .toBeGreaterThan(0);
    // One player at a time: another player starting (its announcement) pauses this one.
    await player.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('hx:player-play', { detail: document.createElement('mux-player') }),
      );
    });
    await expect
      .poll(() => player.evaluate((element) => (element as HTMLMediaElement).paused))
      .toBe(true);
    await page.waitForTimeout(1500);
    expect(violations).toEqual([]);
    expect(thirdParty).toEqual([]);
  });

  test('CSP: inline styles (Mux Player shadow DOM) only on /l/*; scripts keep the nonce', async ({
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1440', SERVER_ONLY);
    const listing = await seedListing(testInfo);
    seeded.push(listing);
    const policy = (path: string) =>
      request.get(`${LOCAL_URL}${path}`).then((r) => r.headers()['content-security-policy'] ?? '');
    const onListing = await policy(`/l/${listing.id}`);
    expect(onListing).toContain("style-src 'self' 'unsafe-inline'");
    expect(onListing).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
    for (const path of ['/', '/c/home', `/l/${listing.id}/extra`]) {
      const other = await policy(path);
      expect(other, path).toMatch(/style-src 'self' 'nonce-[^']+'/);
      expect(other, path).not.toContain('unsafe-inline');
    }
  });

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`axe: guest listing page (${colorScheme})`, async ({ page }, testInfo) => {
      const listing = await seedListing(testInfo);
      seeded.push(listing);
      await page.emulateMedia({ colorScheme });
      await page.goto(url(listing.id));
      await expect(page.locator('mux-player')).toBeAttached();
      const results = await new AxeBuilder({ page }).exclude('mux-player').analyze();
      const blocking = results.violations.filter(
        (v) => v.impact === 'serious' || v.impact === 'critical',
      );
      expect(
        blocking.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
      ).toEqual([]);
    });
  }

  test('owner: controls and owner-only view count; others never see the count', async ({
    page,
    browser,
  }, testInfo) => {
    const email = await signUpVerified(page, testInfo, { base: LOCAL_URL });
    members.push(email);
    const ownerId = await userIdFor(email);
    const listing = await seedListing(testInfo);
    seeded.push(listing);
    await localAdmin().from('listings').update({ seller_id: ownerId }).eq('id', listing.id);
    await localAdmin()
      .from('listing_media')
      .update({ owner_id: ownerId })
      .eq('listing_id', listing.id);

    // A guest views it (counted once per day), then the owner looks.
    const guest = await browser.newContext();
    const guestPage = await guest.newPage();
    const counted = guestPage.waitForResponse((r) =>
      r.url().endsWith(`/api/listings/${listing.id}/view`),
    );
    await guestPage.goto(url(listing.id));
    expect((await counted).status()).toBe(204);
    await guestPage.reload();
    await expect(guestPage.getByText(/views?/)).toHaveCount(0);
    await guest.close();

    // Brief 03C.1b H3: a scripted beacon without Sec-Fetch-Site (a fresh guest each time) is
    // answered but not counted.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const scripted = await request.newContext();
      const response = await scripted.post(`${LOCAL_URL}/api/listings/${listing.id}/view`, {
        headers: { Origin: LOCAL_URL },
      });
      expect(response.status()).toBe(204);
      await scripted.dispose();
    }

    await page.goto(url(listing.id));
    await expect(page.getByText('1 view')).toBeVisible();
    await expect(page.getByText('only you can see this')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Edit' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Is this still available?' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Mark pending' }).click();
    await expect(page.getByText('Pending: someone’s on the way')).toBeVisible();
    await page.getByRole('button', { name: 'They didn’t show' }).click();
    await expect(page.getByText('Available', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Mark sold' }).click();
    await expect(page.getByText('Sold', { exact: true })).toBeVisible();
    const history = await localAdmin()
      .from('listing_status_history')
      .select('status')
      .eq('listing_id', listing.id)
      .order('id');
    expect((history.data as { status: string }[]).map((r) => r.status).slice(-3)).toEqual([
      'pending',
      'available',
      'sold',
    ]);
    // The owner's own views are never counted.
    await page.reload();
    await expect(page.getByText('1 view')).toBeVisible();
  });
});
