import { fileURLToPath } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';
import {
  deleteE2eUsers,
  handleFor,
  localAdmin,
  signUpVerified,
  testPhone,
  userIdFor,
} from './helpers/accounts';
import { INVITE_OFF_URL, LOCAL_URL } from './support';

const GPS_JPEG = fileURLToPath(new URL('fixtures/avatar/gps.jpg', import.meta.url));

const members: string[] = [];
test.afterEach(async () => {
  await deleteE2eUsers(members.splice(0));
});

async function member(
  page: Page,
  testInfo: TestInfo,
  { base = LOCAL_URL, slot = 0, label = 'm' }: { base?: string; slot?: 0 | 1; label?: string } = {},
) {
  const email = await signUpVerified(page, testInfo, { base, slot, label });
  members.push(email);
  const id = await userIdFor(email);
  return { id, email, handle: await handleFor(id) };
}

const desktop = (testInfo: TestInfo) => !testInfo.project.name.startsWith('mobile');

/** A fresh, valid handle for this test (3–24 chars). */
const freshHandle = (testInfo: TestInfo, tag: string) =>
  `${tag}${String(testInfo.workerIndex)}${String(Date.now()).slice(-6)}`.slice(0, 24);

test.describe('Settings (Brief 03C.2 §4.4)', () => {
  test('desktop: two panes; phone: list → detail with a back link, no sideways scroll', async ({
    page,
  }, testInfo) => {
    await member(page, testInfo);
    await page.goto(`${LOCAL_URL}/settings`);
    const nav = page.getByRole('navigation', { name: 'Settings' });
    await expect(nav.getByRole('link')).toHaveText(['Edit profile', 'Account']);
    if (desktop(testInfo)) {
      await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
      await expect(nav.getByRole('link', { name: 'Edit profile' })).toHaveAttribute(
        'aria-current',
        'page',
      );
      await expect(page.getByLabel('Display name')).toBeVisible();
      await nav.getByRole('link', { name: 'Account' }).click();
      await expect(page).toHaveURL(`${LOCAL_URL}/settings/account`);
      await expect(nav).toBeVisible();
      await expect(page.getByRole('link', { name: 'Settings', exact: true })).toBeHidden();
    } else {
      // The index is just the list (the desktop pane is in the page but hidden).
      await expect(page.getByLabel('Display name')).toBeHidden();
      await nav.getByRole('link', { name: 'Edit profile' }).click();
      await expect(page).toHaveURL(`${LOCAL_URL}/settings/profile`);
      await expect(page.getByRole('heading', { level: 1, name: 'Edit profile' })).toBeVisible();
      await expect(nav).toBeHidden();
      await page.getByRole('link', { name: 'Settings', exact: true }).click();
      await expect(page).toHaveURL(`${LOCAL_URL}/settings`);
    }
    for (const width of desktop(testInfo) ? [] : [320, 360, 390, 430]) {
      await page.setViewportSize({ width, height: 800 });
      for (const path of ['/settings', '/settings/profile', '/settings/account']) {
        await page.goto(`${LOCAL_URL}${path}`);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
          `${path} at ${String(width)}`,
        ).toBeLessThanOrEqual(0);
      }
    }
  });

  test('phones: the tab bar gives way to the keyboard on the profile form', async ({
    page,
  }, testInfo) => {
    test.skip(desktop(testInfo), 'phone layout only');
    await member(page, testInfo);
    await page.goto(`${LOCAL_URL}/settings/profile`);
    const tabs = page.getByRole('navigation', { name: 'Main' });
    await expect(tabs).toBeVisible();
    await page.getByLabel('Bio').focus();
    await expect(tabs).toBeHidden();
    await page.getByLabel('Bio').blur();
    await expect(tabs).toBeVisible();
  });

  test('Account shows the phone masked, never in full', async ({ page }, testInfo) => {
    await member(page, testInfo);
    await page.goto(`${LOCAL_URL}/settings/account`);
    const full = testPhone(testInfo, 0).replace(/\D/g, '');
    const national = full.length === 11 ? full.slice(1) : full;
    const masked = `+1 (${national.slice(0, 3)}) •••-•${national.slice(7)}`;
    await expect(page.getByText(masked)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Change number' })).toBeVisible();
    const html = await page.content();
    expect(html).not.toContain(national);
    expect(html).not.toContain(national.slice(3, 6) + national.slice(6));
  });

  test('display name and bio: counters, rules, saved to the profile', async ({
    page,
  }, testInfo) => {
    const owner = await member(page, testInfo);
    await page.goto(`${LOCAL_URL}/settings/profile`);
    await page.getByLabel('Display name').fill('x'.repeat(30));
    await expect(page.getByLabel('Display name')).toHaveValue('x'.repeat(25));
    await expect(page.getByText('25/25')).toBeVisible();
    await page.getByLabel('Display name').fill('Robin');
    await page.getByLabel('Bio').fill('Find me at https://example.test');
    await page.getByRole('button', { name: 'Save profile' }).click();
    await expect(page.getByRole('alert').filter({ hasText: /link|URL|web/i })).toBeVisible();
    // Bios refuse only the brand (Brief 03C.1b H8); "Official", "support" and "admin" are fine.
    await page.getByLabel('Bio').fill('Hucxter lamps');
    await page.getByRole('button', { name: 'Save profile' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Don’t use “Hucxter”.' })).toBeVisible();
    const bio = 'Official mid-century lamps.\nPickup in NW.';
    await page.getByLabel('Bio').fill(bio);
    await expect(page.getByText(`${String(bio.length)}/150`)).toBeVisible();
    await page.getByRole('button', { name: 'Save profile' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Saved.' })).toBeVisible();
    // Saving refreshes the page's data; let that finish before navigating away.
    await page.waitForLoadState('networkidle');
    await page.goto(`${LOCAL_URL}/u/${owner.handle}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Robin');
    await expect(page.getByText('Official mid-century lamps.')).toBeVisible();
  });

  test('handle: availability as you type, one change per 30 days, the old handle is held', async ({
    page,
    browser,
  }, testInfo) => {
    test.setTimeout(90_000);
    const owner = await member(page, testInfo);
    const otherContext = await browser.newContext();
    const otherPage = await otherContext.newPage();
    const other = await member(otherPage, testInfo, { slot: 1, label: 'o' });

    await page.goto(`${LOCAL_URL}/settings/profile`);
    const field = page.getByLabel('Handle');
    const note = page.locator(
      `#${(await field.getAttribute('aria-describedby'))?.split(' ')[0] ?? ''}`,
    );
    await expect(note).toHaveText('You can change your handle once every 30 days.');
    await field.fill('ab');
    await expect(note).toHaveText('Use 3–24 characters.');
    await field.fill('supportdesk');
    await expect(note).toHaveText('That handle isn’t available.');
    await field.fill(other.handle);
    await expect(note).toHaveText('That handle is taken.');
    const next = freshHandle(testInfo, 'new');
    await field.fill(next);
    await expect(note).toHaveText('Available');
    await page.getByRole('button', { name: 'Save profile' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Saved.' })).toBeVisible();
    await expect(note).toHaveText(/You can change your handle again on [A-Z][a-z]{2} \d{1,2}\./);

    // The new handle works; the old one is gone and held.
    expect((await page.request.get(`${LOCAL_URL}/u/${next}`)).status()).toBe(200);
    expect((await page.request.get(`${LOCAL_URL}/u/${owner.handle}`)).status()).toBe(404);
    await otherPage.goto(`${LOCAL_URL}/settings/profile`);
    const otherField = otherPage.getByLabel('Handle');
    await otherField.fill(owner.handle);
    const otherNote = otherPage.locator(
      `#${(await otherField.getAttribute('aria-describedby'))?.split(' ')[0] ?? ''}`,
    );
    await expect(otherNote).toHaveText('That handle isn’t available yet.');
    await otherPage.getByRole('button', { name: 'Save profile' }).click();
    await expect(
      otherPage.getByRole('alert').filter({ hasText: 'isn’t available yet' }),
    ).toBeVisible();

    // A second change inside 30 days is refused.
    await field.fill(freshHandle(testInfo, 'again'));
    await page.getByRole('button', { name: 'Save profile' }).click();
    await expect(
      page.getByRole('alert').filter({ hasText: 'You can change your handle once every 30 days.' }),
    ).toBeVisible();
    await otherContext.close();
  });

  test('handle checks are rate-limited: a neutral "Try again shortly"', async ({
    page,
  }, testInfo) => {
    const owner = await member(page, testInfo);
    for (let i = 0; i < 60; i += 1) {
      await localAdmin().rpc('action_limit_take', {
        p_user_id: owner.id,
        p_action: 'handle_check',
      });
    }
    await page.goto(`${LOCAL_URL}/settings/profile`);
    const field = page.getByLabel('Handle');
    await field.fill(freshHandle(testInfo, 'lim'));
    const note = page.locator(
      `#${(await field.getAttribute('aria-describedby'))?.split(' ')[0] ?? ''}`,
    );
    await expect(note).toHaveText('Try again shortly');
    await expect(note).toHaveAttribute('data-tone', 'neutral');
  });

  test('photo: change and remove from settings (AVATAR_UPLOADS on)', async ({ page }, testInfo) => {
    const owner = await member(page, testInfo);
    await page.goto(`${LOCAL_URL}/settings/profile`);
    const photo = page.getByRole('region', { name: 'Profile photo' });
    await photo.getByLabel('Add photo').setInputFiles(GPS_JPEG);
    await expect(page.getByText('Photo updated')).toBeVisible();
    await expect(photo.locator('img')).toBeVisible();
    await photo.getByRole('button', { name: 'Remove photo' }).click();
    await expect(page.getByText('Photo removed')).toBeVisible();
    await expect(photo.locator('[data-avatar="initials"]')).toHaveText('S');
    const { data } = await localAdmin()
      .from('profiles')
      .select('avatar_path')
      .eq('id', owner.id)
      .single();
    expect(data).toEqual({ avatar_path: null });
  });

  test('photo controls are hidden when AVATAR_UPLOADS=off', async ({ page }, testInfo) => {
    await member(page, testInfo, { base: INVITE_OFF_URL });
    await page.goto(`${INVITE_OFF_URL}/settings/profile`);
    await expect(page.getByLabel('Display name')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Profile photo' })).toHaveCount(0);
    await expect(page.getByText('Add photo')).toHaveCount(0);
  });

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`axe: settings panes (${colorScheme})`, async ({ page }, testInfo) => {
      await member(page, testInfo);
      await page.emulateMedia({ colorScheme });
      for (const path of ['/settings', '/settings/profile', '/settings/account']) {
        await page.goto(`${LOCAL_URL}${path}`);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        const results = await new AxeBuilder({ page }).analyze();
        const blocking = results.violations.filter(
          (v) => v.impact === 'serious' || v.impact === 'critical',
        );
        expect(
          blocking.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
          path,
        ).toEqual([]);
      }
    });
  }
});
