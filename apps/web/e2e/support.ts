import type { APIRequestContext } from '@playwright/test';

/** Second test server: same build with APP_ENV=production (see playwright.config.ts). */
export const PRODUCTION_URL = 'http://localhost:3101';

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
];

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
