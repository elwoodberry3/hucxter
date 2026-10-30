import { expect, test } from '@playwright/test';
import { categoryUrls } from './support';

test.describe('category index and search', () => {
  test('every department and subcategory renders with filters and an empty state', async ({
    request,
  }) => {
    const urls = await categoryUrls(request);
    expect(urls.filter((url) => url.split('/').length === 3)).toHaveLength(14);
    expect(urls.length).toBeGreaterThan(80);
    for (const url of urls) {
      const response = await request.get(url);
      expect(response.status(), url).toBe(200);
      const html = await response.text();
      expect(html, url).toContain('id="filters-heading"');
      expect(html, url).toMatch(/Nothing in .+ yet/);
    }
  });

  test('unknown category slugs return 404', async ({ request }) => {
    for (const url of ['/c/vehicles', '/c/cars', '/c/electronics/furniture', '/c/home/nope']) {
      expect((await request.get(url)).status(), url).toBe(404);
    }
  });

  test('subcategory page: breadcrumb, chips, hero, department filters', async ({ page }) => {
    await page.goto('/c/electronics/phones-tablets');
    const crumbs = page.getByRole('navigation', { name: 'Breadcrumb' });
    await expect(crumbs.getByRole('listitem')).toHaveText([
      'Feed',
      'Electronics',
      'Phones & Tablets',
    ]);
    await expect(
      page
        .getByRole('navigation', { name: 'Electronics subcategories' })
        .getByRole('link', { name: 'Phones & Tablets' }),
    ).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Phones & Tablets');
    await expect(page.getByLabel('Storage')).toBeVisible();
    await expect(page.getByLabel('Platform')).toHaveCount(0);
  });

  test('filters round-trip through the URL and survive reload and back/forward', async ({
    page,
  }) => {
    await page.goto('/c/electronics/phones-tablets');
    await page.getByLabel('Minimum price in dollars').fill('50');
    await page.getByLabel('Good', { exact: true }).check();
    await page.getByLabel('Last 7 days').check();
    await page.getByLabel('Storage').selectOption('128');
    await page.getByLabel('Brand').fill('Pixel');
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await expect(page).toHaveURL(/price_min=50/);
    const url = new URL(page.url());
    expect(url.searchParams.getAll('condition')).toEqual(['good']);
    expect(url.searchParams.get('posted')).toBe('7d');
    expect(url.searchParams.get('storage_gb')).toBe('128');
    expect(url.searchParams.get('brand')).toBe('Pixel');

    await page.reload();
    await expect(page.getByLabel('Minimum price in dollars')).toHaveValue('50');
    await expect(page.getByLabel('Good', { exact: true })).toBeChecked();
    await expect(page.getByLabel('Last 7 days')).toBeChecked();
    await expect(page.getByLabel('Storage')).toHaveValue('128');
    await expect(page.getByLabel('Brand')).toHaveValue('Pixel');

    await page.getByLabel('Sort by').selectOption('price_asc');
    await expect(page).toHaveURL(/sort=price_asc/);
    await expect(page).toHaveURL(/storage_gb=128/);
    await page.goBack();
    await expect(page).not.toHaveURL(/sort=/);
    await expect(page.getByLabel('Storage')).toHaveValue('128');

    await page.getByRole('link', { name: 'Clear all' }).click();
    await expect(page).toHaveURL('/c/electronics/phones-tablets');
  });

  test('empty state offers Sell, a wider radius, and all categories', async ({ page }) => {
    await page.goto('/c/home/furniture?distance=10');
    await expect(
      page.getByRole('heading', { name: 'Nothing in Furniture near Celina yet' }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sell in Furniture' })).toHaveAttribute(
      'href',
      '/sell',
    );
    await page.getByRole('link', { name: 'Widen to 25 mi' }).click();
    await expect(page).toHaveURL(/distance=25/);
    await expect(page.getByRole('link', { name: 'Browse all categories' })).toBeVisible();
  });

  test('search echoes the query safely and uses the same layout', async ({ page }) => {
    let dialogs = 0;
    page.on('dialog', (dialog) => {
      dialogs += 1;
      void dialog.dismiss();
    });
    const query = '<img src=x onerror=alert(1)>"\'';
    await page.goto('/');
    await page.getByRole('searchbox', { name: 'Search Hucxter' }).fill(query);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/search\?q=/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Results for “${query}”`);
    await expect(page.getByRole('searchbox', { name: 'Search Hucxter' })).toHaveValue(query);
    await expect(page.getByRole('heading', { name: 'Filters' })).toBeVisible();
    await expect(page.locator('main img[src="x"]')).toHaveCount(0);
    expect(dialogs).toBe(0);
  });
});
