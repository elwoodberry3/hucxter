import { expect, test } from '@playwright/test';
import { KEY_PAGES } from './support';

const STATIC_HEADERS = {
  'strict-transport-security': 'max-age=63072000; includeSubDomains',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
};

test.describe('security headers', () => {
  for (const path of ['/', '/api/health']) {
    test(`${path} sends the static security headers`, async ({ request }) => {
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

  test('pages send a nonce CSP that changes per request', async ({ request }) => {
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

  test('dotted page paths still get the page CSP', async ({ request }) => {
    const csp = (await request.get('/u/john.doe')).headers()['content-security-policy'] ?? '';
    expect(csp).toMatch(/script-src 'self' 'nonce-/);
  });

  test('API routes get a deny-all CSP', async ({ request }) => {
    expect((await request.get('/api/health')).headers()['content-security-policy']).toBe(
      "default-src 'none'; frame-ancestors 'none'",
    );
  });

  test('pages run under the CSP with no violations', async ({ page }) => {
    const violations: string[] = [];
    page.on('console', (message) => {
      if (/Content Security Policy/i.test(message.text())) violations.push(message.text());
    });
    for (const path of KEY_PAGES) await page.goto(path);
    // Interactive surfaces too: mega menu, location popover, sign-in sheet, client navigation.
    await page.goto('/dev/templates/listing');
    await page.getByRole('button', { name: 'All Categories' }).click();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /Near Celina/ }).click();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Is this still available?' }).click();
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
  }) => {
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

  test('script tags carry the request nonce', async ({ page }) => {
    const response = await page.goto('/');
    const nonce = /'nonce-([^']+)'/.exec(response?.headers()['content-security-policy'] ?? '')?.[1];
    const scriptNonces = await page
      .locator('script')
      .evaluateAll((scripts) => scripts.map((script) => (script as HTMLScriptElement).nonce));
    expect(scriptNonces.length).toBeGreaterThan(0);
    for (const value of scriptNonces) expect(value).toBe(nonce);
  });
});
