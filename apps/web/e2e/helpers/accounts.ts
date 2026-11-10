import { createHmac, randomBytes, randomUUID } from 'node:crypto';
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
      // Limiter rows outlive deleted accounts (on purpose), so clear the test account's own rows
      // first or the shared test numbers would hit the per-number limit in later tests.
      await db.from('otp_send_attempts').delete().eq('user_id', user.id);
      await db.auth.admin.deleteUser(user.id);
    }
    if (data.users.length < 200) break;
  }
  // Phone rows of accounts deleted through the app (the deletion test) or in an interrupted run
  // become orphans (user_id null) on a shared test number. Local stack only.
  await db
    .from('otp_send_attempts')
    .delete()
    .is('user_id', null)
    .in('kind', ['phone', 'phone_check']);
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

/**
 * Signs up a new e2e member at `base` (default: the test's baseURL) and finishes onboarding.
 * Returns the address so the test can delete the account afterwards.
 */
export async function signUpVerified(
  page: Page,
  testInfo: TestInfo,
  {
    base = '',
    slot = 0,
    label = 'm',
    zip,
    name,
  }: { base?: string; slot?: 0 | 1; label?: string; zip?: string; name?: string } = {},
): Promise<string> {
  const email = testEmail(testInfo, label);
  await invite(email);
  await page.goto(`${base}/sign-in?next=%2Fsettings`);
  await signInWithEmail(page, email);
  await completeOnboarding(page, testPhone(testInfo, slot), {
    ...(zip === undefined ? {} : { zip }),
    ...(name === undefined ? {} : { name }),
  });
  await expect(page).toHaveURL(`${base}/settings`);
  return email;
}

/** The local user id for an e2e address. */
export async function userIdFor(email: string): Promise<string> {
  if (!isE2eEmail(email)) throw new Error('Only e2e addresses');
  for (let page = 1; page < 100; page += 1) {
    const { data, error } = await localAdmin().auth.admin.listUsers({ page, perPage: 200 });
    if (error !== null) throw new Error('Could not list local users');
    const user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (user !== undefined) return user.id;
    if (data.users.length < 200) break;
  }
  throw new Error('e2e user not found');
}

/** The generated @handle of a local e2e user (set when the display name is). */
export async function handleFor(userId: string): Promise<string> {
  const { data, error } = await localAdmin()
    .from('profiles')
    .select('handle')
    .eq('id', userId)
    .single();
  const handle: unknown = (data as Record<string, unknown> | null)?.handle;
  if (error !== null || typeof handle !== 'string') throw new Error('no handle');
  return handle;
}

/**
 * The app's keyed hash of an email address (subjectHash in src/server/admin-db.ts, same key
 * derivation), so a test can seed email-code rows for its own address on the LOCAL stack.
 */
function localEmailHash(email: string): string {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (secret === undefined) throw new Error('SUPABASE_SECRET_KEY missing (from supabase status)');
  const key = createHmac('sha256', secret).update('hucxter-otp-limits-v1').digest();
  return createHmac('sha256', key).update(`email:${email.toLowerCase()}`).digest('hex');
}

/**
 * Seeds `count` wrong email-code checks for an address from throwaway browsers (Brief 03C.1b
 * H2), through the real functions with generous limits, so the app's daily cap applies next.
 */
export async function seedWrongEmailChecks(email: string, count: number): Promise<void> {
  const db = localAdmin();
  const emailHash = localEmailHash(email);
  const send = async (browserHash: string) => {
    const sent = await db.rpc('email_code_send', {
      p_email_hash: emailHash,
      p_browser_hash: browserHash,
      p_device_hash: null,
      p_checks_per_send: 10,
      p_browser_per_hour: 100,
      p_email_per_hour: 100,
      p_overflow_spacing_s: 600,
      p_overflow_checks: 3,
      p_known_per_hour: 3,
      p_session_ttl_s: 600,
      p_daily_wrong_cap: 1000,
      p_trickle_spacing_s: 3600,
      p_trickle_checks: 2,
    });
    if (sent.error !== null) throw new Error(`seed send failed: ${sent.error.code}`);
  };
  const check = (browserHash: string, ceiling: number) =>
    db.rpc('email_code_check_begin', {
      p_email_hash: emailHash,
      p_browser_hash: browserHash,
      p_ceiling: ceiling,
      p_session_ttl_s: 600,
      p_daily_wrong_cap: 1000,
    });
  for (let done = 0; done < count; done += 10) {
    const browserHash = randomBytes(32).toString('hex');
    await send(browserHash);
    for (let n = 0; n < Math.min(10, count - done); n += 1) {
      const begun = await check(browserHash, 1000);
      if (begun.error !== null || begun.data === null) throw new Error('seed check failed');
    }
  }
  // Real guessing passes the hourly ceiling (15) on the way: record that hit, as the app would,
  // so only the daily cap is in play for the next code.
  const last = randomBytes(32).toString('hex');
  await send(last);
  const ceiling = await check(last, 0);
  if (ceiling.error !== null || ceiling.data !== null) throw new Error('seed ceiling failed');
}
