import AxeBuilder from '@axe-core/playwright';
import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import type { Browser, Page, TestInfo } from '@playwright/test';
import { deleteE2eUsers, localAdmin, signUpVerified, userIdFor } from './helpers/accounts';
import { deleteSeeded, seedListing } from './helpers/listings';
import type { SeededListing } from './helpers/listings';
import { LOCAL_URL } from './support';

/** Tests for all four projects share one queue: titles carry a unique token. */
const tag = () => randomUUID().slice(0, 8);

const members: string[] = [];
const seeded: SeededListing[] = [];
test.afterEach(async () => {
  await deleteSeeded(seeded.splice(0));
  await deleteE2eUsers(members.splice(0));
});

async function staff(page: Page, testInfo: TestInfo) {
  const email = await signUpVerified(page, testInfo, { base: LOCAL_URL, label: 'staff' });
  members.push(email);
  const id = await userIdFor(email);
  const { error } = await localAdmin().from('app_roles').insert({ user_id: id, role: 'moderator' });
  if (error !== null) throw new Error('could not grant the moderator role');
  return id;
}

/** A second verified member in their own browser context (phone slot 1). */
async function reporter(browser: Browser, testInfo: TestInfo) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const email = await signUpVerified(page, testInfo, { base: LOCAL_URL, slot: 1, label: 'rep' });
  members.push(email);
  return { context, page };
}

