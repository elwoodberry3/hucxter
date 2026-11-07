import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import type { BrowserContext, Page, TestInfo } from '@playwright/test';
import { FAKE_VIDEO } from './fixtures/fake-video';
import {
  deleteE2eUsers,
  handleFor,
  localAdmin,
  signInWithEmail,
  signUpVerified,
  userIdFor,
} from './helpers/accounts';
import { deleteSeeded, seedListing } from './helpers/listings';
import type { SeededListing } from './helpers/listings';
import { LOCAL_URL, viewFrom } from './support';

/** PR screenshots (CI uploads apps/web/test-results/screenshots). */
const shot = (name: string, fullPage = false) => ({
  path: `test-results/screenshots/${name}.png`,
  fullPage,
});
const SCHEMES = ['light', 'dark'] as const;

const seeded: SeededListing[] = [];
const members: string[] = [];
test.afterEach(async () => {
  await deleteSeeded(seeded.splice(0));
  await deleteE2eUsers(members.splice(0));
});

/**
 * Brief 03C.1 set: sell steps, listing page (guest, owner, sold), storefront with real listings,
 * My Listings and the admin queue. Local e2e fixtures only (fake video provider on :3103), in
 * their own area so listings other specs seed in parallel don't show up: Portland, ME for the
 * desktop set and Minneapolis for the phone set (the two sets run in parallel too).
 */
const SHOT_ZIPS = { '1440': '04101', '390': '55401' } as const;
const SHOT_LISTINGS = [
  { title: 'Oak bookshelf', priceCents: 4500, categorySlug: 'furniture' },
  { title: 'Brass floor lamp', priceCents: 2800, categorySlug: 'lighting' },
  { title: 'Kids’ bike, 16 inch', priceCents: 0, categorySlug: 'furniture' },
  { title: 'Phone, 128 GB', priceCents: 15000, categorySlug: 'phones-tablets' },
  { title: 'Walnut side table', priceCents: 6000, categorySlug: 'furniture' },
] as const;

async function capture3c1(
  page: Page,
  context: BrowserContext,
  testInfo: TestInfo,
  size: keyof typeof SHOT_ZIPS,
) {
  const SHOT_ZIP = SHOT_ZIPS[size];
  const email = await signUpVerified(page, testInfo, { base: LOCAL_URL, zip: SHOT_ZIP });
  members.push(email);
  const owner = { id: await userIdFor(email), email };
  for (const listing of SHOT_LISTINGS) {
    seeded.push(await seedListing(testInfo, { ...listing, zip: SHOT_ZIP }));
  }
  const sold = await seedListing(testInfo, {
    title: 'Mid-size desk',
    priceCents: 7000,
    zip: SHOT_ZIP,
    status: 'sold',
  });
  seeded.push(sold);
  const held = await seedListing(testInfo, {
    title: 'Air rifle',
    zip: SHOT_ZIP,
    needsReview: true,
  });
  seeded.push(held);
  await viewFrom(context, SHOT_ZIP);

  // Sell steps (the review step while the video is still processing, then ready).
  await context.addCookies([
    { name: 'hx_fake_video', value: 'slow', domain: 'localhost', path: '/' },
  ]);
  for (const scheme of SCHEMES) {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await page.goto(`${LOCAL_URL}/sell`);
    await ready(page);
    await page.screenshot(shot(`${size}-sell-video-${scheme}`));
  }
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.getByTestId('choose-video').setInputFiles(FAKE_VIDEO);
  await expect(page.getByRole('heading', { name: 'Describe it' })).toBeVisible();
  const draftUrl = page.url();
  await page.getByLabel('Title').fill('Rattan armchair');
  await page.getByLabel('Category', { exact: true }).selectOption({ label: 'Home & Living' });
  await page.getByLabel('Subcategory').selectOption({ index: 1 });
  await page.getByLabel('Condition').selectOption('like_new');
  await page.getByLabel('Price').fill('85');
  await page.getByLabel(/Description/).fill('Light wear on one arm. Cushion included.');
  for (const scheme of SCHEMES) {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await page.screenshot(shot(`${size}-sell-details-${scheme}`, true));
  }
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Review and publish' })).toBeVisible();
  for (const scheme of SCHEMES) {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await page.screenshot(shot(`${size}-sell-review-processing-${scheme}`, true));
  }
  const listingId = /draft=([0-9a-f-]{36})/.exec(draftUrl)?.[1] ?? '';
  const media = await localAdmin()
    .from('listing_media')
    .select('id')
    .eq('listing_id', listingId)
    .single();
  await page.request.post(
    `${LOCAL_URL}/api/dev/fake-video/ready/${(media.data as { id: string }).id}`,
    { headers: { Origin: LOCAL_URL } },
  );
  await page.reload();
  await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeVisible();
  for (const scheme of SCHEMES) {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await page.screenshot(shot(`${size}-sell-review-ready-${scheme}`, true));
  }
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(page).toHaveURL(`${LOCAL_URL}/l/${listingId}`);

  // Listing page: owner, then guest and sold (a fresh context with no session).
  for (const scheme of SCHEMES) {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await page.goto(`${LOCAL_URL}/l/${listingId}`);
    await ready(page);
    await page.screenshot(shot(`${size}-listing-owner-${scheme}`));
    await page.goto(`${LOCAL_URL}/profile`);
    await ready(page);
    await page.screenshot(shot(`${size}-profile-owner-${scheme}`, true));
  }
  const guestContext = await page
    .context()
    .browser()
    ?.newContext({
      viewport: page.viewportSize(),
      ...(testInfo.project.use.isMobile === true ? { isMobile: true, hasTouch: true } : {}),
    });
  if (guestContext === undefined) throw new Error('no browser');
  await viewFrom(guestContext, SHOT_ZIP);
  const guest = await guestContext.newPage();
  for (const scheme of SCHEMES) {
    await guest.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await guest.goto(`${LOCAL_URL}/l/${listingId}`);
    await ready(guest);
    await guest.screenshot(shot(`${size}-listing-guest-real-${scheme}`));
    await guest.goto(`${LOCAL_URL}/l/${sold.id}`);
    await ready(guest);
    await guest.screenshot(shot(`${size}-listing-sold-${scheme}`));
    await guest.goto(`${LOCAL_URL}/`);
    await ready(guest);
    await guest.screenshot(shot(`${size}-storefront-home-${scheme}`, true));
    await guest.goto(`${LOCAL_URL}/c/home`);
    await ready(guest);
    await guest.screenshot(shot(`${size}-storefront-category-${scheme}`));
  }
  await guestContext.close();

  // Admin queue (the member becomes a moderator for this shot).
  await localAdmin().from('app_roles').insert({ user_id: owner.id, role: 'moderator' });
  for (const scheme of SCHEMES) {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await page.goto(`${LOCAL_URL}/admin`);
    await ready(page);
    await page.screenshot(shot(`${size}-admin-${scheme}`, true));
  }
}

