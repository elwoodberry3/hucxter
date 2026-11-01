import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { MOBILE_ONLY, isWebKitSelectNoise } from './support';

/** Phone layout (ADR-0011). Runs on mobile-chromium (Pixel 7) and mobile-webkit (iPhone 15). */
test.describe('mobile web', () => {
  test.skip(({ isMobile }) => !isMobile, MOBILE_ONLY);

  const sheet = (page: Page, name: string | RegExp) => page.getByRole('dialog', { name });

  async function expectMinTarget(locator: Locator, label: string) {
    const box = await locator.boundingBox();
    expect(box, label).not.toBeNull();
    // 44 CSS px, allowing sub-pixel rounding.
    expect(box?.width ?? 0, `${label} width`).toBeGreaterThanOrEqual(43.5);
    expect(box?.height ?? 0, `${label} height`).toBeGreaterThanOrEqual(43.5);
  }

  for (const path of [
    '/',
    '/c/home/furniture',
    '/search?q=lamp',
    '/dev/templates/listing',
    '/sign-in',
  ]) {
    test(`no horizontal overflow at 320–430 px: ${path}`, async ({ page }) => {
      await page.goto(path);
      for (const width of [320, 360, 375, 390, 414, 430]) {
        await page.setViewportSize({ width, height: 800 });
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, `${path} at ${String(width)} px`).toBeLessThanOrEqual(0);
      }
    });
  }

  test('viewport meta: device width, viewport-fit=cover, zoom never disabled', async ({ page }) => {
    await page.goto('/');
    const content = (await page.locator('meta[name="viewport"]').getAttribute('content')) ?? '';
    expect(content).toContain('width=device-width');
    expect(content).toContain('viewport-fit=cover');
    expect(content).not.toMatch(/maximum-scale|user-scalable/);
  });

  test('compact header and tab bar replace the desktop header controls', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('searchbox')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'All Categories' })).toBeHidden();
    const tabs = page.getByRole('navigation', { name: 'Main' });
    await expect(tabs.getByRole('link')).toHaveText([
      'Home',
      'Discover',
      'Sell',
      'Inbox',
      'Account',
    ]);
    await expect(tabs.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
    await tabs.getByRole('link', { name: 'Discover' }).click();
    await expect(page).toHaveURL('/discover');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Discover');
    await tabs.getByRole('link', { name: 'Sell' }).click();
    await expect(page).toHaveURL('/sign-in?next=%2Fsell');
    await tabs.getByRole('link', { name: 'Inbox' }).click();
    await expect(page).toHaveURL('/sign-in?next=%2Fmessages');
  });

  test('primary controls are at least 44×44 CSS px', async ({ page }) => {
    await page.goto('/c/home/furniture');
    const tabs = page.getByRole('navigation', { name: 'Main' });
    for (const name of ['Home', 'Discover', 'Sell', 'Inbox', 'Account']) {
      await expectMinTarget(tabs.getByRole('link', { name }), `tab ${name}`);
    }
    await expectMinTarget(page.getByRole('button', { name: 'Search Hucxter' }), 'search button');
    await expectMinTarget(page.getByRole('button', { name: /Near Portland/ }), 'location chip');
    await expectMinTarget(page.getByRole('button', { name: 'All', exact: true }), 'All categories');
    await expectMinTarget(page.getByRole('button', { name: /^Filters/ }), 'Filters');
    await page.goto('/dev/templates/listing');
    await expectMinTarget(page.getByRole('button', { name: 'Back' }), 'Back');
    await expectMinTarget(
      page.getByRole('button', { name: 'Is this still available?' }),
      'primary',
    );
    await expectMinTarget(page.getByRole('button', { name: 'Save' }), 'Save');
    await expectMinTarget(page.getByRole('button', { name: 'Share' }), 'Share');
  });

  test('search sheet: one search field, submits, closes, and Back returns in one press', async ({
    page,
  }) => {
    await page.goto('/c/home');
    await page.getByRole('button', { name: 'Search Hucxter' }).click();
    const search = sheet(page, 'Search');
    await expect(search).toBeVisible();
    await expect(page.getByRole('searchbox')).toHaveCount(1);
    await expect(search.getByRole('searchbox', { name: 'Search Hucxter' })).toBeFocused();
    await search.getByRole('searchbox').fill('desk lamp');
    await search.getByRole('button', { name: 'Search' }).click();
    await expect(page).toHaveURL('/search?q=desk+lamp');
    await expect(search).toBeHidden();
    await page.goBack();
    await expect(page).toHaveURL('/c/home');
    await expect(search).toBeHidden();
  });

  test('all-categories sheet drills in; following a link then Back lands on the original page in one press', async ({
    page,
  }) => {
    await page.goto('/c/home');
    const opener = page.getByRole('button', { name: 'All', exact: true });
    await opener.click();
    const all = sheet(page, 'All categories');
    await expect(all.getByRole('button')).toContainText(['Electronics']);
    await all.getByRole('button', { name: 'Electronics' }).click();
    const electronics = sheet(page, 'Electronics');
    await expect(electronics.getByRole('link', { name: 'Shop all Electronics' })).toBeVisible();
    await electronics.getByRole('button', { name: 'All departments' }).click();
    await all.getByRole('button', { name: 'Electronics' }).click();
    await electronics.getByRole('link', { name: 'Gaming' }).click();
    await expect(page).toHaveURL('/c/electronics/gaming');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Gaming');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    // Amendment 1: no ghost "sheet open" history entry.
    await page.goBack();
    await expect(page).toHaveURL('/c/home');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Home & Living');
  });

  test('browser Back closes an open sheet without leaving the page; focus returns', async ({
    page,
  }) => {
    await page.goto('/c/home/furniture');
    const filters = page.getByRole('button', { name: /^Filters/ });
    await filters.focus();
    await page.keyboard.press('Enter');
    await expect(sheet(page, 'Filters')).toBeVisible();
    await page.goBack();
    await expect(sheet(page, 'Filters')).toBeHidden();
    await expect(page).toHaveURL('/c/home/furniture');
    await expect(filters).toBeFocused();
    // Esc and the close button behave the same.
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');
    await expect(sheet(page, 'Filters')).toBeHidden();
    await expect(filters).toBeFocused();
    await page.keyboard.press('Enter');
    await sheet(page, 'Filters').getByRole('button', { name: 'Close' }).click();
    await expect(sheet(page, 'Filters')).toBeHidden();
    await expect(page).toHaveURL('/c/home/furniture');
  });

  test('FilterDrawer keeps filter state in the URL (round-trip)', async ({ page }) => {
    await page.goto('/c/electronics/phones-tablets');
    await page.getByRole('button', { name: /^Filters/ }).click();
    const drawer = sheet(page, 'Filters');
    await drawer.getByLabel('Good', { exact: true }).check();
    await drawer.getByLabel('Storage').selectOption('128');
    await drawer.getByLabel('Minimum price in dollars').fill('40');
    await drawer.getByRole('button', { name: 'Apply' }).click();
    await expect(page).toHaveURL(/storage_gb=128/);
    const url = new URL(page.url());
    expect(url.searchParams.getAll('condition')).toEqual(['good']);
    expect(url.searchParams.get('price_min')).toBe('40');
    await expect(drawer).toBeHidden();
    await expect(page.getByRole('button', { name: /^Filters \(3\)/ })).toBeVisible();

    await page.reload();
    await page.getByRole('button', { name: /^Filters/ }).click();
    await expect(drawer.getByLabel('Good', { exact: true })).toBeChecked();
    await expect(drawer.getByLabel('Storage')).toHaveValue('128');
    await drawer.getByRole('link', { name: 'Clear' }).click();
    await expect(page).toHaveURL('/c/electronics/phones-tablets');
    // Back from the cleared page returns to the filtered page in one press.
    await page.goBack();
    await expect(page).toHaveURL(/storage_gb=128/);
  });

  test('tab bar hides while a text field has focus (on-screen keyboard)', async ({ page }) => {
    await page.goto('/');
    const tabs = page.getByRole('navigation', { name: 'Main' });
    await expect(tabs).toBeVisible();
    await page.getByRole('button', { name: /Near Portland/ }).click();
    await page.getByLabel('ZIP code').focus();
    await expect(tabs).toBeHidden();
    await page.keyboard.press('Escape');
    await expect(tabs).toBeVisible();
  });

  test('product page: no tab bar, a Back button, and price + primary action visible without scrolling', async ({
    page,
  }) => {
    await page.goto('/dev/templates/listing');
    await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Back' })).toBeVisible();
    const viewport = page.viewportSize();
    const price = await page.getByText('$125', { exact: true }).boundingBox();
    const primary = await page
      .getByRole('button', { name: 'Is this still available?' })
      .boundingBox();
    expect(viewport).not.toBeNull();
    expect(price).not.toBeNull();
    expect(primary).not.toBeNull();
    const height = viewport?.height ?? 0;
    // Primary action (sticky bar) is on screen, and the price sits fully above it.
    expect((primary?.y ?? 0) + (primary?.height ?? 0)).toBeLessThanOrEqual(height);
    expect((price?.y ?? 0) + (price?.height ?? 0)).toBeLessThanOrEqual(primary?.y ?? 0);
    await expect(page.getByRole('button', { name: 'Report this listing' })).toBeVisible();
  });

  test('footer columns are accordions', async ({ page }) => {
    await page.goto('/');
    const footer = page.getByRole('contentinfo');
    const sell = footer.getByRole('button', { name: 'Sell' });
    await expect(sell).toHaveAttribute('aria-expanded', 'false');
    await expect(footer.getByRole('link', { name: 'How selling works' })).toBeHidden();
    await sell.click();
    await expect(sell).toHaveAttribute('aria-expanded', 'true');
    await expect(footer.getByRole('link', { name: 'How selling works' })).toBeVisible();
  });

  test('reduced motion: sheets open without animation', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/c/home');
    await page.getByRole('button', { name: 'All', exact: true }).click();
    const timing = await sheet(page, 'All categories').evaluate((element) => {
      const style = getComputedStyle(element);
      return { animation: style.animationName, transition: style.transitionDuration };
    });
    expect(timing.animation).toBe('none');
    // globals.css forces 0.01ms under reduced motion; anything at or below that is "no motion".
    const durations = timing.transition.split(',').map((value) => Number.parseFloat(value));
    expect(durations.every((seconds) => seconds <= 0.00001)).toBe(true);
  });

  test('sheets and pages run under the CSP with no violations', async ({ page, browserName }) => {
    const violations: string[] = [];
    page.on('console', (message) => {
      const text = message.text();
      if (
        /Content Security Policy|Refused to/i.test(text) &&
        !isWebKitSelectNoise(text, browserName)
      ) {
        violations.push(text);
      }
    });
    await page.goto('/c/home/furniture');
    await page.getByRole('button', { name: /^Filters/ }).click();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'All', exact: true }).click();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Search Hucxter' }).click();
    await page.keyboard.press('Escape');
    await page.goto('/dev/templates/listing');
    await page.getByRole('button', { name: 'Is this still available?' }).click();
    await page.keyboard.press('Escape');
    expect(violations).toEqual([]);
  });
});
