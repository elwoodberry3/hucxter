import { expect, test } from '@playwright/test';

test.describe('guest location', () => {
  test('default guess is visible, editable, and stored as ZIP + radius only', async ({
    page,
    context,
  }) => {
    await page.goto('/');
    const chip = page.getByRole('button', { name: /Near Celina 75009\?/ });
    await chip.click();
    const popover = page.getByRole('dialog', { name: 'Your location' });
    await expect(popover).toContainText('We’re showing Celina 75009 to start.');

    await popover.getByLabel('ZIP code').fill('99999');
    await popover.getByRole('button', { name: 'Update location' }).click();
    await expect(popover.getByRole('alert')).toHaveText(/isn’t in that area yet/);
    await expect(popover.getByLabel('ZIP code')).toHaveAttribute('aria-invalid', 'true');

    await popover.getByLabel('ZIP code').fill('76102');
    await popover.getByLabel('Distance').selectOption('10');
    await popover.getByRole('button', { name: 'Update location' }).click();
    await expect(page.getByRole('button', { name: /Near Fort Worth 76102 Change/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'New near Fort Worth' })).toBeVisible();

    const cookie = (await context.cookies()).find((c) => c.name === 'hx_loc');
    expect(cookie).toMatchObject({ value: '76102.10', httpOnly: true, sameSite: 'Lax', path: '/' });
  });

  test('confirming the guess removes the question mark', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Near Celina 75009\?/ }).click();
    await page.getByRole('button', { name: 'Yes, use Celina' }).click();
    await expect(page.getByRole('button', { name: /^Near Celina 75009 Change$/ })).toBeVisible();
  });

  test('"Use my current location" maps browser coordinates to a ZIP', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 33.2148, longitude: -97.1331 });
    await page.goto('/');
    await page.getByRole('button', { name: /Near Celina/ }).click();
    await page.getByRole('button', { name: 'Use my current location' }).click();
    await expect(page.getByRole('button', { name: /Near Denton 762\d\d Change/ })).toBeVisible();
    const cookie = (await context.cookies()).find((c) => c.name === 'hx_loc');
    expect(cookie?.value).toMatch(/^762\d\d\.25$/);
  });

  test('a tampered cookie is ignored', async ({ page, context }) => {
    await context.addCookies([
      { name: 'hx_loc', value: '33.21,-97.13', url: 'http://localhost:3100' },
    ]);
    await page.goto('/');
    await expect(page.getByRole('button', { name: /Near Celina 75009\?/ })).toBeVisible();
  });
});