/**
 * Brief 03C.2 set: profiles (owner empty, owner with listings, Saved, public, public empty),
 * settings panes, the member menu, a profile report in /admin and the /welcome reset step. Own
 * areas again (Manchester, NH and Milwaukee) so the 3C.1 storefront shots stay unaffected.
 */
const SHOT_ZIPS_3C2 = { '1440': '03101', '390': '53202' } as const;
const AVATAR_PHOTO = fileURLToPath(new URL('fixtures/avatar/gps.jpg', import.meta.url));

async function capture3c2(
  page: Page,
  context: BrowserContext,
  testInfo: TestInfo,
  size: keyof typeof SHOT_ZIPS_3C2,
) {
  const zip = SHOT_ZIPS_3C2[size];
  const db = localAdmin();
  // Reload per scheme: WebKit doesn't fully repaint some text when the scheme flips in place.
  // `open` re-opens a menu or sheet after the reload.
  const shoot = async (
    target: Page,
    name: string,
    fullPage = false,
    open?: () => Promise<void>,
  ) => {
    for (const scheme of SCHEMES) {
      await target.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      await target.reload();
      await ready(target);
      await target.waitForLoadState('networkidle');
      await open?.();
      await target.screenshot(shot(`${size}-${name}-${scheme}`, fullPage));
    }
  };
  const visit = async (target: Page, path: string) => {
    await target.goto(`${LOCAL_URL}${path}`);
    await ready(target);
    await target.waitForLoadState('networkidle');
  };

  const email = await signUpVerified(page, testInfo, { base: LOCAL_URL, zip, name: 'Avery' });
  members.push(email);
  const owner = { id: await userIdFor(email), email };
  const handle = await handleFor(owner.id);
  await viewFrom(context, zip);

  // A new member's own profile: the empty state.
  await visit(page, `/u/${handle}`);
  await shoot(page, 'profile-owner-empty', true);

  // Settings panes (with a photo and a bio).
  await visit(page, '/settings/profile');
  await page
    .getByRole('region', { name: 'Profile photo' })
    .getByLabel('Add photo')
    .setInputFiles(AVATAR_PHOTO);
  await expect(page.getByText('Photo updated')).toBeVisible();
  // The photo shows once the refresh has finished; navigating earlier gets redirected by it.
  await expect(page.getByRole('region', { name: 'Profile photo' }).locator('img')).toBeVisible();
  await page.waitForLoadState('networkidle');
  await db
    .from('profiles')
    .update({ bio: 'Mid-century lamps and furniture.\nPickup in the evenings.' })
    .eq('id', owner.id);
  await visit(page, '/settings');
  await shoot(page, 'settings-index', true);
  await visit(page, '/settings/profile');
  await shoot(page, 'settings-profile', true);
  await visit(page, '/settings/account');
  await shoot(page, 'settings-account', true);

  // The owner's profile with listings in every state, then Saved.
  for (const listing of [
    { title: 'Teak sideboard', priceCents: 32000, categorySlug: 'furniture' },
    { title: 'Arc floor lamp', priceCents: 9000, categorySlug: 'lighting' },
    { title: 'Rattan chair', priceCents: 4000, categorySlug: 'furniture' },
  ]) {
    seeded.push(await seedListing(testInfo, { ...listing, zip, owner }));
  }
  seeded.push(
    await seedListing(testInfo, { title: 'Desk lamp', zip, owner, status: 'sold' }),
    await seedListing(testInfo, { title: 'Pellet gun', zip, owner, needsReview: true }),
    await seedListing(testInfo, { title: 'Bookcase', zip, owner, stage: 'draft' }),
  );
  const other = await seedListing(testInfo, { title: 'Walnut stool', priceCents: 5500, zip });
  seeded.push(other);
  await db.from('saved_listings').insert({ user_id: owner.id, listing_id: other.id });
  await visit(page, `/u/${handle}`);
  await shoot(page, 'profile-owner', true);
  await visit(page, `/u/${handle}?tab=saved`);
  await shoot(page, 'profile-owner-saved', true);

  // Member menu (desktop popover; phones use the Account tab, shown on the profile shots).
  if (size === '1440') {
    await visit(page, '/');
    await shoot(page, 'member-menu', false, async () => {
      await page.getByRole('button', { name: /^Account menu/ }).click();
      await expect(page.getByRole('link', { name: /^View profile/ })).toBeVisible();
    });
    await page.keyboard.press('Escape');
  }

  // A second member (empty public profile) seen by a guest, and Avery's public profile.
  const otherContext = await page
    .context()
    .browser()
    ?.newContext({
      viewport: page.viewportSize(),
      ...(testInfo.project.use.isMobile === true ? { isMobile: true, hasTouch: true } : {}),
    });
  if (otherContext === undefined) throw new Error('no browser');
  const second = await otherContext.newPage();
  const secondEmail = await signUpVerified(second, testInfo, {
    base: LOCAL_URL,
    slot: 1,
    label: 'rk',
    zip,
    name: 'Rowan',
  });
  members.push(secondEmail);
  const secondId = await userIdFor(secondEmail);
  const secondHandle = await handleFor(secondId);
  await otherContext.clearCookies();
  await viewFrom(otherContext, zip);
  await visit(second, `/u/${handle}`);
  await shoot(second, 'profile-public', true);
  await visit(second, `/u/${secondHandle}`);
  await shoot(second, 'profile-public-empty', true);

  // A profile report in /admin, and its reset sheet (Avery is made a moderator for this).
  await db.from('app_roles').insert({ user_id: owner.id, role: 'moderator' });
  const report = await db
    .from('reports')
    .insert({
      reporter_id: null,
      target_type: 'profile',
      target_id: secondId,
      reason: 'other',
      note: 'Name looks like a staff account.',
    })
    .select('id')
    .single();
  const reportId: unknown = (report.data as Record<string, unknown> | null)?.id;
  if (typeof reportId !== 'string') throw new Error('could not open a report');
  await visit(page, '/admin');
  await shoot(page, 'admin-profile-report', true);
  const sheet = page.getByRole('dialog', { name: 'Require a new name and handle?' });
  await shoot(page, 'admin-require-new-name', false, async () => {
    await page
      .getByRole('region', { name: 'Open reports' })
      .getByRole('listitem')
      .filter({ hasText: `@${secondHandle}` })
      .getByRole('button', { name: 'Require new name & handle' })
      .click();
    await sheet
      .getByLabel('Reason for the audit log (required)')
      .fill('Looks like a staff account');
  });
  await sheet.getByRole('button', { name: 'Require new name & handle' }).click();
  await expect(page.getByText('Name and handle reset.')).toBeVisible();

  // Rowan signs in again and must choose a new name and handle.
  await second.goto(`${LOCAL_URL}/sign-in?next=%2Fsell`);
  await signInWithEmail(second, secondEmail);
  await expect(second).toHaveURL(/\/welcome/);
  await ready(second);
  await shoot(second, 'welcome-reset', true);
  await otherContext.close();
  await db.from('reports').delete().eq('id', reportId);
}

