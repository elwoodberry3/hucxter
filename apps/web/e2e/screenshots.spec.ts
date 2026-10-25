import { expect, test } from '@playwright/test';

/** PR screenshots (uploaded by CI from test-results/screenshots). */
const shot = (name: string) => ({ path: `test-results/screenshots/${name}.png` });

test.describe('screenshots', () => {
  test('home', async ({ page }, testInfo) => {
    const project = testInfo.project.name;
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme });
      await page.goto('/');
      await expect(page.getByRole('heading', { name: 'Shop by category' })).toBeVisible();
      await page.screenshot(shot(`${project}-home-${colorScheme}`));
      if (project === 'desktop-1440')
        await page.screenshot({ ...shot(`${project}-home-${colorScheme}-full`), fullPage: true });
    }
  });

  test('mega menu, category index, template, sign-in sheet', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1440', 'one set at 1440×900');
    await page.goto('/');
    await page.getByRole('button', { name: 'All Categories' }).click();
    await page
      .getByRole('dialog', { name: 'All categories' })
      .getByRole('tab', { name: 'Sports & Outdoors' })
      .hover();
    await page.screenshot(shot('mega-menu'));

    await page.goto('/c/sports-outdoors/bikes');
    await page.screenshot({ ...shot('category-index'), fullPage: true });

    await page.goto('/dev/templates/listing');
    await page.screenshot({ ...shot('product-template'), fullPage: true });

    await page.getByRole('button', { name: 'Is this still available?' }).click();
    await expect(
      page.getByRole('dialog', { name: 'Sign in to message this seller' }),
    ).toBeVisible();
    await page.screenshot(shot('sign-in-sheet'));

    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /Near Celina/ }).click();
    await page.screenshot(shot('location-popover'));
  });
});
