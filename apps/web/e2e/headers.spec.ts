import { expect, test } from '@playwright/test';

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
      expect(headers['permissions-policy']).toContain('geolocation=()');
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

  test('the page runs under the CSP with no violations', async ({ page }) => {
    const violations: string[] = [];
    page.on('console', (message) => {
      if (/Content Security Policy/i.test(message.text())) violations.push(message.text());
    });
    await page.goto('/');
    await page.getByRole('link', { name: 'Search', exact: true }).first().click();
    await expect(page).toHaveURL('/search');
    expect(violations).toEqual([]);
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
