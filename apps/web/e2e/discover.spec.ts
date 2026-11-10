import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { localAdmin } from './helpers/accounts';
import {
  FAR_TOWN,
  activeId,
  activeItem,
  openFeed,
  players,
  seedFeed,
  sheet,
  town,
} from './helpers/discover';
import { deleteSeeded, seedListing } from './helpers/listings';
import type { SeededListing } from './helpers/listings';
import { EMPTY_AREA, LOCAL_URL, SERVER_ONLY, viewFrom } from './support';

// Discover feed (Brief 03 Milestone 3D), on the fake-video server (helpers/discover.ts).
const seeded: SeededListing[] = [];
test.afterEach(async () => {
  await deleteSeeded(seeded.splice(0));
});

test.describe('Discover feed (Brief 03 3D)', () => {
  test('keyboard only: shortcuts move through the feed, the sheet opens and returns focus', async ({
    page,
    browserName,
  }, testInfo) => {
    // Safari's Tab moves between fields only; Option+Tab reaches every control.
    const tab = browserName === 'webkit' ? 'Alt+Tab' : 'Tab';
    const ids = await seedFeed(testInfo, town(1, testInfo), 3, seeded);
    await openFeed(page, town(1, testInfo));
    // Tab into the feed region (no mouse).
    for (let i = 0; i < 80; i += 1) {
      await page.keyboard.press(tab);
      const inFeed = await page.evaluate(
        () => document.activeElement?.closest('[role="feed"]') !== null,
      );
      if (inFeed) break;
    }
    expect(
      await page.evaluate(() => document.activeElement?.closest('[role="feed"]') !== null),
    ).toBe(true);

    await page.keyboard.press('j');
    await expect.poll(() => activeId(page)).toBe(ids[1]);
    await expect(page).toHaveURL(new RegExp(`l=${ids[1] ?? ''}`));
    expect(await page.evaluate(() => document.activeElement?.getAttribute('data-id'))).toBe(ids[1]);
    await page.keyboard.press('ArrowDown');
    await expect.poll(() => activeId(page)).toBe(ids[2]);
    await page.keyboard.press('k');
    await expect.poll(() => activeId(page)).toBe(ids[1]);

    // Tab to Details on the active item, open with Enter, close with Esc: focus comes back.
    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press(tab);
      const onDetails = await page.evaluate(
        () => document.activeElement?.hasAttribute('data-feed-details') === true,
      );
      if (onDetails) break;
    }
    await page.keyboard.press('Enter');
    await expect(sheet(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(sheet(page)).toBeHidden();
    expect(
      await page.evaluate(() => document.activeElement?.hasAttribute('data-feed-details') === true),
    ).toBe(true);

    // S saves; a guest gets the sign-in sheet.
    await page.keyboard.press('s');
    await expect(page.getByText('Sign in to save listings')).toBeVisible();
  });

  test('typing j, k and s in the search field never moves or acts on the feed', async ({
    page,
  }, testInfo) => {
    const ids = await seedFeed(testInfo, town(2, testInfo), 3, seeded);
    await openFeed(page, town(2, testInfo));
    await expect.poll(() => activeId(page)).toBe(ids[0]);
    const field = page.getByRole('banner').getByRole('searchbox');
    if (await field.isVisible()) {
      await field.click();
    } else {
      await page
        .getByRole('banner')
        .getByRole('button', { name: /search/i })
        .click();
      await page.getByRole('dialog').getByRole('searchbox').click();
    }
    await page.keyboard.type('jks');
    await page.waitForTimeout(800);
    expect(await activeId(page)).toBe(ids[0]);
    await expect(page.getByText('Sign in to save listings')).toBeHidden();
    expect(await page.evaluate(() => (document.activeElement as HTMLInputElement).value)).toBe(
      'jks',
    );
  });

  test('only one video plays, at most two players hold a source, nothing plays off-screen', async ({
    page,
  }, testInfo) => {
    const violations: string[] = [];
    page.on('console', (message) => {
      if (/Content Security Policy|Refused to/i.test(message.text()))
        violations.push(message.text());
    });
    await seedFeed(testInfo, town(3, testInfo), 4, seeded);
    await openFeed(page, town(3, testInfo));
    await expect
      .poll(async () => (await players(page)).filter((p) => !p.paused).length, { timeout: 20_000 })
      .toBe(1);
    await page.getByRole('button', { name: 'Next video' }).click();
    await page.getByRole('button', { name: 'Next video' }).click();
    await expect
      .poll(
        async () => {
          const list = await players(page);
          const playing = list.filter((p) => !p.paused);
          return {
            playing: playing.length,
            playingIsActive: playing.every((p) => p.active),
            withSource: list.filter((p) => p.hasSource).length <= 2,
          };
        },
        { timeout: 20_000 },
      )
      .toEqual({ playing: 1, playingIsActive: true, withSource: true });
    const offScreenAudible = (await players(page)).filter(
      (p) => !p.active && !p.paused && !p.muted,
    );
    expect(offScreenAudible).toEqual([]);
    expect(violations).toEqual([]);
  });

  test('a hidden tab pauses the video and it does not resume on its own', async ({
    page,
  }, testInfo) => {
    await seedFeed(testInfo, town(4, testInfo), 2, seeded);
    await openFeed(page, town(4, testInfo));
    const player = activeItem(page).locator('mux-player');
    await expect
      .poll(() => player.evaluate((element) => (element as HTMLMediaElement).paused), {
        timeout: 20_000,
      })
      .toBe(false);
    // Playwright can't background a tab; simulate the Page Visibility change.
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'hidden',
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect
      .poll(() => player.evaluate((element) => (element as HTMLMediaElement).paused))
      .toBe(true);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'visible',
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(800);
    expect(await player.evaluate((element) => (element as HTMLMediaElement).paused)).toBe(true);
  });

  test('?l= starts at that item and reload restores it, with Back to newest', async ({
    page,
  }, testInfo) => {
    const ids = await seedFeed(testInfo, town(5, testInfo), 3, seeded);
    await openFeed(page, town(5, testInfo), `?l=${ids[2] ?? ''}`);
    await expect.poll(() => activeId(page)).toBe(ids[2]);
    await page.reload();
    await expect.poll(() => activeId(page)).toBe(ids[2]);
    await expect(page).toHaveURL(new RegExp(`l=${ids[2] ?? ''}`));
    await page.getByRole('link', { name: 'Back to newest' }).click();
    await expect.poll(() => activeId(page)).toBe(ids[0]);
  });

  test('a link to an item outside the feed starts at the newest and links to the listing', async ({
    page,
  }, testInfo) => {
    const [local] = await seedFeed(testInfo, town(6, testInfo), 1, seeded);
    const far = await seedListing(testInfo, { zip: FAR_TOWN, title: 'Far lamp' });
    seeded.push(far);
    await openFeed(page, town(6, testInfo), `?l=${far.id}`);
    await expect(page.getByText('That video isn’t in your feed.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'View the listing' })).toHaveAttribute(
      'href',
      `/l/${far.id}`,
    );
    await expect.poll(() => activeId(page)).toBe(local);
  });

  test('an item that leaves the feed mid-session shows "no longer available"; Next still works', async ({
    page,
  }, testInfo) => {
    const ids = await seedFeed(testInfo, town(7, testInfo), 5, seeded);
    await openFeed(page, town(7, testInfo));
    await expect.poll(() => activeId(page)).toBe(ids[0]);
    const { error } = await localAdmin()
      .from('listings')
      .update({ status: 'sold' })
      .eq('id', ids[3]);
    expect(error).toBeNull();
    const next = page.getByRole('button', { name: 'Next video' });
    for (const id of ids.slice(1, 4)) {
      await next.click();
      await expect.poll(() => activeId(page)).toBe(id);
    }
    const gone = activeItem(page);
    await expect(gone.getByText('This item is no longer available')).toBeVisible();
    await expect(gone.locator('mux-player')).toHaveCount(0);
    await expect(gone.getByRole('button', { name: 'Try again' })).toHaveCount(0);
    await next.click();
    await expect.poll(() => activeId(page)).toBe(ids[4]);
  });

  test('empty area: "No videos near {area} yet." with Sell something and Widen your radius', async ({
    page,
    context,
  }) => {
    await viewFrom(context, EMPTY_AREA.zip, 25);
    await page.goto(`${LOCAL_URL}/discover`);
    await expect(
      page.getByRole('heading', { name: `No videos near ${EMPTY_AREA.label} yet.` }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sell something' })).toHaveAttribute(
      'href',
      '/sell',
    );
    await page.getByRole('button', { name: 'Widen your radius to 50 mi' }).click();
    await expect(page.getByRole('button', { name: 'Widen your radius to 100 mi' })).toBeVisible();
    const cookie = (await context.cookies()).find((c) => c.name === 'hx_loc');
    expect(cookie?.value).toBe(`${EMPTY_AREA.zip}.50`);
  });

  test.describe('reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });

    test('no autoplay; tapping Play still plays', async ({ page }, testInfo) => {
      await seedFeed(testInfo, town(8, testInfo), 2, seeded);
      await openFeed(page, town(8, testInfo));
      const play = activeItem(page).getByRole('button', { name: 'Play Feed lamp 1' });
      await expect(play).toContainText('Play', { timeout: 20_000 });
      const player = activeItem(page).locator('mux-player');
      expect(await player.evaluate((element) => (element as HTMLMediaElement).paused)).toBe(true);
      await play.click();
      await expect
        .poll(() => player.evaluate((element) => (element as HTMLMediaElement).paused), {
          timeout: 15_000,
        })
        .toBe(false);
    });
  });

  test('blocked autoplay shows "Tap to play"', async ({ page }, testInfo) => {
    await page.addInitScript(() => {
      HTMLMediaElement.prototype.play = () =>
        Promise.reject(new DOMException('Autoplay is not allowed', 'NotAllowedError'));
    });
    await seedFeed(testInfo, town(9, testInfo), 1, seeded);
    await openFeed(page, town(9, testInfo));
    await expect(activeItem(page).getByText('Tap to play')).toBeVisible({ timeout: 20_000 });
  });

  test('desktop: a centred 9:16 column with the actions beside it, not over it', async ({
    page,
  }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith('desktop'), 'desktop layout');
    await seedFeed(testInfo, town(10, testInfo), 1, seeded);
    await openFeed(page, town(10, testInfo));
    const video = await activeItem(page).locator('[class*="video"]').first().boundingBox();
    const rail = await activeItem(page).getByRole('group').boundingBox();
    if (video === null || rail === null) throw new Error('no layout boxes');
    expect(video.width / video.height).toBeCloseTo(9 / 16, 1);
    expect(rail.x).toBeGreaterThanOrEqual(video.x + video.width);
    const viewport = page.viewportSize();
    const centre = video.x + video.width / 2;
    expect(Math.abs(centre - (viewport?.width ?? 0) / 2)).toBeLessThan(80);
  });

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`axe: feed and details sheet (${colorScheme})`, async ({ page }, testInfo) => {
      await seedFeed(testInfo, town(11, testInfo), 2, seeded);
      await page.emulateMedia({ colorScheme });
      await openFeed(page, town(11, testInfo));
      const blocking = async () => {
        const results = await new AxeBuilder({ page }).exclude('mux-player').analyze();
        return results.violations
          .filter((v) => v.impact === 'serious' || v.impact === 'critical')
          .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
      };
      expect(await blocking()).toEqual([]);
      await activeItem(page)
        .getByRole('button', { name: /^Details for/ })
        .click();
      await expect(sheet(page).getByText('Phone verified')).toBeVisible();
      expect(await blocking()).toEqual([]);
      await sheet(page).getByRole('button', { name: 'Expand' }).click();
      expect(await blocking()).toEqual([]);
    });
  }
});

