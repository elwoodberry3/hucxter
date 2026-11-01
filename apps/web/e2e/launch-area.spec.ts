import { expect, test } from '@playwright/test';

const NOTICE = 'Hucxter is starting in Portland–Vancouver. You can still browse and post here.';

/** D-35 / D-36: launch-area notice is informational; nothing is blocked by location. */
test.describe('launch area', () => {
  test('no notice inside the launch area (default 97205)', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(NOTICE)).toHaveCount(0);
  });

  test('Vancouver, WA counts as the launch area', async ({ page, context }) => {
    await context.addCookies([{ name: 'hx_loc', value: '98660.25', url: 'http://localhost:3100' }]);
    await page.goto('/');
    await expect(page.getByRole('button', { name: /Near Vancouver 98660/ })).toBeVisible();
    await expect(page.getByText(NOTICE)).toHaveCount(0);
  });

  test('outside the launch area: dismissible notice, browsing still works, dismissal persists', async ({
    page,
    context,
  }) => {
    await context.addCookies([{ name: 'hx_loc', value: '75009.25', url: 'http://localhost:3100' }]);
    await page.goto('/');
    const notice = page.getByRole('complementary', { name: 'Launch area' });
    await expect(notice).toHaveText(NOTICE);
    await expect(page.getByRole('heading', { name: 'Shop by category' })).toBeVisible();
    await notice.getByRole('button', { name: 'Dismiss launch area notice' }).click();
    await expect(notice).toHaveCount(0);
    await expect
      .poll(async () => (await context.cookies()).find((c) => c.name === 'hx_launch_notice')?.value)
      .toBe('dismissed');
    await page.reload();
    await expect(page.getByText(NOTICE)).toHaveCount(0);
  });

  test('any US ZIP can be set (D-36)', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Near Portland 97205\?/ }).click();
    await page.getByLabel('ZIP code').fill('10001');
    await page.getByRole('button', { name: 'Update location' }).click();
    await expect(page.getByRole('button', { name: /Near New York 10001/ })).toBeVisible();
    await expect(page.getByText(NOTICE)).toBeVisible();
  });
});
