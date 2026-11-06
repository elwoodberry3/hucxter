import { expect, test } from '@playwright/test';
import { deleteSeeded, seedListing } from './helpers/listings';
import type { SeededListing } from './helpers/listings';
import { DESKTOP_ONLY, KEY_PAGES, SERVER_ONLY } from './support';

const seeded: SeededListing[] = [];
test.afterEach(async () => {
  await deleteSeeded(seeded.splice(0));
});

const STATIC_HEADERS = {
  'strict-transport-security': 'max-age=63072000; includeSubDomains',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
};

test.describe('security headers', () => {
  for (const path of ['/', '/api/health']) {
    test(`${path} sends the static security headers`, async ({ request }, testInfo) => {
      test.skip(testInfo.project.name !== 'desktop-1440', SERVER_ONLY);
      const headers = (await request.get(path)).headers();
      for (const [name, value] of Object.entries(STATIC_HEADERS)) {
        expect(headers[name], name).toBe(value);
      }
      expect(headers['permissions-policy']).toContain('camera=()');
      expect(headers['permissions-policy']).toContain('microphone=()');
      // Location chip: geolocation for this origin only, on user request.
      expect(headers['permissions-policy']).toContain('geolocation=(self)');
      expect(headers['x-powered-by']).toBeUndefined();
    });
  }

  test('pages send a nonce CSP that changes per request', async ({ request }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1440', SERVER_ONLY);
    const first = (await request.get('/')).headers()['content-security-policy'] ?? '';
    const second = (await request.get('/')).headers()['content-security-policy'] ?? '';

    expect(first).toContain("frame-ancestors 'none'");
    expect(first).toContain("object-src 'none'");
    expect(first).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
    expect(first).not.toContain('unsafe-eval');
    expect(first).not.toContain('unsafe-inline');

    const nonce = (csp: string) => /'nonce-([^']+)'/.exec(csp)?.[1];
    expect(nonce(first)).toBeDefined();
    expect(nonce(first)).not.toBe(nonce(second));
  });

  test('dotted page paths still get the page CSP', async ({ request }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1440', SERVER_ONLY);
    const csp = (await request.get('/u/john.doe')).headers()['content-security-policy'] ?? '';
    expect(csp).toMatch(/script-src 'self' 'nonce-/);
  });

  test('API routes get a deny-all CSP', async ({ request }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1440', SERVER_ONLY);
    expect((await request.get('/api/health')).headers()['content-security-policy']).toBe(
      "default-src 'none'; frame-ancestors 'none'",
    );
  });

  test('pages run under the CSP with no violations', async ({ page, isMobile }, testInfo) => {
    test.skip(isMobile, DESKTOP_ONLY);
    const violations: string[] = [];
    page.on('console', (message) => {
      if (/Content Security Policy|Refused to/i.test(message.text()))
        violations.push(message.text());
    });
    for (const path of KEY_PAGES) await page.goto(path);
    // Interactive surfaces too: mega menu, location popover, sign-in sheet, client navigation.
    // (The listing page with the player loaded: listing-page.spec.ts on :3103.)
    const listing = await seedListing(testInfo);
    seeded.push(listing);
    await page.goto(`/l/${listing.id}`);
    await page.getByRole('button', { name: 'All Categories' }).click();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /Near Portland/ }).click();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Report' }).filter({ visible: true }).click();
    await page.keyboard.press('Escape');
    await page
      .getByRole('navigation', { name: 'Categories', exact: true })
      .getByRole('link', { name: 'Fashion' })
      .click();
    await expect(page).toHaveURL('/c/fashion');
    expect(violations).toEqual([]);
  });

  test('server HTML has no inline style attributes or style tags without the nonce', async ({
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1440', SERVER_ONLY);
    for (const path of KEY_PAGES) {
      const response = await request.get(path);
      const nonce = /'nonce-([^']+)'/.exec(
        response.headers()['content-security-policy'] ?? '',
      )?.[1];
      const html = await response.text();
      expect(html.match(/<[a-z][^>]*\sstyle="/gi) ?? [], path).toEqual([]);
      for (const tag of html.match(/<style\b[^>]*>/gi) ?? [])
        expect(tag, path).toContain(`nonce="${nonce ?? ''}"`);
    }
  });

  test('images load from this origin only', async ({ page }) => {
    for (const path of KEY_PAGES) {
      await page.goto(path);
      const sources = await page
        .locator('img')
        .evaluateAll((images) => images.map((image) => (image as HTMLImageElement).currentSrc));
      for (const source of sources)
        expect(new URL(source).origin, path).toBe('http://localhost:3100');
    }
  });

  test('every server-rendered script tag carries the request nonce', async ({
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1440', SERVER_ONLY);
    for (const path of KEY_PAGES) {
      const response = await request.get(path);
      const nonce = /'nonce-([^']+)'/.exec(
        response.headers()['content-security-policy'] ?? '',
      )?.[1];
      expect(nonce, path).toBeDefined();
      const tags = (await response.text()).match(/<script\b[^>]*>/gi) ?? [];
      expect(tags.length, path).toBeGreaterThan(0);
      for (const tag of tags) expect(tag, path).toContain(`nonce="${nonce ?? ''}"`);
    }
    // Chunks the Next.js runtime loads after hydration are trusted via 'strict-dynamic' (no
    // nonce of their own); the no-violation tests above prove nothing is blocked.
  });
});
