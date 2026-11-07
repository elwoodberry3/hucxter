import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Browser, Page, TestInfo } from '@playwright/test';
import {
  deleteE2eUsers,
  handleFor,
  localAdmin,
  signUpVerified,
  userIdFor,
} from './helpers/accounts';
import { LOCAL_URL } from './support';

const members: string[] = [];
test.afterEach(async () => {
  await deleteE2eUsers(members.splice(0));
});

async function member(
  page: Page,
  testInfo: TestInfo,
  options: { slot?: 0 | 1; label?: string; name?: string } = {},
) {
  const email = await signUpVerified(page, testInfo, { base: LOCAL_URL, ...options });
  members.push(email);
  const id = await userIdFor(email);
  return { id, email, handle: await handleFor(id) };
}

/** A moderator in their own browser context (phone slot 1). */
async function staff(browser: Browser, testInfo: TestInfo) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const who = await member(page, testInfo, { slot: 1, label: 'staff' });
  const { error } = await localAdmin()
    .from('app_roles')
    .insert({ user_id: who.id, role: 'moderator' });
  if (error !== null) throw new Error('could not grant the moderator role');
  return { ...who, context, page };
}

const desktop = (testInfo: TestInfo) => !testInfo.project.name.startsWith('mobile');
const LONG_NAME = 'Wilhelmina Worthingtonnn'; // 24 characters: wider than the menu.

