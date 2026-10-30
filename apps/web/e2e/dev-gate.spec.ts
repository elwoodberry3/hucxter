import { expect, test } from '@playwright/test';
import { PRODUCTION_URL } from './support';

test.describe('/dev routes and demo fixtures', () => {
  test('the listing template renders locally with a visible Demo label', async ({ page }) => {
    await page.goto('/dev/templates/listing');
    await expect(page.getByRole('note', { name: 'Demo' })).toContainText('Demo listing');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Demo: Mid-century walnut desk',
    );
    await expect(page.getByText('Demo', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Is this still available?' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Meet safely' })).toBeVisible();
    await expect(page.getByText('Available', { exact: true })).toBeVisible();
  });

  test('status badges: Pending and Sold', async ({ page }) => {
    await page.goto('/dev/templates/listing?status=pending');
    await expect(page.getByText('Pending: someone’s on the way')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Let me know if it falls through' }),
    ).toBeVisible();
    await page.goto('/dev/templates/listing?status=sold');
    await expect(page.getByText('Sold', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /available|falls through/ })).toHaveCount(0);
  });

  test('APP_ENV=production: /dev routes 404 and the storefront still works', async ({
    request,
  }) => {
    for (const path of ['/dev/templates/listing', '/dev/templates/listing?status=sold']) {
      const response = await request.get(`${PRODUCTION_URL}${path}`);
      expect(response.status(), path).toBe(404);
      expect(await response.text()).not.toContain('Mid-century walnut desk');
    }
    expect((await request.get(`${PRODUCTION_URL}/`)).status()).toBe(200);
  });
});
