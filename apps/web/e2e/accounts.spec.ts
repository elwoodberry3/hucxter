import { expect, test } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';
import {
  TEST_SMS_CODE,
  completeOnboarding,
  deleteE2eUsers,
  emailCode,
  emailCount,
  invite,
  signInWithEmail,
  testEmail,
  testPhone,
} from './helpers/accounts';
import { deleteSeeded, seedListing } from './helpers/listings';
import type { SeededListing } from './helpers/listings';
import { GATED_ROUTES, INVITE_OFF_URL } from './support';

// Accounts created here are deleted after each test (local stack, e2e addresses only).
const created: string[] = [];
const seeded: SeededListing[] = [];
test.afterEach(async () => {
  await deleteE2eUsers(created.splice(0));
  await deleteSeeded(seeded.splice(0));
});

/** A non-empty alert inside the page content (Next's route announcer is also role=alert). */
function alert(page: Page, text: string | RegExp) {
  return page.getByRole('main').getByRole('alert').filter({ hasText: text });
}

let lastSend = 0;

/**
 * On the email step: asks for a code and waits for the neutral "sent" answer. Sends are spaced
 * just over 1 s apart because local Supabase allows one email per address per second
 * ([auth.email] max_frequency), and a skipped email would make the counts below flaky.
 */
async function requestCode(page: Page, email: string) {
  const wait = lastSend + 1100 - Date.now();
  if (wait > 0) await page.waitForTimeout(wait);
  lastSend = Date.now();
  const main = page.getByRole('main');
  await main.getByLabel('Email').fill(email);
  await main.getByRole('button', { name: 'Send code' }).click();
  await expect(main.getByRole('status')).toHaveText(
    'We sent a code if this address can sign in. Check your inbox.',
  );
}

async function enterCode(page: Page, code: string) {
  const main = page.getByRole('main');
  await main.getByLabel('6-digit code').fill(code);
  await main.getByRole('button', { name: 'Continue' }).click();
}

function wrongCode(right: string): string {
  return right === '000000' ? '111111' : '000000';
}

async function newMember(testInfo: TestInfo, label = 'm'): Promise<string> {
  const email = testEmail(testInfo, label);
  created.push(email);
  await invite(email);
  return email;
}

/** Signs up and finishes onboarding; ends on `next` (default /settings). */
async function verifiedMember(page: Page, testInfo: TestInfo, slot: 0 | 1 = 0) {
  const email = await newMember(testInfo);
  await page.goto('/sign-in?next=%2Fsettings');
  await signInWithEmail(page, email);
  await completeOnboarding(page, testPhone(testInfo, slot));
  await expect(page).toHaveURL('/settings');
  return email;
}

interface CapturedAction {
  url: string;
  headers: Record<string, string>;
  body: string;
}

/** Captures (and blocks) the next server-action POST the page makes. */
async function captureAction(page: Page, trigger: () => Promise<void>): Promise<CapturedAction> {
  let captured: CapturedAction | null = null;
  await page.route('**/*', async (route) => {
    const request = route.request();
    if (request.method() === 'POST' && request.headers()['next-action'] !== undefined) {
      captured = { url: request.url(), headers: request.headers(), body: request.postData() ?? '' };
      await route.abort();
    } else {
      await route.continue();
    }
  });
  await trigger();
  await expect.poll(() => captured !== null, { message: 'server action request' }).toBe(true);
  await page.unrouteAll({ behavior: 'wait' });
  return captured as unknown as CapturedAction;
}

/** Replays a captured action with a chosen Origin, as a cross-site page would send it. */
function replay(page: Page, action: CapturedAction, origin: string, url: string) {
  return page.request.post(url, {
    headers: { ...action.headers, origin },
    data: action.body,
    maxRedirects: 0,
  });
}

