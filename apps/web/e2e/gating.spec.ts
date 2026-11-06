import { expect, test } from '@playwright/test';
import { DESKTOP_ONLY, GATED_ROUTES, SERVER_ONLY } from './support';

test.describe('sign-in gating', () => {
  for (const route of GATED_ROUTES) {
    test(`${route} redirects guests to sign-in and keeps next`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(`/sign-in?next=${encodeURIComponent(route)}`);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sign in to Hucxter');
      await expect(page.getByRole('link', { name: 'Create an account' })).toHaveAttribute(
        'href',
        `/sign-up?next=${encodeURIComponent(route)}`,
      );
    });
  }

  test('header Sell and Messages lead to sign-in', async ({ page, isMobile }) => {
    test.skip(isMobile, DESKTOP_ONLY);
    await page.goto('/c/home');
    await page.getByRole('banner').getByRole('link', { name: 'Sell' }).click();
    await expect(page).toHaveURL('/sign-in?next=%2Fsell');
    await page.getByRole('banner').getByRole('link', { name: 'Messages' }).click();
    await expect(page).toHaveURL('/sign-in?next=%2Fmessages');
  });

  test('account menu returns guests to the current page', async ({ page, isMobile }) => {
    test.skip(isMobile, DESKTOP_ONLY);
    await page.goto('/c/home/lighting?condition=good');
    const trigger = page.getByRole('button', { name: 'Sign in' });
    await trigger.click();
    const panel = page.locator(`#${(await trigger.getAttribute('aria-controls')) ?? ''}`);
    const next = encodeURIComponent('/c/home/lighting?condition=good');
    await expect(panel.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      `/sign-in?next=${next}`,
    );
    await expect(panel.getByRole('link', { name: 'Create account' })).toHaveAttribute(
      'href',
      `/sign-up?next=${next}`,
    );
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
  });

  test('gated actions open the sign-in sheet with Google and email (D-34)', async ({ page }) => {
    await page.goto('/dev/templates/listing');
    for (const [button, prompt] of [
      ['Is this still available?', 'Sign in to message this seller'],
      ['Save', 'Sign in to save items'],
      ['Report', 'Sign in to report a listing'],
    ] as const) {
      // Desktop: "Report"; phones: "Report this listing" (outside the sticky bar).
      const trigger = page.getByRole('main').getByRole('button', {
        name: button === 'Report' ? /^Report/ : button,
        exact: button !== 'Report',
      });
      // Keyboard activation: WebKit doesn't focus buttons on click, and focus return is the point.
      await trigger.focus();
      await page.keyboard.press('Enter');
      const sheet = page.getByRole('dialog', { name: prompt });
      await expect(sheet).toBeVisible();
      await expect(sheet.getByRole('link', { name: 'Continue with Google' })).toHaveAttribute(
        'href',
        '/auth/google?next=%2Fdev%2Ftemplates%2Flisting',
      );
      await expect(sheet.getByRole('button', { name: 'Continue with email' })).toBeVisible();
      await expect(sheet).not.toContainText(/Facebook|TikTok|next release/);
      await page.keyboard.press('Escape');
      await expect(sheet).toBeHidden();
      await expect(trigger).toBeFocused();
    }
  });

  test('sign-in offers only Google and email; email asks for a 6-digit code', async ({ page }) => {
    await page.goto('/sign-up?next=%2Fsell');
    const main = page.getByRole('main');
    await expect(main.getByRole('link', { name: 'Continue with Google' })).toHaveAttribute(
      'href',
      '/auth/google?next=%2Fsell',
    );
    await expect(main).not.toContainText(/Facebook|TikTok/);
    await main.getByRole('button', { name: 'Continue with email' }).click();
    const email = main.getByLabel('Email');
    await expect(email).toHaveAttribute('type', 'email');
    await expect(email).toHaveAttribute('autocomplete', 'email');
    await expect(email).toBeFocused();
  });

  test('hostile next values are dropped', async ({ page }) => {
    for (const next of [
      'https://evil.example',
      '//evil.example',
      '/\\evil.example',
      '/.//evil.example',
      'javascript:alert(1)',
    ]) {
      await page.goto(`/sign-in?next=${encodeURIComponent(next)}`);
      await expect(page.getByRole('link', { name: 'Create an account' })).toHaveAttribute(
        'href',
        '/sign-up',
      );
      const hrefs = await page
        .locator('a[href]')
        .evaluateAll((links) => links.map((l) => l.getAttribute('href') ?? ''));
      expect(hrefs.some((href) => href.includes('evil.example'))).toBe(false);
    }
  });

  test('admin and listing pages 404 for guests', async ({ request }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1440', SERVER_ONLY);
    expect((await request.get('/admin')).status()).toBe(404);
    expect((await request.get('/l/00000000-0000-4000-8000-000000000001')).status()).toBe(404);
  });
});
