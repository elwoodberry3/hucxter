import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { deleteSeeded, seedListing } from './helpers/listings';
import type { SeededListing } from './helpers/listings';
import { DESKTOP_ONLY, KEY_PAGES } from './support';

const seeded: SeededListing[] = [];
test.afterEach(async () => {
  await deleteSeeded(seeded.splice(0));
});

async function blockingViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .analyze();
  return results.violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map(({ id, impact, nodes }) => ({ id, impact, targets: nodes.map((node) => node.target) }));
}

for (const colorScheme of ['light', 'dark'] as const) {
  for (const path of KEY_PAGES) {
    test(`axe: ${path} (${colorScheme}) has no serious or critical violations`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto(path);
      expect(await blockingViolations(page)).toEqual([]);
    });
  }

  test(`axe: open mega menu (${colorScheme})`, async ({ page, isMobile }) => {
    test.skip(isMobile, DESKTOP_ONLY);
    await page.emulateMedia({ colorScheme });
    await page.goto('/');
    await page.getByRole('button', { name: 'All Categories' }).click();
    expect(await blockingViolations(page)).toEqual([]);
  });

  test(`axe: open location popover and sign-in sheet (${colorScheme})`, async ({
    page,
  }, testInfo) => {
    const listing = await seedListing(testInfo);
    seeded.push(listing);
    await page.emulateMedia({ colorScheme });
    await page.goto(`/l/${listing.id}`);
    await page.getByRole('button', { name: /Near Portland/ }).click();
    expect(await blockingViolations(page)).toEqual([]);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Report' }).filter({ visible: true }).click();
    await expect(page.getByRole('dialog', { name: 'Sign in to report a listing' })).toBeVisible();
    expect(await blockingViolations(page)).toEqual([]);
  });
}