test.describe('accounts (D-34)', () => {
  test('email sign-up → phone → 18+ → ZIP → name returns to next and completes the action', async ({
    page,
  }, testInfo) => {
    const email = await newMember(testInfo);
    await page.goto('/sell');
    await expect(page).toHaveURL('/sign-in?next=%2Fsell');
    await signInWithEmail(page, email);
    await expect(page).toHaveURL('/welcome?next=%2Fsell');
    await completeOnboarding(page, testPhone(testInfo));
    await expect(page).toHaveURL('/sell');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Add a video');
  });

  test('onboarding inputs use the right types and autofill hints', async ({ page }, testInfo) => {
    const email = await newMember(testInfo);
    await page.goto('/sign-in');
    await page.getByRole('main').getByRole('button', { name: 'Continue with email' }).click();
    await page.getByLabel('Email').fill(email);
    await page.getByRole('button', { name: 'Send code' }).click();
    const code = page.getByLabel('6-digit code');
    await expect(code).toHaveAttribute('inputmode', 'numeric');
    await expect(code).toHaveAttribute('autocomplete', 'one-time-code');
    await page.goto('/sign-in');
    await signInWithEmail(page, email);
    const phone = page.getByLabel('Mobile number');
    await expect(phone).toHaveAttribute('type', 'tel');
    await expect(phone).toHaveAttribute('autocomplete', 'tel');
    await phone.fill(testPhone(testInfo));
    await page.getByRole('button', { name: 'Text me a code' }).click();
    const sms = page.getByLabel('Code from the text');
    await expect(sms).toHaveAttribute('inputmode', 'numeric');
    await expect(sms).toHaveAttribute('autocomplete', 'one-time-code');
  });

  test('onboarding resumes at the right step after a reload', async ({ page }, testInfo) => {
    const email = await newMember(testInfo);
    await page.goto('/sign-in?next=%2Fsaved');
    await signInWithEmail(page, email);
    await page.getByLabel('Mobile number').fill(testPhone(testInfo));
    await page.getByRole('button', { name: 'Text me a code' }).click();
    await page.getByLabel('Code from the text').fill(TEST_SMS_CODE);
    await page.getByRole('button', { name: 'Verify' }).click();
    await expect(page.getByRole('heading', { name: 'Confirm your age' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Confirm your age' })).toBeVisible();
    await expect(page.getByText('Step 2 of 4')).toBeVisible();
  });

  test('unverified members are sent to /welcome from every gated route and action', async ({
    page,
  }, testInfo) => {
    const email = await newMember(testInfo);
    await page.goto('/sign-in');
    await signInWithEmail(page, email);
    await expect(page).toHaveURL('/welcome');
    for (const route of GATED_ROUTES) {
      await page.goto(route);
      await expect(page, route).toHaveURL(`/welcome?next=${encodeURIComponent(route)}`);
    }
    expect((await page.request.get('/admin')).status()).toBe(404);

    const listing = await seedListing(testInfo);
    seeded.push(listing);
    await page.goto(`/l/${listing.id}`);
    await page
      .getByRole('main')
      .getByRole('button', { name: 'Report' })
      .filter({ visible: true })
      .click();
    await expect(page).toHaveURL(`/welcome?next=${encodeURIComponent(`/l/${listing.id}`)}`);
  });

  test('a number already on another account gets a neutral error', async ({
    browser,
  }, testInfo) => {
    const first = await browser.newContext();
    const firstPage = await first.newPage();
    await verifiedMember(firstPage, testInfo);
    await first.close();

    const page = await browser.newPage();
    const email = await newMember(testInfo, 'dup');
    await page.goto('/sign-in');
    await signInWithEmail(page, email);
    await page.getByLabel('Mobile number').fill(testPhone(testInfo));
    await page.getByRole('button', { name: 'Text me a code' }).click();
    await expect(
      alert(page, 'We can’t use that number. Try a different mobile number.'),
    ).toBeVisible();
    await page.close();
  });

  test('non-US, toll-free, and malformed numbers are refused before any SMS', async ({
    page,
  }, testInfo) => {
    const email = await newMember(testInfo);
    await page.goto('/sign-in');
    await signInWithEmail(page, email);
    for (const [number, message] of [
      ['+44 20 7946 0958', 'Enter a US mobile number (+1).'],
      ['800 234 5678', 'That number can’t receive codes. Use a US mobile number.'],
      ['503 234 567', 'Enter a 10-digit US mobile number.'],
    ] as const) {
      await page.getByLabel('Mobile number').fill(number);
      await page.getByRole('button', { name: 'Text me a code' }).click();
      await expect(alert(page, message)).toBeVisible();
    }
  });

  test('phone codes are limited per number per hour (friendly retry message)', async ({
    page,
  }, testInfo) => {
    const email = await newMember(testInfo);
    await page.goto('/sign-in');
    await signInWithEmail(page, email);
    for (let send = 1; send <= 3; send += 1) {
      await page.getByLabel('Mobile number').fill(testPhone(testInfo));
      await page.getByRole('button', { name: 'Text me a code' }).click();
      await expect(page.getByLabel('Code from the text')).toBeVisible();
      await page.getByRole('button', { name: /Use a different number/ }).click();
      // Supabase's own per-user resend floor (max_frequency, 1 s locally).
      await page.waitForTimeout(1100);
    }
    await page.getByLabel('Mobile number').fill(testPhone(testInfo));
    await page.getByRole('button', { name: 'Text me a code' }).click();
    await expect(
      alert(page, /^Too many codes requested\. Try again in \d+ minutes?\.$/),
    ).toBeVisible();
  });

  // Email-code limits (Brief 03C.1 §3.0): checks are bound to the browser that asked for the code,
  // and wrong codes never start a timed lock, so nobody without the inbox can block its owner.
  test("wrong email codes end this browser's tries, then a new code works (no timed lock)", async ({
    page,
  }, testInfo) => {
    const email = await newMember(testInfo);
    await page.goto('/sign-in');
    const main = page.getByRole('main');
    await main.getByRole('button', { name: 'Continue with email' }).click();
    let started = new Date(Date.now() - 1000);
    await requestCode(page, email);
    const wrong = wrongCode(await emailCode(email, started));
    for (let check = 1; check <= 5; check += 1) {
      await enterCode(page, wrong);
      await expect(
        alert(page, 'That code didn’t work. Check it, or send a new one.'),
      ).toBeVisible();
    }
    await enterCode(page, wrong);
    await expect(
      alert(page, 'That code has expired or was replaced. Send a new code.'),
    ).toBeVisible();

    await main.getByRole('button', { name: 'Send a new code' }).click();
    started = new Date(Date.now() - 1000);
    await requestCode(page, email);
    await enterCode(page, await emailCode(email, started));
    await expect(page).toHaveURL(/\/welcome/);
  });

  test('someone guessing from other browsers cannot block the inbox owner', async ({
    browser,
    page,
  }, testInfo) => {
    const email = await newMember(testInfo);
    await page.goto('/sign-in');
    await page.getByRole('main').getByRole('button', { name: 'Continue with email' }).click();
    await requestCode(page, email);

    // Four attacker browsers ask for codes and guess: 20 wrong checks pass the 15 ceiling, which
    // invalidates every outstanding code (the owner's too) instead of locking the address.
    for (let attacker = 1; attacker <= 4; attacker += 1) {
      const context = await browser.newContext();
      const other = await context.newPage();
      await other.goto('/sign-in');
      await other.getByRole('main').getByRole('button', { name: 'Continue with email' }).click();
      const started = new Date(Date.now() - 1000);
      await requestCode(other, email);
      const wrong = wrongCode(await emailCode(email, started));
      for (let check = 1; check <= 5; check += 1) {
        await enterCode(other, wrong);
        await expect(alert(other, /code/)).toBeVisible();
      }
      await context.close();
    }

    // The owner asks for a fresh code from their own browser and signs in.
    await page.getByRole('main').getByRole('button', { name: 'Send a new code' }).click();
    const started = new Date(Date.now() - 1000);
    await requestCode(page, email);
    await enterCode(page, await emailCode(email, started));
    await expect(page).toHaveURL(/\/welcome/);
  });

  test("a known device still gets a code after someone uses up the address's sends", async ({
    browser,
    context,
    page,
  }, testInfo) => {
    const email = await newMember(testInfo);
    // The owner signed in on this browser before: it holds the known-device cookie.
    await page.goto('/sign-in');
    await signInWithEmail(page, email);
    await expect(page).toHaveURL(/\/welcome/);
    await context.clearCookies({ name: /^sb-/ });
    expect(await emailCount(email)).toBe(1);

    // An attacker uses up the address pool (6 an hour) and the overflow slot (1 per 10 min).
    const sends = [3, 3, 1];
    for (const count of sends) {
      const attacker = await browser.newContext();
      const other = await attacker.newPage();
      await other.goto('/sign-in');
      await other.getByRole('main').getByRole('button', { name: 'Continue with email' }).click();
      for (let send = 1; send <= count; send += 1) {
        await requestCode(other, email);
        await other.getByRole('main').getByRole('button', { name: 'Send a new code' }).click();
      }
      await attacker.close();
    }
    // 1 (owner) + 5 normal + 1 overflow went out; the last attacker request got the neutral reply.
    await expect.poll(() => emailCount(email)).toBe(7);

    await page.goto('/sign-in');
    await signInWithEmail(page, email);
    await expect(page).toHaveURL(/\/welcome/);
    expect(await emailCount(email)).toBe(8);
  });

  test('email code sends are limited per browser, and the answer stays the same (no enumeration)', async ({
    page,
  }, testInfo) => {
    const email = await newMember(testInfo);
    await page.goto('/sign-in');
    const main = page.getByRole('main');
    await main.getByRole('button', { name: 'Continue with email' }).click();
    for (let send = 1; send <= 4; send += 1) {
      await requestCode(page, email);
      await main.getByRole('button', { name: 'Send a new code' }).click();
    }
    await expect.poll(() => emailCount(email)).toBe(3);

    // An address with no account gets exactly the same answer.
    const stranger = testEmail(testInfo, 'nobody');
    created.push(stranger);
    await requestCode(page, stranger);
  });

  test('sign out everywhere ends the session in another browser', async ({ browser }, testInfo) => {
    const a = await browser.newContext();
    const pageA = await a.newPage();
    const email = await verifiedMember(pageA, testInfo);

    const b = await browser.newContext();
    const pageB = await b.newPage();
    await pageB.goto('/sign-in?next=%2Fsettings');
    await signInWithEmail(pageB, email);
    await expect(pageB).toHaveURL('/settings');
    await expect(pageB.getByText('This device')).toHaveCount(1);
    // Both browsers are listed (verifying the phone also starts a fresh session in A).
    expect(
      await pageB.getByRole('region', { name: 'Where you’re signed in' }).locator('li').count(),
    ).toBeGreaterThanOrEqual(2);

    await pageA.getByRole('button', { name: 'Sign out everywhere' }).click();
    await expect(pageA).toHaveURL('/');
    await pageB.goto('/settings');
    await expect(pageB).toHaveURL('/sign-in?next=%2Fsettings');
    await a.close();
    await b.close();
  });

  test('deleting the account revokes its sessions; the old cookies no longer work', async ({
    browser,
  }, testInfo) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const email = await verifiedMember(page, testInfo);
    const oldCookies = await context.cookies();

    await page.getByLabel('Type DELETE to confirm').fill('DELETE');
    await page.getByRole('button', { name: 'Delete my account' }).click();
    await expect(page).toHaveURL('/?deleted=1');

    const replay = await browser.newContext();
    await replay.addCookies(oldCookies);
    const replayPage = await replay.newPage();
    await replayPage.goto('/settings');
    await expect(replayPage).toHaveURL('/sign-in?next=%2Fsettings');

    // Signing in again starts a brand-new account at the first onboarding step.
    await replayPage.goto('/sign-in');
    await signInWithEmail(replayPage, email);
    await expect(replayPage.getByRole('heading', { name: 'Verify your phone' })).toBeVisible();
    await context.close();
    await replay.close();
  });

  test('settings: profile updates and the session list shows no IP', async ({ page }, testInfo) => {
    await verifiedMember(page, testInfo);
    await page.getByLabel('Display name').fill('Robin');
    await page.getByLabel('Home ZIP').fill('98660');
    await page.getByRole('button', { name: 'Save profile' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Saved.' })).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Display name')).toHaveValue('Robin');
    await expect(page.getByLabel('Home ZIP')).toHaveValue('98660');
    const sessions = await page.getByRole('region', { name: 'Where you’re signed in' }).innerText();
    expect(sessions).not.toMatch(/\b\d{1,3}(\.\d{1,3}){3}\b|::1|127\.0\.0\.1/);
  });

  test('session cookies are httpOnly and SameSite=Lax', async ({ page, context }, testInfo) => {
    await verifiedMember(page, testInfo);
    const auth = (await context.cookies()).filter(({ name }) => name.includes('-auth-token'));
    expect(auth.length).toBeGreaterThan(0);
    for (const cookie of auth) {
      expect(cookie.httpOnly, cookie.name).toBe(true);
      expect(cookie.sameSite, cookie.name).toBe('Lax');
    }
    expect(await page.evaluate(() => document.cookie)).not.toContain('auth-token');
    // Email-code browser binding and known-device cookies (§3.0): httpOnly, never script-readable.
    const cookies = await context.cookies();
    const codeBrowser = cookies.find(({ name }) => name === 'hx_ec');
    const knownDevice = cookies.find(({ name }) => name === 'hx_kd');
    expect(codeBrowser?.httpOnly).toBe(true);
    expect(codeBrowser?.sameSite).toBe('Strict');
    expect(knownDevice?.httpOnly).toBe(true);
    expect(knownDevice?.sameSite).toBe('Lax');
    expect(await page.evaluate(() => document.cookie)).not.toMatch(/hx_ec|hx_kd/);
  });
});

test.describe('invite gate', () => {
  test('INVITE_ONLY on: an uninvited email sees the closed-test screen', async ({
    page,
  }, testInfo) => {
    const email = testEmail(testInfo, 'uninvited');
    created.push(email);
    await page.goto('/sign-in?next=%2Fsell');
    await signInWithEmail(page, email);
    await expect(page).toHaveURL('/welcome?next=%2Fsell');
    await expect(
      alert(page, 'Hucxter is in a closed test. Ask the team for an invite.'),
    ).toBeVisible();
    await expect(page.getByLabel('Mobile number')).toHaveCount(0);
    await page.goto('/sell');
    await expect(page).toHaveURL('/welcome?next=%2Fsell');
  });

  test('INVITE_ONLY off: an uninvited email can finish sign-up', async ({ page }, testInfo) => {
    const email = testEmail(testInfo, 'open');
    created.push(email);
    await page.goto(`${INVITE_OFF_URL}/sign-in?next=%2Fsell`);
    await signInWithEmail(page, email);
    await completeOnboarding(page, testPhone(testInfo));
    await expect(page).toHaveURL(`${INVITE_OFF_URL}/sell`);
  });
});

test.describe('CSRF and redirects', () => {
  test('server actions with a foreign or mismatched Origin change nothing', async ({
    page,
  }, testInfo) => {
    const email = await newMember(testInfo);
    const action = await captureAction(page, async () => {
      await page.goto('/sign-in');
      const main = page.getByRole('main');
      await main.getByRole('button', { name: 'Continue with email' }).click();
      await main.getByLabel('Email').fill(email);
      await main.getByRole('button', { name: 'Send code' }).click();
    });
    // Foreign Origin: Next.js refuses the action before our code runs.
    const foreign = await replay(page, action, 'https://evil.example', action.url);
    expect(foreign.status()).toBeGreaterThanOrEqual(400);
    // Same host as the request, but not APP_ORIGIN (127.0.0.1 vs localhost): passes Next's own
    // check, so this exercises ours (requestIsSameOrigin).
    const sameHost = action.url.replace('localhost', '127.0.0.1');
    const mismatched = await replay(page, action, 'http://127.0.0.1:3100', sameHost);
    expect(await mismatched.text()).toContain('This request didn’t come from Hucxter');
    await page.waitForTimeout(1500);
    expect(await emailCount(email)).toBe(0);
  });

  test('location and launch-notice actions with a mismatched Origin set no cookie', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1440', 'One HTTP-level check is enough');
    const action = await captureAction(page, async () => {
      await page.goto('/');
      await page.getByRole('button', { name: /Near Portland 97205\?/ }).click();
      const popover = page.getByRole('dialog', { name: 'Your location' });
      await popover.getByLabel('ZIP code').fill('76102');
      await popover.getByRole('button', { name: 'Update location' }).click();
    });
    const sameHost = action.url.replace('localhost', '127.0.0.1');
    const mismatched = await replay(page, action, 'http://127.0.0.1:3100', sameHost);
    expect(await mismatched.text()).toContain('This request didn’t come from Hucxter');
    expect(mismatched.headers()['set-cookie'] ?? '').not.toContain('hx_loc');
  });

  test('sign out everywhere replayed cross-origin keeps the session', async ({
    page,
  }, testInfo) => {
    await verifiedMember(page, testInfo);
    const action = await captureAction(page, async () => {
      await page.getByRole('button', { name: 'Sign out everywhere' }).click();
    });
    const foreign = await replay(page, action, 'https://evil.example', action.url);
    expect(foreign.status()).toBeGreaterThanOrEqual(400);
    await replay(
      page,
      action,
      'http://127.0.0.1:3100',
      action.url.replace('localhost', '127.0.0.1'),
    );
    await page.goto('/settings');
    await expect(page).toHaveURL('/settings');
  });

  test('Google start refuses cross-site requests; callback drops hostile next values', async ({
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1440', 'server-side check, runs once');
    const crossSite = await request.get('/auth/google?next=%2Fsell', {
      headers: { 'sec-fetch-site': 'cross-site' },
      maxRedirects: 0,
    });
    expect(crossSite.status()).toBe(403);

    for (const next of [
      'https://evil.example',
      '//evil.example',
      '%2F%2Fevil.example',
      '/\\evil.example',
      '/%5Cevil.example',
    ]) {
      const response = await request.get(`/auth/callback?next=${encodeURIComponent(next)}`, {
        maxRedirects: 0,
      });
      expect(response.status()).toBe(303);
      const location = response.headers().location ?? '';
      expect(new URL(location).origin).toBe('http://localhost:3100');
      expect(location).not.toContain('evil.example');
      expect(location).toContain('/sign-in?error=failed');
    }
  });
});
