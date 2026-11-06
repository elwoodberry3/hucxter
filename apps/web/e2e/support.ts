import type { APIRequestContext } from '@playwright/test';

/** Second test server: same build with APP_ENV=production (see playwright.config.ts). */
export const PRODUCTION_URL = 'http://localhost:3101';

/** Third test server: APP_ENV=qa with INVITE_ONLY=false (see playwright.config.ts). */
export const INVITE_OFF_URL = 'http://localhost:3102';

/** Fourth test server: APP_ENV=local, VIDEO_PROVIDER=fake, invite gate off. */
export const LOCAL_URL = 'http://localhost:3103';

export const GATED_ROUTES = ['/sell', '/messages', '/saved', '/listings', '/profile', '/settings'];

/** Pages covered by the axe and CSP checks. */
export const KEY_PAGES = [
  '/',
  '/c/electronics',
  '/c/electronics/phones-tablets',
  '/search?q=desk',
  '/sign-in?next=%2Fsell',
  '/sign-up',
  '/terms',
  '/dev/templates/listing',
  '/discover',
];

/** Skip-group reasons (reported per project in the PR). */
export const DESKTOP_ONLY =
  'desktop layout (ADR-0009); the phone layout is covered by mobile.spec.ts';
export const MOBILE_ONLY = 'phone layout (ADR-0011); desktop is covered by the desktop specs';
export const SERVER_ONLY =
  'server-side/HTTP check with no layout dependence; runs once in desktop-1440';

/**
 * WebKit (Playwright's build) logs one CSP "Refused to apply a stylesheet" message per <select>
 * element, from its own internal styles: a bare <select> under a strict style-src triggers it with
 * no page styles at all. It is not our code, so CSP checks ignore exactly that message in WebKit.
 * Verify on a physical iPhone during manual QA.
 */
export function isWebKitSelectNoise(text: string, browserName: string): boolean {
  return (
    browserName === 'webkit' &&
    text.startsWith('Refused to apply a stylesheet because its hash, its nonce, or')
  );
}

/**
 * Every department and subcategory URL, discovered from rendered pages (the nav reads the
 * taxonomy rows): departments from the home page, subcategories from each department's chips.
 */
export async function categoryUrls(request: APIRequestContext): Promise<string[]> {
  const home = await (await request.get('/')).text();
  const departments = [
    ...new Set([...home.matchAll(/href="(\/c\/[a-z0-9-]+)"/g)].map((m) => m[1] ?? '')),
  ];
  const urls = [...departments];
  for (const department of departments) {
    const html = await (await request.get(department)).text();
    for (const match of html.matchAll(new RegExp(`href="(${department}/[a-z0-9-]+)"`, 'g'))) {
      urls.push(match[1] ?? '');
    }
  }
  return [...new Set(urls)].filter(Boolean);
}
