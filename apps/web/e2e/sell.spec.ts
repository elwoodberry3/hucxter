import { expect, test } from '@playwright/test';
import { FAKE_VIDEO } from './fixtures/fake-video';
import { deleteE2eUsers, localAdmin, signUpVerified } from './helpers/accounts';
import { LOCAL_URL } from './support';

const created: string[] = [];
test.afterEach(async () => {
  await deleteE2eUsers(created.splice(0));
});

test.describe('sell flow (Brief 03C.1 §3.3, fake video provider)', () => {
  test('record → upload → details → review → publish; the draft survives reload', async ({
    page,
  }, testInfo) => {
    created.push(await signUpVerified(page, testInfo, { base: LOCAL_URL }));
    await page.goto(`${LOCAL_URL}/sell`);
    await expect(page.getByRole('heading', { name: 'Add a video' })).toBeVisible();
    await page.getByTestId('choose-video').setInputFiles(FAKE_VIDEO);

    await expect(page.getByRole('heading', { name: 'Describe it' })).toBeVisible();
    await expect(page).toHaveURL(/\/sell\?draft=[0-9a-f-]{36}&step=details$/);
    const listingId = /draft=([0-9a-f-]{36})/.exec(page.url())?.[1] ?? '';

    await page.getByLabel('Title').fill('Walnut side table');
    await page.getByLabel('Category', { exact: true }).selectOption({ label: 'Home & Living' });
    await page.getByLabel('Subcategory').selectOption({ index: 1 });
    await page.getByLabel('Condition').selectOption('good');
    await page.getByLabel('Price').fill('45');
    await page.getByLabel(/Description/).fill('Solid walnut.\nSmall scratch on one leg.');
    await expect(page.getByLabel('Pickup ZIP code')).toHaveValue('97205');
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page.getByRole('heading', { name: 'Review and publish' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Review and publish' })).toBeVisible();
    await expect(page.getByText('Walnut side table')).toBeVisible();
    await expect(page.getByText('$45')).toBeVisible();
    await expect(
      page.getByRole('status').filter({ hasText: 'Your video is ready.' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(page).toHaveURL(`${LOCAL_URL}/l/${listingId}`);

    const { data } = await localAdmin()
      .from('listings')
      .select('status, review_state, price_cents')
      .eq('id', listingId)
      .single();
    expect(data).toEqual({ status: 'available', review_state: 'ok', price_cents: 4500 });
  });
});
