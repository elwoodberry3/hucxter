import { HealthResponse } from '@hucxter/contracts';
import { expect, test } from '@playwright/test';
import { PAGES } from './pages';

test.describe('app shell', () => {
  test('has the Hucxter title, favicons and manifest', async ({ page, request }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('Hucxter');

    const iconHrefs = await page
      .locator('link[rel="icon"], link[rel="apple-touch-icon"], link[rel="manifest"]')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));
    expect(iconHrefs).toEqual(
      expect.arrayContaining([
        '/favicon.ico',
        '/favicon-32.png',
        '/apple-touch-icon.png',
        '/manifest.webmanifest',
      ]),
    );
    for (const href of iconHrefs) {
      expect((await request.get(href)).status(), href).toBe(200);
    }

    const manifest = (await (await request.get('/manifest.webmanifest')).json()) as {
      name: string;
      icons: { src: string; purpose?: string }[];
    };
    expect(manifest.name).toBe('Hucxter');
    expect(manifest.icons.map((icon) => icon.src)).toEqual([
      '/icon-192.png',
      '/icon-512.png',
      '/icon-maskable-512.png',
    ]);
  });

  test('sidebar links reach every placeholder page', async ({ page }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Primary' });
    for (const { path, heading, nav: label } of PAGES) {
      if (label === null) continue;
      await nav.getByRole('link', { name: label, exact: true }).click();
      await expect(page).toHaveURL(path);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
      await expect(nav.getByRole('link', { name: label, exact: true })).toHaveAttribute(
        'aria-current',
        'page',
      );
    }
  });

  test('admin placeholder renders but is not linked in the sidebar', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Admin');
    await expect(
      page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Admin' }),
    ).toHaveCount(0);
  });

  test('toolbar has search, Sell, Messages and Profile', async ({ page }) => {
    await page.goto('/');
    const toolbar = page.getByRole('banner');
    await expect(toolbar.getByRole('searchbox', { name: 'Search listings' })).toBeVisible();
    await toolbar.getByRole('link', { name: 'Sell' }).click();
    await expect(page).toHaveURL('/sell');
    await expect(toolbar.getByRole('link', { name: 'Messages' })).toBeVisible();
    await expect(toolbar.getByRole('link', { name: 'Profile' })).toBeVisible();
  });

  test('keyboard: first Tab focuses the skip link, which moves focus to main', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to content' });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.locator('main#main')).toBeFocused();
  });

  test('desktop-size notice is hidden at supported sizes', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Hucxter works best on a desktop browser.')).toBeHidden();
  });

  test('desktop-size notice shows below 1280×720 without breaking the shell', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 700 });
    await page.goto('/');
    await expect(page.getByText('Hucxter works best on a desktop browser.')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('health endpoint returns status, version and commit', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.status()).toBe(200);
    expect(HealthResponse.parse(await response.json()).status).toBe('ok');
  });
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`screenshot: feed in ${colorScheme} mode`, async ({ page }, testInfo) => {
    await page.emulateMedia({ colorScheme });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(background).toBe(colorScheme === 'dark' ? 'rgb(22, 21, 28)' : 'rgb(245, 244, 242)');
    await page.screenshot({
      path: `test-results/screenshots/${testInfo.project.name}-${colorScheme}.png`,
    });
  });
}
