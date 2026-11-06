import { HealthResponse } from '@hucxter/contracts';
import { expect, test } from '@playwright/test';
import { DESKTOP_ONLY, EMPTY_AREA, viewFrom } from './support';

test.describe('storefront shell', () => {
  test('has no app sidebar and exactly one search field', async ({ page, isMobile }) => {
    test.skip(isMobile, DESKTOP_ONLY);
    for (const path of ['/', '/c/home', '/search?q=lamp', '/sign-in']) {
      await page.goto(path);
      await expect(page.getByRole('navigation', { name: 'Primary' })).toHaveCount(0);
      await expect(page.getByRole('searchbox')).toHaveCount(1);
    }
  });

  test('header: logo, location, search, Sell, Messages, Sign in', async ({ page, isMobile }) => {
    test.skip(isMobile, DESKTOP_ONLY);
    await page.goto('/c/home');
    const header = page.getByRole('banner');
    await expect(header.getByRole('link', { name: 'Hucxter' })).toHaveAttribute('href', '/');
    await expect(header.getByRole('button', { name: /Near Portland 97205\?/ })).toBeVisible();
    await expect(header.getByRole('searchbox', { name: 'Search Hucxter' })).toHaveAttribute(
      'placeholder',
      'Search Hucxter',
    );
    await expect(header.getByRole('link', { name: 'Sell' })).toBeVisible();
    await expect(header.getByRole('link', { name: 'Messages' })).toBeVisible();
    await expect(header.getByRole('button', { name: 'Sign in' })).toBeVisible();
  });

  test('category bar follows the taxonomy order and marks the active department', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, DESKTOP_ONLY);
    await page.goto('/c/sports-outdoors/bikes');
    const bar = page.getByRole('navigation', { name: 'Categories', exact: true });
    await expect(bar.getByRole('link')).toHaveText([
      'Electronics',
      'Home & Living',
      'Fashion',
      'Sports & Outdoors',
      'Tools',
      'Baby & Kids',
      'Free Stuff',
    ]);
    await expect(bar.getByRole('link', { name: 'Sports & Outdoors' })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  test('home looks complete with zero listings and never shows fake ones', async ({
    page,
    context,
  }) => {
    await viewFrom(context, EMPTY_AREA.zip);
    await page.goto('/');
    await expect(page).toHaveTitle('Hucxter');
    await expect(page.getByRole('region', { name: 'Featured' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Shop by category' })).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Shop by category' }).getByRole('listitem'),
    ).toHaveCount(14);
    await expect(page.getByRole('heading', { name: `New near ${EMPTY_AREA.label}` })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: `Free stuff near ${EMPTY_AREA.label}` }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Be the first/ }).first()).toBeVisible();
    const promo = page.getByRole('complementary', { name: 'Promoted by Hucxter' });
    await expect(promo).toBeVisible();
    await expect(promo).toContainText('Promoted by Hucxter');
    await expect(page.getByRole('heading', { name: 'Meet in public, every time' })).toBeVisible();
    // No listing cards anywhere, and no inventory-size or rating claims.
    await expect(page.locator('main article')).toHaveCount(0);
    await expect(page.locator('main')).not.toContainText(
      /millions?|thousands of|\d+\+? listings|★/i,
    );
  });

  test('footer has every column and the legal row', async ({ page, isMobile }) => {
    test.skip(isMobile, DESKTOP_ONLY);
    await page.goto('/');
    const footer = page.getByRole('contentinfo');
    for (const heading of ['Shop', 'Sell', 'Safety & Help', 'Company']) {
      await expect(footer.getByRole('heading', { name: heading })).toBeVisible();
    }
    await expect(
      footer.getByRole('heading', { name: 'Shop' }).locator('..').getByRole('link'),
    ).toHaveCount(14);
    for (const link of ['Terms', 'Privacy', 'Prohibited items', 'Meetup tips', 'Help center']) {
      await expect(footer.getByRole('link', { name: link })).toBeVisible();
    }
    await expect(footer).toContainText('Location: Near Portland 97205?');
  });

  test('no header, category bar, mega menu or footer link is a dead 404', async ({
    page,
    request,
  }) => {
    await page.goto('/');
    const hrefs = await page
      .locator('header a[href], nav a[href], footer a[href], [role="dialog"] a[href]')
      .evaluateAll((links) => [...new Set(links.map((link) => link.getAttribute('href') ?? ''))]);
    expect(hrefs.length).toBeGreaterThanOrEqual(35);
    for (const href of hrefs.filter((h) => h.startsWith('/'))) {
      const response = await request.get(href, { maxRedirects: 0 });
      expect([200, 307], href).toContain(response.status());
    }
  });

  test('hero carousel: no autoplay, manual controls, play/pause toggle', async ({ page }) => {
    await page.goto('/');
    const hero = page.getByRole('region', { name: 'Featured' });
    const visible = hero.locator('[aria-roledescription="slide"]:visible');
    await expect(visible).toHaveCount(1);
    const first = await visible.getAttribute('aria-label');
    await page.waitForTimeout(1500);
    expect(await visible.getAttribute('aria-label')).toBe(first);
    await hero.getByRole('button', { name: 'Next slide' }).click();
    expect(await visible.getAttribute('aria-label')).not.toBe(first);
    await hero.getByRole('button', { name: 'Play slideshow' }).click();
    await expect(hero.getByRole('button', { name: 'Pause slideshow' })).toBeVisible();
  });

  test('reduced motion removes the auto-advance control', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.getByRole('button', { name: /slideshow/ })).toHaveCount(0);
  });

  test('keyboard: first Tab reaches the skip link, which moves focus to main', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, DESKTOP_ONLY);
    await page.goto('/');
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to content' });
    await expect(skip).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('main#main')).toBeFocused();
  });

  test('no "best on a desktop browser" notice at any width (ADR-0011)', async ({ page }) => {
    await page.goto('/');
    for (const width of [320, 390, 1024, 1440]) {
      await page.setViewportSize({ width, height: 800 });
      await expect(page.getByText(/works best on a desktop browser/i)).toHaveCount(0);
    }
  });

  test('favicons, manifest and health endpoint', async ({ page, request }) => {
    await page.goto('/');
    const hrefs = await page
      .locator('link[rel="icon"], link[rel="apple-touch-icon"], link[rel="manifest"]')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));
    expect(hrefs).toEqual(
      expect.arrayContaining(['/favicon.ico', '/apple-touch-icon.png', '/manifest.webmanifest']),
    );
    for (const href of hrefs) expect((await request.get(href)).status(), href).toBe(200);
    const health = await request.get('/api/health');
    expect(health.status()).toBe(200);
    expect(HealthResponse.parse(await health.json()).status).toBe('ok');
  });
});
