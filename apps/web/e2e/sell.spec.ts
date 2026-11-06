import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';
import { FAKE_VIDEO } from './fixtures/fake-video';
import { deleteE2eUsers, localAdmin, signUpVerified, userIdFor } from './helpers/accounts';
import { LOCAL_URL } from './support';

const created: string[] = [];
test.afterEach(async () => {
  await deleteE2eUsers(created.splice(0));
});

/** The fake provider's outcome for the next upload in this browser (see fake-routes.ts). */
async function fakeOutcome(context: BrowserContext, value: 'slow' | 'error' | 'overlong') {
  await context.addCookies([{ name: 'hx_fake_video', value, domain: 'localhost', path: '/' }]);
}

/** Upload the test video and fill the details step; returns the draft id. */
async function draftWithDetails(
  page: Page,
  { title = 'Walnut side table', description = 'Solid walnut.' } = {},
): Promise<string> {
  await page.goto(`${LOCAL_URL}/sell`);
  await page.getByTestId('choose-video').setInputFiles(FAKE_VIDEO);
  await expect(page.getByRole('heading', { name: 'Describe it' })).toBeVisible();
  const listingId = /draft=([0-9a-f-]{36})/.exec(page.url())?.[1] ?? '';
  await page.getByLabel('Title').fill(title);
  await page.getByLabel('Category', { exact: true }).selectOption({ label: 'Home & Living' });
  await page.getByLabel('Subcategory').selectOption({ index: 1 });
  await page.getByLabel('Condition').selectOption('good');
  await page.getByLabel('Price').fill('45');
  await page.getByLabel(/Description/).fill(description);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Review and publish' })).toBeVisible();
  return listingId;
}

async function mediaIdOf(listingId: string): Promise<string> {
  const { data } = await localAdmin()
    .from('listing_media')
    .select('id')
    .eq('listing_id', listingId)
    .single();
  return (data as { id: string }).id;
}

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

  test('Publish when ready: still processing → scheduled → live once the video is ready', async ({
    page,
    context,
  }, testInfo) => {
    created.push(await signUpVerified(page, testInfo, { base: LOCAL_URL }));
    await fakeOutcome(context, 'slow');
    const listingId = await draftWithDetails(page);
    await expect(
      page.getByText('Your video is processing. This usually takes under a minute.'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Publish', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Publish when ready' }).click();
    await expect(
      page.getByRole('status').filter({ hasText: 'We’ll publish it as soon' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Will publish when ready' })).toBeDisabled();

    // The video finishes processing (the fake's "ready" webhook); the page follows it live.
    const ready = await page.request.post(
      `${LOCAL_URL}/api/dev/fake-video/ready/${await mediaIdOf(listingId)}`,
      { headers: { Origin: LOCAL_URL } },
    );
    expect(ready.status()).toBe(204);
    await expect(page).toHaveURL(`${LOCAL_URL}/l/${listingId}`, { timeout: 15_000 });
    await expect(page.getByText('Available', { exact: true })).toBeVisible();
  });

  for (const outcome of ['error', 'overlong'] as const) {
    test(`a video that fails processing (${outcome}) can't be published`, async ({
      page,
      context,
    }, testInfo) => {
      created.push(await signUpVerified(page, testInfo, { base: LOCAL_URL }));
      await fakeOutcome(context, outcome);
      const listingId = await draftWithDetails(page);
      await expect(
        page.getByText('We couldn’t use that video. Change the video to continue.'),
      ).toBeVisible();
      await expect(page.getByRole('button', { name: 'Publish when ready' })).toBeDisabled();
      const { data } = await localAdmin()
        .from('listing_media')
        .select('status')
        .eq('listing_id', listingId)
        .single();
      expect(data).toEqual({ status: 'errored' });
    });
  }

  test('a prohibited word holds the listing for review (owner sees the banner; buyers get 404)', async ({
    page,
    browser,
  }, testInfo) => {
    created.push(await signUpVerified(page, testInfo, { base: LOCAL_URL }));
    const listingId = await draftWithDetails(page, {
      title: 'Gun safe',
      description: 'Steel, fits two rifles.',
    });
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(page).toHaveURL(`${LOCAL_URL}/l/${listingId}`);
    await expect(page.getByText('We’re reviewing this listing.')).toBeVisible();
    const guest = await browser.newContext();
    expect((await (await guest.newPage()).goto(`${LOCAL_URL}/l/${listingId}`))?.status()).toBe(404);
    await guest.close();
  });

  test('the new-account listing limit stops a fourth draft with a plain message', async ({
    page,
  }, testInfo) => {
    const email = await signUpVerified(page, testInfo, { base: LOCAL_URL });
    created.push(email);
    const userId = await userIdFor(email);
    // Three listings today already (accounts under 7 days: 3/day).
    for (let i = 0; i < 3; i += 1) {
      const taken = await localAdmin().rpc('action_limit_take', {
        p_user_id: userId,
        p_action: 'listing_create',
      });
      expect(taken.data).toBe(0);
    }
    await page.goto(`${LOCAL_URL}/sell`);
    await page.getByTestId('choose-video').setInputFiles(FAKE_VIDEO);
    await expect(
      page.getByText(/You’ve reached the limit for now\. Try again in about/),
    ).toBeVisible();
    await expect(page).toHaveURL(`${LOCAL_URL}/sell`);
  });

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`axe: every sell step (${colorScheme})`, async ({ page }, testInfo) => {
      created.push(await signUpVerified(page, testInfo, { base: LOCAL_URL }));
      await page.emulateMedia({ colorScheme });
      const check = async (step: string) => {
        const results = await new AxeBuilder({ page }).analyze();
        const blocking = results.violations.filter(
          (v) => v.impact === 'serious' || v.impact === 'critical',
        );
        expect(
          blocking.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
          step,
        ).toEqual([]);
      };
      await page.goto(`${LOCAL_URL}/sell`);
      await expect(page.getByRole('heading', { name: 'Add a video' })).toBeVisible();
      await check('video');
      await page.getByTestId('choose-video').setInputFiles(FAKE_VIDEO);
      await expect(page.getByRole('heading', { name: 'Describe it' })).toBeVisible();
      await check('details');
      await page.getByRole('button', { name: 'Continue' }).click();
      // Empty required fields are announced, not just coloured.
      await check('details with errors');
      await page.getByLabel('Title').fill('Lamp');
      await page.getByLabel('Category', { exact: true }).selectOption({ label: 'Home & Living' });
      await page.getByLabel('Subcategory').selectOption({ index: 1 });
      await page.getByLabel('Condition').selectOption('good');
      await page.getByLabel('Price').fill('10');
      await page.getByRole('button', { name: 'Continue' }).click();
      await expect(page.getByRole('heading', { name: 'Review and publish' })).toBeVisible();
      await check('review');
    });
  }
});
