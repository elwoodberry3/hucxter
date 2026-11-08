import { expect, test } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';
import { deleteE2eUsers, handleFor, signUpVerified } from './helpers/accounts';
import { deleteSeeded, seedListing } from './helpers/listings';
import type { SeededListing } from './helpers/listings';
import { SERVER_ONLY } from './support';

// Brief 03C.1b H5: a stale or invalid session (e.g. after `supabase db reset`) never breaks a page
// for a visitor. Reads fall back to a guest, and the session cookies are cleared.
const seeded: SeededListing[] = [];
const members: string[] = [];
test.afterEach(async () => {
  await deleteSeeded(seeded.splice(0));
  await deleteE2eUsers(members.splice(0));
});

const AUTH_COOKIE = /^sb-.+-auth-token(\.\d+)?$/;

async function authCookies(context: BrowserContext) {
  return (await context.cookies()).filter((cookie) => AUTH_COOKIE.test(cookie.name));
}

/** Replaces the session's access token signature, keeping the cookie's shape. */
async function tamperSession(context: BrowserContext) {
  const cookies = (await authCookies(context)).sort((a, b) => a.name.localeCompare(b.name));
  expect(cookies.length).toBeGreaterThan(0);
  const raw = cookies.map((cookie) => cookie.value).join('');
  const json = raw.startsWith('base64-')
    ? Buffer.from(raw.slice('base64-'.length), 'base64url').toString('utf8')
    : decodeURIComponent(raw);
  const session = JSON.parse(json) as { access_token: string };
  const [header, payload] = session.access_token.split('.');
  session.access_token = `${header ?? ''}.${payload ?? ''}.${'A'.repeat(43)}`;
  const value = `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`;
  const base = cookies[0];
  if (base === undefined) throw new Error('no auth cookie');
  const name = base.name.replace(/\.\d+$/, '');
  // @supabase/ssr chunks long values as <name>.0, <name>.1, … (3180 characters each).
  const chunks = value.match(/.{1,3180}/g) ?? [];
  await context.clearCookies({ name: AUTH_COOKIE });
  await context.addCookies(
    chunks.length === 1
      ? [{ ...base, name, value }]
      : chunks.map((chunk, i) => ({ ...base, name: `${name}.${String(i)}`, value: chunk })),
  );
}

async function expectGuestPages(page: Page, listingId: string, handle: string) {
  for (const path of ['/', '/c/electronics', `/l/${listingId}`, `/u/${handle}`]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    await expect(page.getByRole('banner').getByRole('button', { name: 'Sign in' })).toBeVisible();
  }
}

test.describe('stale sessions (Brief 03C.1b H5)', () => {
  test.skip(({ isMobile, viewport }) => isMobile || viewport?.width !== 1440, SERVER_ONLY);

  test('a tampered session cookie: pages render as a guest and the cookies are cleared', async ({
    page,
    context,
  }, testInfo) => {
    const listing = await seedListing(testInfo);
    seeded.push(listing);
    members.push(await signUpVerified(page, testInfo));
    await tamperSession(context);
    await expectGuestPages(page, listing.id, await handleFor(listing.sellerId));
    await expect.poll(async () => (await authCookies(context)).length).toBe(0);
  });

  test('a member deleted while signed in (as after a database reset): guest pages, cookies cleared', async ({
    page,
    context,
  }, testInfo) => {
    const listing = await seedListing(testInfo);
    seeded.push(listing);
    const email = await signUpVerified(page, testInfo);
    await deleteE2eUsers([email]);
    await expectGuestPages(page, listing.id, await handleFor(listing.sellerId));
    await expect.poll(async () => (await authCookies(context)).length).toBe(0);
  });
});
