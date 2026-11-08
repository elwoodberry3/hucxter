import { fileURLToPath } from 'node:url';
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

const GPS_JPEG = fileURLToPath(new URL('fixtures/avatar/gps.jpg', import.meta.url));

const members: string[] = [];
const reportIds: string[] = [];
test.afterEach(async () => {
  if (reportIds.length > 0)
    await localAdmin().from('reports').delete().in('id', reportIds.splice(0));
  await deleteE2eUsers(members.splice(0));
});

async function member(page: Page, testInfo: TestInfo, slot: 0 | 1, label: string, name?: string) {
  const email = await signUpVerified(page, testInfo, {
    base: LOCAL_URL,
    slot,
    label,
    ...(name === undefined ? {} : { name }),
  });
  members.push(email);
  const id = await userIdFor(email);
  return { id, handle: await handleFor(id) };
}

async function inContext(browser: Browser) {
  const context = await browser.newContext();
  return { context, page: await context.newPage() };
}

/** Another open report on the target, with no reporter (one open report per reporter). */
async function openReport(targetId: string): Promise<string> {
  const { data, error } = await localAdmin()
    .from('reports')
    .insert({ reporter_id: null, target_type: 'profile', target_id: targetId, reason: 'other' })
    .select('id')
    .single();
  if (error !== null) throw new Error('could not open a report');
  const id: unknown = (data as Record<string, unknown> | null)?.id;
  if (typeof id !== 'string') throw new Error('could not open a report');
  reportIds.push(id);
  return id;
}

async function audit(targetId: string) {
  const { data } = await localAdmin()
    .from('audit_log')
    .select('actor_id, action, reason')
    .eq('target_id', targetId)
    .order('created_at', { ascending: true });
  return data;
}