test.describe('Discover events and CSP (3D)', () => {
  test.beforeEach(({ isMobile, viewport }) => {
    test.skip(isMobile || viewport?.width !== 1440, SERVER_ONLY);
  });

  test('item beacons count once, same-origin only', async ({ request }, testInfo) => {
    const listing = await seedListing(testInfo, { zip: town(12, testInfo) });
    seeded.push(listing);
    const send = (site: string) =>
      request.post(`${LOCAL_URL}/api/discover/view`, {
        headers: { Origin: LOCAL_URL, 'Sec-Fetch-Site': site, 'Content-Type': 'application/json' },
        data: { listingId: listing.id },
      });
    expect((await send('cross-site')).status()).toBe(204);
    const count = async () => {
      const { count: rows } = await localAdmin()
        .from('events')
        .select('id', { count: 'exact', head: true })
        .eq('name', 'discover_item_viewed')
        .eq('listing_id', listing.id);
      return rows;
    };
    expect(await count()).toBe(0);
    expect((await send('same-origin')).status()).toBe(204);
    expect((await send('same-origin')).status()).toBe(204);
    expect(await count()).toBe(1);
    const other = await request.post(`${LOCAL_URL}/api/discover/view`, {
      headers: { Origin: 'https://evil.example', 'Sec-Fetch-Site': 'cross-site' },
      data: {},
    });
    expect(other.status()).toBe(403);
  });

  test('CSP: /discover allows inline styles for Mux Player; scripts keep the nonce', async ({
    request,
  }) => {
    const policy = (path: string) =>
      request.get(`${LOCAL_URL}${path}`).then((r) => r.headers()['content-security-policy'] ?? '');
    const feed = await policy('/discover');
    expect(feed).toContain("style-src 'self' 'unsafe-inline'");
    expect(feed).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
    for (const path of ['/', '/discover/extra', '/search']) {
      expect(await policy(path), path).not.toContain('unsafe-inline');
    }
  });

  test('item details are private, no-store JSON; a missing item is 404', async ({
    request,
  }, testInfo) => {
    const listing = await seedListing(testInfo, { zip: town(12, testInfo) });
    seeded.push(listing);
    const ok = await request.get(`${LOCAL_URL}/api/discover/items/${listing.id}`, {
      headers: { 'Sec-Fetch-Site': 'same-origin' },
    });
    expect(ok.status()).toBe(200);
    expect(ok.headers()['cache-control']).toBe('private, no-store');
    const body = (await ok.json()) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(['detail', 'own', 'rows', 'saved', 'source']);
    expect(JSON.stringify(body)).not.toMatch(/pickup_zip|lat|lng|email|phone"/);
    const missing = await request.get(
      `${LOCAL_URL}/api/discover/items/00000000-0000-4000-8000-000000000000`,
    );
    expect(missing.status()).toBe(404);
  });
});
