import { randomUUID } from 'node:crypto';
import type { Page, TestInfo } from '@playwright/test';
import { expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { E2E_EMAIL_DOMAIN, assertLocalSupabase, isE2eEmail } from './local-guard';

/** Fixed code for the fictional numbers in supabase/config.toml [auth.sms.test_otp]. */
export const TEST_SMS_CODE = '123456';
const FIRST_TEST_NUMBER = 100;
const TEST_NUMBERS = 40;

let admin: SupabaseClient | undefined;

/** Service-role client for the LOCAL stack only (guarded). Never used by the app under test. */
export function localAdmin(): SupabaseClient {
  if (admin === undefined) {
    const url = assertLocalSupabase(process.env.SUPABASE_URL);
    const key = process.env.SUPABASE_SECRET_KEY;
    if (key === undefined) throw new Error('SUPABASE_SECRET_KEY missing (from supabase status)');
    admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return admin;
}

/** A unique test address. Never printed by the tests. */
export function testEmail(testInfo: TestInfo, label = 'm'): string {
  const project = testInfo.project.name.replace(/[^a-z0-9]/g, '');
  return `${label}-${project}-${randomUUID().slice(0, 8)}${E2E_EMAIL_DOMAIN}`;
}

/**
 * A fictional test number reserved for this worker (`slot` 0 or 1), so parallel workers never
 * collide on "one account per phone". Accounts are deleted after each test, freeing it again.
 */
export function testPhone(testInfo: TestInfo, slot: 0 | 1 = 0): string {
  const n = FIRST_TEST_NUMBER + ((testInfo.parallelIndex * 2 + slot) % TEST_NUMBERS);
  return `(503) 555-0${String(n)}`;
}

export async function invite(email: string): Promise<void> {
  if (!isE2eEmail(email)) throw new Error('Only e2e addresses can be invited by tests');
  const { error } = await localAdmin().from('qa_invites').insert({ email, note: 'e2e' });
  if (error !== null) throw new Error('Could not add the e2e invite');
}

/** Deletes test users (and their invites). Only addresses on the e2e domain, only locally. */
export async function deleteE2eUsers(only?: string[]): Promise<void> {
  const db = localAdmin();
  const targets = new Set(only?.map((email) => email.toLowerCase()));
  for (let page = 1; page < 100; page += 1) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error !== null) throw new Error('Could not list local users');
    for (const user of data.users) {
      if (!isE2eEmail(user.email)) continue;
      if (only !== undefined && !targets.has((user.email ?? '').toLowerCase())) continue;
      await db.auth.admin.deleteUser(user.id);
    }
    if (data.users.length < 200) break;
  }
  const emails = only ?? [];
  if (only === undefined) {
    await db.from('qa_invites').delete().like('email', `%${E2E_EMAIL_DOMAIN}`);
  } else if (emails.length > 0) {
    await db.from('qa_invites').delete().in('email', emails.filter(isE2eEmail));
  }
}

interface MailpitSearch {
  messages: { ID: string; Created: string }[];
}

/** Reads the newest 6-digit code sent to `email` from Mailpit (local stack only). */
export async function emailCode(email: string, after: Date = new Date(0)): Promise<string> {
  const base = process.env.MAILPIT_URL;
  if (base === undefined) throw new Error('MAILPIT_URL missing (from supabase status)');
  assertLocalSupabase(base);
  let code: string | undefined;
  await expect
    .poll(
      async () => {
        const search = (await (
          await fetch(`${base}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`)
        ).json()) as MailpitSearch;
        const newest = search.messages.find((m) => new Date(m.Created) >= after);
        if (newest === undefined) return false;
        const message = (await (await fetch(`${base}/api/v1/message/${newest.ID}`)).json()) as {
          Text: string;
        };
        code = /\b(\d{6})\b/.exec(message.Text)?.[1];
        return code !== undefined;
      },
      { timeout: 15_000, message: 'email code arrives in Mailpit' },
    )
    .toBe(true);
  return code ?? '';
}

/** How many emails Mailpit holds for this address. */
export async function emailCount(email: string): Promise<number> {
  const base = process.env.MAILPIT_URL ?? '';
  const search = (await (
    await fetch(`${base}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`)
  ).json()) as MailpitSearch;
  return search.messages.length;
}

/** On a sign-in/sign-up page (or open sheet), signs in with an email code. */
export async function signInWithEmail(page: Page, email: string, scope = page.getByRole('main')) {
  const started = new Date(Date.now() - 1000);
  await scope.getByRole('button', { name: 'Continue with email' }).click();
  await scope.getByLabel('Email').fill(email);
  await scope.getByRole('button', { name: 'Send code' }).click();
  await expect(scope.getByRole('status')).toContainText(
    'We sent a code if this address can sign in',
  );
  await scope.getByLabel('6-digit code').fill(await emailCode(email, started));
  await scope.getByRole('button', { name: 'Continue' }).click();
}

/** Completes /welcome from the phone step: phone + code, 18+, ZIP, display name. */
export async function completeOnboarding(
  page: Page,
  phone: string,
  { zip = '97205', name = 'Sam' }: { zip?: string; name?: string } = {},
) {
  await expect(page.getByRole('heading', { name: 'Verify your phone' })).toBeVisible();
  await page.getByLabel('Mobile number').fill(phone);
  await page.getByRole('button', { name: 'Text me a code' }).click();
  await page.getByLabel('Code from the text').fill(TEST_SMS_CODE);
  await page.getByRole('button', { name: 'Verify' }).click();
  await expect(page.getByRole('heading', { name: 'Confirm your age' })).toBeVisible();
  await page.getByLabel('I’m 18 or older.').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Set your home ZIP' })).toBeVisible();
  await page.getByLabel('What’s your home ZIP?').fill(zip);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Choose a display name' })).toBeVisible();
  await page.getByLabel('What should people call you?').fill(name);
  await page.getByRole('button', { name: 'Finish' }).click();
}
