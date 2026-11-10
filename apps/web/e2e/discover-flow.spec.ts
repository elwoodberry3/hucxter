import { expect, test } from '@playwright/test';
import { activeId, activeItem, openFeed, seedFeed, sheet, town } from './helpers/discover';
import { deleteSeeded } from './helpers/listings';
import type { SeededListing } from './helpers/listings';

// Discover (Brief 03 3D): open item → details sheet → full listing → Back. Recorded as video and
// trace on every project, for the CI artifact (test-results/).
test.use({ video: 'on', trace: 'on' });

const seeded: SeededListing[] = [];
test.afterEach(async () => {
  await deleteSeeded(seeded.splice(0));
});

test('open item → details sheet → full listing → Back returns to the same item and sheet', async ({
  page,
}, testInfo) => {
  const ids = await seedFeed(testInfo, town(0, testInfo), 3, seeded);
  await openFeed(page, town(0, testInfo));
  await expect.poll(() => activeId(page)).toBe(ids[0]);

  await page.getByRole('button', { name: 'Next video' }).click();
  await expect.poll(() => activeId(page)).toBe(ids[1]);
  await expect(page).toHaveURL(new RegExp(`/discover\\?l=${ids[1] ?? ''}$`));

  await activeItem(page)
    .getByRole('button', { name: /^Details for/ })
    .click();
  await expect(sheet(page)).toBeVisible();
  await expect(sheet(page).getByText('Phone verified')).toBeVisible();
  await expect(
    sheet(page).getByRole('button', { name: 'Is this still available?' }),
  ).toBeDisabled();
  await expect(sheet(page).getByText('Messaging arrives in the next QA build')).toBeVisible();
  await sheet(page).getByRole('button', { name: 'Expand' }).click();
  await expect(sheet(page).getByText('Five shelves. Some wear on the top edge.')).toBeVisible();

  await sheet(page).getByRole('link', { name: 'View full listing' }).click();
  await expect(page).toHaveURL(new RegExp(`/l/${ids[1] ?? ''}$`));
  await expect(page.getByRole('heading', { level: 1, name: 'Feed lamp 2' })).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/discover\\?l=${ids[1] ?? ''}$`));
  await expect.poll(() => activeId(page)).toBe(ids[1]);
  await expect(sheet(page)).toBeVisible();
  await expect(sheet(page).getByRole('button', { name: 'Collapse' })).toBeVisible();

  // Back from the sheet closes it and stays on the item.
  await page.goBack();
  await expect(sheet(page)).toBeHidden();
  await expect(page).toHaveURL(new RegExp(`/discover\\?l=${ids[1] ?? ''}$`));
  await expect.poll(() => activeId(page)).toBe(ids[1]);
});
