import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/** PR screenshots (CI uploads apps/web/test-results/screenshots). */
const shot = (name: string, fullPage = false) => ({
  path: `test-results/screenshots/${name}.png`,
  fullPage,
});
const SCHEMES = ['light', 'dark'] as const;

async function ready(page: Page) {
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

test.describe('screenshots', () => {
  // Capture settled states (no sheet/carousel animation mid-flight).
  test.use({ reducedMotion: 'reduce' });

  test('desktop 1440: home, category, mega menu, template, sign-in sheet', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1440', 'one desktop set, at 1440×900');
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
      await page.goto('/dev/templates/listing');
      await ready(page);
      await page.screenshot(shot(`1440-template-${scheme}`));
    }
    await page.emulateMedia({ colorScheme: 'light' });
    await page.getByRole('button', { name: 'Is this still available?' }).click();
    await page.screenshot(shot('1440-sign-in-sheet-light'));
  });

  test('desktop 1280: home', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1280', 'one 1280×800 check');
    await page.goto('/');
    await ready(page);
    await page.screenshot(shot('1280-home-light'));
  });

  test('phone 390: home, category with FilterDrawer, all-categories sheet, template', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'mobile-webkit',
      'one phone set (iPhone 15 profile at 390 px)',
    );
    await page.setViewportSize({ width: 390, height: 844 });
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
      await page.goto('/dev/templates/listing');
      await ready(page);
      await page.screenshot(shot(`390-template-${scheme}`));
    }
  });

  test('phone 393×659 (iPhone 15): template above the fold', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-webkit', 'iPhone 15 viewport only');
    for (const scheme of SCHEMES) {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      await page.goto('/dev/templates/listing');
      await ready(page);
      await page.screenshot(shot(`393x659-template-${scheme}`));
    }
  });

  test('Android 412 (Pixel 7): home', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chromium', 'one Android check');
    await page.goto('/');
    await ready(page);
    await page.screenshot(shot('pixel7-home-light'));
  });
});