test.describe('profile moderation in /admin (Brief 03C.2)', () => {
  test('staff see reported profiles and act with a required reason: dismiss, remove photo, clear bio, require a new name and handle; each is audited', async ({
    page,
    browser,
  }, testInfo) => {
    test.setTimeout(150_000);
    const db = localAdmin();

    // The reported member: a photo and a bio.
    const target = await inContext(browser);
    const name = `Casey ${String(testInfo.workerIndex)}${String(Date.now()).slice(-4)}`;
    const reported = await member(target.page, testInfo, 0, 'tgt', name);
    await target.page.goto(`${LOCAL_URL}/settings/profile`);
    await target.page
      .getByRole('region', { name: 'Profile photo' })
      .getByLabel('Add photo')
      .setInputFiles(GPS_JPEG);
    await expect(target.page.getByText('Photo updated')).toBeVisible();
    await db.from('profiles').update({ bio: 'Ask me about lamps.' }).eq('id', reported.id);
    const { data: before } = await db
      .from('profiles')
      .select('avatar_path')
      .eq('id', reported.id)
      .single();
    const photo = (before as { avatar_path: string }).avatar_path;

    await target.context.close();

    // A member reports the profile through the page. (Two phone slots per worker, so the same
    // member is made staff afterwards; reporters are never shown to staff either way.)
    const staffContext = await inContext(browser);
    const admin = staffContext.page;
    const staff = await member(admin, testInfo, 1, 'staff');
    await admin.goto(`${LOCAL_URL}/u/${reported.handle}`);
    await admin.getByRole('button', { name: 'Report profile' }).click();
    const sheet = admin.getByRole('dialog', { name: 'Report this profile' });
    await sheet.getByLabel('Harassment or hate').check();
    await sheet.getByRole('textbox').fill('Rude messages.');
    await sheet.getByRole('button', { name: 'Send report' }).click();
    await expect(admin.getByText('Thanks. Our team will review this profile.')).toBeVisible();
    await admin.waitForLoadState('networkidle');
    const { data: first } = await db
      .from('reports')
      .select('id')
      .eq('target_id', reported.id)
      .single();
    reportIds.push((first as { id: string }).id);
    await db.from('app_roles').insert({ user_id: staff.id, role: 'moderator' });

    const queue = admin.getByRole('region', { name: 'Open reports' });
    const item = () => queue.getByRole('listitem').filter({ hasText: `@${reported.handle}` });

    // 1. Dismiss, with a reason.
    await admin.goto(`${LOCAL_URL}/admin`);
    await expect(item()).toContainText('Harassment or hate');
    await expect(item()).toContainText('“Rude messages.”');
    await expect(item()).toContainText(name);
    await expect(item()).toContainText('Ask me about lamps.');
    await expect(item().locator('img')).toBeVisible();
    await expect(item().getByRole('link', { name: `@${reported.handle}` })).toHaveAttribute(
      'href',
      `/u/${reported.handle}`,
    );
    await expect(item().getByRole('button')).toHaveText([
      'Dismiss report',
      'Remove photo',
      'Clear bio',
      'Require new name & handle',
    ]);
    const axe = await new AxeBuilder({ page: admin }).analyze();
    expect(axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual(
      [],
    );
    await item().getByRole('button', { name: 'Dismiss report' }).click();
    let confirm = admin.getByRole('dialog', { name: 'Dismiss report?' });
    await expect(confirm.getByRole('button', { name: 'Dismiss report' })).toBeDisabled();
    await confirm.getByLabel('Reason for the audit log (required)').fill('   ');
    await expect(confirm.getByRole('button', { name: 'Dismiss report' })).toBeDisabled();
    await confirm.getByLabel('Reason for the audit log (required)').fill('Banter, not harassment');
    await confirm.getByRole('button', { name: 'Dismiss report' }).click();
    await expect(admin.getByText('Report dismissed.')).toBeVisible();
    // The action refreshes the page's data; let that finish before navigating.
    await admin.waitForLoadState('networkidle');
    await expect(item()).toHaveCount(0);

    // 2. Remove photo: the file is deleted; initials everywhere.
    await openReport(reported.id);
    await admin.goto(`${LOCAL_URL}/admin`);
    await item().getByRole('button', { name: 'Remove photo' }).click();
    confirm = admin.getByRole('dialog', { name: 'Remove photo?' });
    await confirm.getByLabel('Reason for the audit log (required)').fill('Explicit image');
    await confirm.getByRole('button', { name: 'Remove photo' }).click();
    await expect(admin.getByText('Photo removed.')).toBeVisible();
    await admin.waitForLoadState('networkidle');
    const { data: files } = await db.storage.from('avatars').list('', { search: photo });
    expect(files?.map((f) => f.name)).toEqual([]);
    await admin.goto(`${LOCAL_URL}/u/${reported.handle}`);
    await expect(admin.getByRole('main').locator('[data-avatar="initials"]').first()).toBeVisible();
    await expect(admin.getByRole('main').locator('img')).toHaveCount(0);

    // 3. Clear bio.
    await openReport(reported.id);
    await admin.goto(`${LOCAL_URL}/admin`);
    await expect(item().getByRole('button', { name: 'Remove photo' })).toHaveCount(0);
    await item().getByRole('button', { name: 'Clear bio' }).click();
    confirm = admin.getByRole('dialog', { name: 'Clear bio?' });
    await confirm.getByLabel('Reason for the audit log (required)').fill('Contact details in bio');
    await confirm.getByRole('button', { name: 'Clear bio' }).click();
    await expect(admin.getByText('Bio cleared.')).toBeVisible();
    await admin.waitForLoadState('networkidle');

    // 4. Require a new name and handle.
    await openReport(reported.id);
    await admin.goto(`${LOCAL_URL}/admin`);
    await expect(item().getByRole('button', { name: 'Clear bio' })).toHaveCount(0);
    await item().getByRole('button', { name: 'Require new name & handle' }).click();
    confirm = admin.getByRole('dialog', { name: 'Require a new name and handle?' });
    await confirm.getByLabel('Reason for the audit log (required)').fill('Impersonating staff');
    await confirm.getByRole('button', { name: 'Require new name & handle' }).click();
    await expect(admin.getByText('Name and handle reset.')).toBeVisible();
    await admin.waitForLoadState('networkidle');
    await staffContext.context.close();

    const { data: after } = await db
      .from('profiles')
      .select('display_name, handle, bio, avatar_path, name_reset_required_at')
      .eq('id', reported.id)
      .single();
    const row = after as Record<string, string | null>;
    expect(row).toMatchObject({ display_name: 'Hucxter member', bio: '', avatar_path: null });
    expect(row.handle).not.toBe(reported.handle);
    expect(row.name_reset_required_at).not.toBeNull();
    expect((await page.request.get(`${LOCAL_URL}/u/${reported.handle}`)).status()).toBe(404);

    expect(await audit(reported.id)).toEqual([
      { actor_id: staff.id, action: 'profile.photo_removed', reason: 'Explicit image' },
      { actor_id: staff.id, action: 'profile.bio_cleared', reason: 'Contact details in bio' },
      { actor_id: staff.id, action: 'profile.name_reset', reason: 'Impersonating staff' },
    ]);
    const { data: dismissed } = await db
      .from('audit_log')
      .select('actor_id, action, reason')
      .eq('target_id', reportIds[0] ?? '');
    expect(dismissed).toEqual([
      { actor_id: staff.id, action: 'report.dismissed', reason: 'Banter, not harassment' },
    ]);
    const { data: statuses } = await db
      .from('reports')
      .select('status')
      .eq('target_id', reported.id)
      .order('created_at', { ascending: true });
    expect(statuses).toEqual([
      { status: 'dismissed' },
      { status: 'actioned' },
      { status: 'actioned' },
      { status: 'actioned' },
    ]);
  });

  test('the server requires a reason even if the sheet is bypassed', async ({
    browser,
  }, testInfo) => {
    const db = localAdmin();
    const target = await inContext(browser);
    const reported = await member(target.page, testInfo, 0, 'tgt');
    await target.context.close();
    const reportId = await openReport(reported.id);
    const staffContext = await inContext(browser);
    const staff = await member(staffContext.page, testInfo, 1, 'staff');
    const blank = await db.rpc('admin_profile_action', {
      p_actor: staff.id,
      p_report_id: reportId,
      p_action: 'dismiss',
      p_reason: '  ',
    });
    // Not staff yet, and no reason: both refused.
    expect(blank.error).not.toBeNull();
    await db.from('app_roles').insert({ user_id: staff.id, role: 'moderator' });
    const noReason = await db.rpc('admin_profile_action', {
      p_actor: staff.id,
      p_report_id: reportId,
      p_action: 'clear_bio',
      p_reason: '',
    });
    expect(noReason.error?.message).toContain('reason');
    const { data } = await db.from('reports').select('status').eq('id', reportId).single();
    expect(data).toEqual({ status: 'open' });
    await staffContext.context.close();
  });
});