async function ready(page: Page) {
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  // Listing pages: let the lazy player upgrade and show its poster before the shot.
  const player = page.locator('mux-player');
  if ((await player.count()) > 0) {
    await expect
      .poll(() => player.evaluate((element) => (element as HTMLMediaElement).readyState), {
        timeout: 10_000,
      })
      .toBeGreaterThanOrEqual(1);
    await page.waitForTimeout(500);
  }
}

test.describe('screenshots', () => {
  // Capture settled states (no sheet/carousel animation mid-flight).
  test.use({ reducedMotion: 'reduce' });

  test('desktop 1440: home, category, mega menu, listing page, sign-in sheet', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1440', 'one desktop set, at 1440×900');
    const listing = await seedListing(testInfo);
    seeded.push(listing);
    for (const scheme of SCHEMES) {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      await page.goto('/');
      await ready(page);
      await page.screenshot(shot(`1440-home-${scheme}`));
      await page.screenshot(shot(`1440-home-${scheme}-full`, true));
      await page.goto('/c/sports-outdoors/bikes');
      await ready(page);
      await page.screenshot(shot(`1440-category-${scheme}`));
      await page.goto('/');
      await page.getByRole('button', { name: 'All Categories' }).click();
      await page
        .getByRole('dialog', { name: 'All categories' })
        .getByRole('tab', { name: 'Sports & Outdoors' })
        .hover();
      await page.screenshot(shot(`1440-mega-menu-${scheme}`));
      // :3103 plays the local test video (fake provider).
      await page.goto(`${LOCAL_URL}/l/${listing.id}`);
      await ready(page);
      await page.screenshot(shot(`1440-listing-guest-${scheme}`));
    }
    await page.emulateMedia({ colorScheme: 'light' });
    await page.getByRole('button', { name: 'Report' }).filter({ visible: true }).click();
    await page.screenshot(shot('1440-sign-in-sheet-light'));
  });

  test('desktop 1280: home', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1280', 'one 1280×800 check');
    await page.goto('/');
    await ready(page);
    await page.screenshot(shot('1280-home-light'));
  });

  test('phone 390: home, category with FilterDrawer, all-categories sheet, listing page', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'mobile-webkit',
      'one phone set (iPhone 15 profile at 390 px)',
    );
    await page.setViewportSize({ width: 390, height: 844 });
    const listing = await seedListing(testInfo);
    seeded.push(listing);
    for (const scheme of SCHEMES) {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      await page.goto('/');
      await ready(page);
      await page.screenshot(shot(`390-home-${scheme}`));
      await page.screenshot(shot(`390-home-${scheme}-full`, true));
      await page.goto('/c/sports-outdoors/bikes');
      await page.getByRole('button', { name: /^Filters/ }).click();
      await expect(page.getByRole('dialog', { name: 'Filters' })).toBeVisible();
      await page.screenshot(shot(`390-category-filters-${scheme}`));
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'All', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'All categories' })).toBeVisible();
      await page.screenshot(shot(`390-all-categories-${scheme}`));
      await page.keyboard.press('Escape');
      await page.goto(`${LOCAL_URL}/l/${listing.id}`);
      await ready(page);
      await page.screenshot(shot(`390-listing-guest-${scheme}`));
    }
  });

  test('phone 393×659 (iPhone 15): listing page above the fold', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-webkit', 'iPhone 15 viewport only');
    const listing = await seedListing(testInfo);
    seeded.push(listing);
    for (const scheme of SCHEMES) {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      await page.goto(`${LOCAL_URL}/l/${listing.id}`);
      await ready(page);
      await page.screenshot(shot(`393x659-listing-guest-${scheme}`));
    }
  });

  test('Android 412 (Pixel 7): home', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chromium', 'one Android check');
    await page.goto('/');
    await ready(page);
    await page.screenshot(shot('pixel7-home-light'));
  });

  test('3C.1 at 1440: sell steps, listing (guest, owner, sold), storefront, My Listings, admin', async ({
    page,
    context,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1440', 'one desktop set, at 1440×900');
    test.setTimeout(180_000);
    await capture3c1(page, context, testInfo, '1440');
  });

  test('3C.1 at 390: sell steps, listing (guest, owner, sold), storefront, My Listings, admin', async ({
    page,
    context,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'mobile-webkit',
      'one phone set (iPhone 15 profile at 390 px)',
    );
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await capture3c1(page, context, testInfo, '390');
  });

  test('3C.2 at 1440: profiles, settings, member menu, profile report, reset step', async ({
    page,
    context,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1440', 'one desktop set, at 1440×900');
    test.setTimeout(180_000);
    await capture3c2(page, context, testInfo, '1440');
  });

  test('3C.2 at 390: profiles, settings, profile report, reset step', async ({
    page,
    context,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'mobile-webkit',
      'one phone set (iPhone 15 profile at 390 px)',
    );
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await capture3c2(page, context, testInfo, '390');
  });
});