test.describe('moderation queue (Brief 03C.1 §3.6)', () => {
  test('/admin is 404 for guests and for members who aren’t staff', async ({ page }, testInfo) => {
    expect((await page.goto(`${LOCAL_URL}/admin`))?.status()).toBe(404);
    const email = await signUpVerified(page, testInfo, { base: LOCAL_URL });
    members.push(email);
    expect((await page.goto(`${LOCAL_URL}/admin`))?.status()).toBe(404);
  });

  test('a member reports a listing; staff remove it: hidden, playback revoked, report closed, audited', async ({
    page,
    browser,
  }, testInfo) => {
    test.setTimeout(90_000);
    const watch = `Suspicious watch ${tag()}`;
    const listing = await seedListing(testInfo, { title: watch });
    seeded.push(listing);

    const member = await reporter(browser, testInfo);
    await member.page.goto(`${LOCAL_URL}/l/${listing.id}`);
    await member.page.getByRole('button', { name: 'Report' }).filter({ visible: true }).click();
    const sheet = member.page.getByRole('dialog', { name: 'Report this listing' });
    await sheet.getByLabel('It’s counterfeit').check();
    await sheet.getByRole('textbox').fill('Logo looks wrong.');
    await sheet.getByRole('button', { name: 'Send report' }).click();
    await expect(member.page.getByText('Thanks. Our team will review this listing.')).toBeVisible();

    const staffId = await staff(page, testInfo);
    await page.goto(`${LOCAL_URL}/admin`);
    const reports = page.getByRole('region', { name: 'Open reports' });
    const item = reports.getByRole('listitem').filter({ hasText: watch });
    await expect(item).toContainText('It’s counterfeit');
    await expect(item).toContainText('“Logo looks wrong.”');
    // Reporters are never shown to staff.
    await expect(item).not.toContainText('@');
    await item.getByRole('button', { name: 'Remove listing' }).click();
    const confirm = page.getByRole('dialog', { name: 'Remove listing?' });
    await confirm.getByLabel('Note for the audit log (optional)').fill('Counterfeit brand');
    await confirm.getByRole('button', { name: 'Remove listing' }).click();
    await expect(page.getByText('Removed. Its video can’t be played any more.')).toBeVisible();
    await expect(reports.getByRole('listitem').filter({ hasText: watch })).toHaveCount(0);

    expect((await member.page.goto(`${LOCAL_URL}/l/${listing.id}`))?.status()).toBe(404);
    await member.context.close();
    const db = localAdmin();
    const audit = await db
      .from('audit_log')
      .select('actor_id, action, reason')
      .eq('target_id', listing.id)
      .eq('action', 'listing.removed');
    expect(audit.data).toEqual([
      { actor_id: staffId, action: 'listing.removed', reason: 'Counterfeit brand' },
    ]);
    const report = await db.from('reports').select('status').eq('target_id', listing.id);
    expect(report.data).toEqual([{ status: 'actioned' }]);
    const jobs = await db
      .from('jobs')
      .select('kind, payload')
      .eq('kind', 'mux_delete_playback_id')
      .eq('payload->>asset_id', `fake-asset-${await mediaIdOf(listing.id)}`);
    expect(jobs.data).toHaveLength(1);
  });

  test('staff approve a held listing (it goes live) and dismiss a report (it stays live)', async ({
    page,
    browser,
  }, testInfo) => {
    test.setTimeout(90_000);
    const scope = `Hunting rifle scope ${tag()}`;
    const chair = `Ordinary chair ${tag()}`;
    const held = await seedListing(testInfo, {
      title: scope,
      description: 'Fits any rifle.',
      needsReview: true,
    });
    const fine = await seedListing(testInfo, { title: chair });
    seeded.push(held, fine);
    const member = await reporter(browser, testInfo);
    await member.page.goto(`${LOCAL_URL}/l/${fine.id}`);
    await member.page.getByRole('button', { name: 'Report' }).filter({ visible: true }).click();
    const sheet = member.page.getByRole('dialog', { name: 'Report this listing' });
    await sheet.getByLabel('Something else').check();
    await sheet.getByRole('button', { name: 'Send report' }).click();
    await expect(member.page.getByText('Thanks. Our team will review this listing.')).toBeVisible();

    await staff(page, testInfo);
    await page.goto(`${LOCAL_URL}/admin`);
    const heldItem = page
      .getByRole('region', { name: 'Held for review' })
      .getByRole('listitem')
      .filter({ hasText: scope });
    await expect(heldItem).toContainText('Matched: weapons');
    await heldItem.getByRole('button', { name: 'Approve' }).click();
    await expect(page.getByText('Approved. It’s live again.')).toBeVisible();
    expect((await member.page.goto(`${LOCAL_URL}/l/${held.id}`))?.status()).toBe(200);

    const report = page
      .getByRole('region', { name: 'Open reports' })
      .getByRole('listitem')
      .filter({ hasText: chair });
    await report.getByRole('button', { name: 'Dismiss report' }).click();
    await expect(page.getByText('Report dismissed.')).toBeVisible();
    await expect(report).toHaveCount(0);
    expect((await member.page.goto(`${LOCAL_URL}/l/${fine.id}`))?.status()).toBe(200);
    await member.context.close();
    const audit = await localAdmin()
      .from('audit_log')
      .select('action')
      .in('target_id', [held.id])
      .eq('action', 'listing.approved');
    expect(audit.data).toHaveLength(1);
  });

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`axe: /admin with a held listing (${colorScheme})`, async ({ page }, testInfo) => {
      const held = await seedListing(testInfo, { title: 'Axe pistol case', needsReview: true });
      seeded.push(held);
      await staff(page, testInfo);
      await page.emulateMedia({ colorScheme });
      await page.goto(`${LOCAL_URL}/admin`);
      await expect(page.getByRole('heading', { level: 1, name: 'Moderation' })).toBeVisible();
      const results = await new AxeBuilder({ page }).analyze();
      const blocking = results.violations.filter(
        (v) => v.impact === 'serious' || v.impact === 'critical',
      );
      expect(
        blocking.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
      ).toEqual([]);
    });
  }
});

async function mediaIdOf(listingId: string): Promise<string> {
  const { data } = await localAdmin()
    .from('listing_media')
    .select('id')
    .eq('listing_id', listingId)
    .single();
  return (data as { id: string }).id;
}