test.describe('member menu (Brief 03C.2 §4.6)', () => {
  test('desktop: avatar menu with a truncated name, the full name in accessible names, Esc returns focus', async ({
    page,
  }, testInfo) => {
    test.skip(!desktop(testInfo), 'the phone layout uses the tab bar');
    const owner = await member(page, testInfo, { name: LONG_NAME });
    await page.goto(`${LOCAL_URL}/`);
    const trigger = page.getByRole('button', { name: `Account menu for ${LONG_NAME}` });
    await expect(trigger.locator('[data-avatar="initials"]')).toHaveText('WW');
    await trigger.click();
    const menu = page.locator(`#${(await trigger.getAttribute('aria-controls')) ?? ''}`);
    const name = menu.getByText(LONG_NAME, { exact: true });
    await expect(name).toBeVisible();
    // Truncated with an ellipsis, not wrapped or overflowing.
    expect(
      await name.evaluate((el) => ({
        clipped: el.scrollWidth > el.clientWidth,
        overflow: getComputedStyle(el).textOverflow,
      })),
    ).toEqual({ clipped: true, overflow: 'ellipsis' });
    await expect(menu.getByText(`@${owner.handle}`)).toBeVisible();
    await expect(menu.getByRole('link')).toHaveText(['View profile', 'Messages', 'Settings']);
    await expect(menu.getByRole('link', { name: `View profile: ${LONG_NAME}` })).toBeVisible();
    await expect(menu.getByRole('button', { name: 'Sign out' })).toBeVisible();
    await expect(menu.getByRole('link', { name: 'Admin' })).toHaveCount(0);
    for (const gone of ['My listings', 'Saved', 'Profile']) {
      await expect(menu.getByRole('link', { name: gone, exact: true })).toHaveCount(0);
    }

    const results = await new AxeBuilder({ page })
      .include(`#${(await menu.getAttribute('id')) ?? ''}`)
      .analyze();
    expect(
      results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'),
    ).toEqual([]);

    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(trigger).toBeFocused();

    await trigger.click();
    await menu.getByRole('link', { name: `View profile: ${LONG_NAME}` }).click();
    await expect(page).toHaveURL(`${LOCAL_URL}/u/${owner.handle}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(LONG_NAME);
  });

  test('staff also get Admin', async ({ browser }, testInfo) => {
    test.skip(!desktop(testInfo), 'the phone layout uses the tab bar');
    const moderator = await staff(browser, testInfo);
    await moderator.page.goto(`${LOCAL_URL}/`);
    await moderator.page.getByRole('button', { name: /^Account menu/ }).click();
    await expect(moderator.page.getByRole('link', { name: 'Admin' })).toBeVisible();
    await moderator.context.close();
  });

  test('phones: the Account tab opens your profile and stays current in Settings', async ({
    page,
  }, testInfo) => {
    test.skip(desktop(testInfo), 'phone layout only');
    const owner = await member(page, testInfo);
    await page.goto(`${LOCAL_URL}/`);
    const tabs = page.getByRole('navigation', { name: 'Main' });
    const account = tabs.getByRole('link', { name: 'Account' });
    await expect(account).toHaveAttribute('href', `/u/${owner.handle}`);
    await account.click();
    await expect(page).toHaveURL(`${LOCAL_URL}/u/${owner.handle}`);
    await expect(account).toHaveAttribute('aria-current', 'page');
    for (const path of ['/settings', '/settings/profile', '/settings/account']) {
      await page.goto(`${LOCAL_URL}${path}`);
      await expect(account, path).toHaveAttribute('aria-current', 'page');
    }
  });
});

test.describe('staff-required name and handle reset (Brief 03C.2 moderation)', () => {
  test('the member must choose a new name and handle before their next action; the old handle is held', async ({
    page,
    browser,
  }, testInfo) => {
    test.setTimeout(90_000);
    const owner = await member(page, testInfo, { name: 'Robin' });
    const moderator = await staff(browser, testInfo);
    const db = localAdmin();
    const report = await db
      .from('reports')
      .insert({
        reporter_id: moderator.id,
        target_type: 'profile',
        target_id: owner.id,
        reason: 'other',
      })
      .select('id')
      .single();
    expect(report.error).toBeNull();
    const reportId = (report.data as { id: string }).id;
    const action = await db.rpc('admin_profile_action', {
      p_actor: moderator.id,
      p_report_id: reportId,
      p_action: 'require_new_name',
      p_reason: 'Impersonation',
    });
    expect(action.error).toBeNull();
    await moderator.context.close();

    const { data: reset } = await db
      .from('profiles')
      .select('display_name, handle')
      .eq('id', owner.id)
      .single();
    const placeholder = reset as { display_name: string; handle: string };
    expect(placeholder.display_name).toBe('Hucxter member');
    expect(placeholder.handle).not.toBe(owner.handle);
    expect((await page.request.get(`${LOCAL_URL}/u/${owner.handle}`)).status()).toBe(404);

    // Any gated page sends them to /welcome first.
    await page.goto(`${LOCAL_URL}/sell`);
    await expect(page).toHaveURL(`${LOCAL_URL}/welcome?next=%2Fsell`);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Choose a new name and handle' }),
    ).toBeVisible();
    // The placeholder isn't offered back.
    await expect(page.getByLabel('Display name', { exact: true })).toHaveValue('');
    await expect(page.getByLabel('Handle', { exact: true })).toHaveValue('');

    const field = page.getByLabel('Handle', { exact: true });
    const note = page.locator(
      `#${(await field.getAttribute('aria-describedby'))?.split(' ')[0] ?? ''}`,
    );
    await page.getByLabel('Display name', { exact: true }).fill('Hucxter member');
    await field.fill(owner.handle);
    await expect(note).toHaveText('That handle isn’t available yet.');
    await page.getByRole('button', { name: 'Save and continue' }).click();
    await expect(page.getByRole('alert').filter({ hasText: /\S/ })).toBeVisible();
    await expect(page).toHaveURL(/\/welcome/);

    const fresh = `new${String(testInfo.workerIndex)}${String(Date.now()).slice(-6)}`;
    await page.getByLabel('Display name', { exact: true }).fill('Robin B');
    await field.fill(fresh);
    await expect(note).toHaveText('Available');
    await page.getByRole('button', { name: 'Save and continue' }).click();
    await expect(page).toHaveURL(`${LOCAL_URL}/sell`);

    const { data: done } = await db
      .from('profiles')
      .select('display_name, handle, name_reset_required_at')
      .eq('id', owner.id)
      .single();
    expect(done).toEqual({ display_name: 'Robin B', handle: fresh, name_reset_required_at: null });
    await page.goto(`${LOCAL_URL}/u/${fresh}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Robin B');
    // The old handle stays held for everyone (user_id null).
    const hold = await db
      .from('handle_holds')
      .select('user_id')
      .eq('handle', owner.handle)
      .single();
    expect(hold.data).toEqual({ user_id: null });
    await db.from('reports').delete().eq('id', reportId);
  });
});
