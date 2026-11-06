import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import {
  TEST_SMS_CODE,
  deleteE2eUsers,
  emailCode,
  invite,
  testEmail,
  testPhone,
} from './helpers/accounts';
import { deleteSeeded, seedListing } from './helpers/listings';
import type { SeededListing } from './helpers/listings';

// Accounts created here are deleted after each test (local stack, e2e addresses only).
const created: string[] = [];
const seeded: SeededListing[] = [];
test.afterEach(async () => {
  await deleteE2eUsers(created.splice(0));
  await deleteSeeded(seeded.splice(0));
});

const SCHEMES = ['light', 'dark'] as const;

/**
 * SIMULATED on-screen keyboard (Founder answer Q3): the field is focused and the viewport is
 * shortened by a typical iOS keyboard height (with the QuickType bar). Playwright can't open a real
 * keyboard; the physical iPhone check is a manual QA step (docs/runbooks/accounts.md).
 */
const PHONES = [
  { width: 320, height: 568, keyboard: 253 },
  { width: 360, height: 740, keyboard: 300 },
  { width: 375, height: 667, keyboard: 291 },
  { width: 390, height: 844, keyboard: 336 },
  { width: 414, height: 896, keyboard: 346 },
  { width: 430, height: 932, keyboard: 346 },
] as const;

const shot = (name: string) => ({ path: `test-results/screenshots/${name}.png` });

async function blockingViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .analyze();
  return results.violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map(({ id, impact, nodes }) => ({
      id,
      impact,
      targets: nodes.map((node) => ({ target: node.target, detail: node.any[0]?.message })),
    }));
}

/**
 * Switches the color scheme mid-flow. Playwright's WebKit can keep stale inherited colors after an
 * emulated scheme change (seen on headings and labels), so this forces a full restyle (root
 * display toggle) and waits a frame before axe reads computed colors.
 */
async function applyScheme(page: Page, colorScheme: (typeof SCHEMES)[number]) {
  await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const root = document.documentElement;
        root.style.display = 'none';
        root.getBoundingClientRect(); // forces style and layout while hidden
        root.style.removeProperty('display');
        requestAnimationFrame(() => {
          resolve();
        });
      }),
  );
}

async function expectInViewport(page: Page, locator: Locator) {
  const box = await locator.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  if (box === null || viewport === null) return;
  // 1 px tolerance: scroll positions snap to whole pixels, boxes don't.
  expect(box.x).toBeGreaterThanOrEqual(-1);
  expect(box.y).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
}

interface Stage {
  /** Screenshot name part. */
  name: string;
  /** The field the keyboard opens for (null: no text field on this step). */
  field: Locator | null;
  submit: Locator;
}

/**
 * Checks one stage of the flow: axe in light and dark everywhere; screenshots at 1440 (desktop
 * Chrome); at phone widths on WebKit, layout with the simulated keyboard open plus 390 screenshots.
 * No email address or phone number is ever on screen when a screenshot is taken.
 */
async function checkStage(page: Page, projectName: string, stage: Stage) {
  // Client-side step changes update <title> just after the new content renders.
  await expect(page).toHaveTitle(/\S/);
  for (const scheme of SCHEMES) {
    await applyScheme(page, scheme);
    expect(await blockingViolations(page), `${stage.name} (${scheme})`).toEqual([]);
    if (projectName === 'desktop-1440') {
      await stage.field?.focus();
      await page.screenshot(shot(`1440-${stage.name}-${scheme}`));
    }
  }
  if (projectName !== 'mobile-webkit') return;

  const tabs = page.getByRole('navigation', { name: 'Main' });
  for (const phone of PHONES) {
    const keyboardOpen = stage.field !== null;
    await page.setViewportSize({
      width: phone.width,
      height: keyboardOpen ? phone.height - phone.keyboard : phone.height,
    });
    await stage.field?.focus();
    // Like a person finishing the field: bring its button up to the keyboard's edge. The field
    // must still be on screen with it (both fit above the keyboard).
    await stage.submit.evaluate((element) => {
      element.scrollIntoView({ block: 'end' });
    });
    const label = `${stage.name} at ${String(phone.width)} px`;
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `${label}: no horizontal scroll`).toBeLessThanOrEqual(0);
    if (stage.field !== null) await expectInViewport(page, stage.field);
    await expectInViewport(page, stage.submit);
    if (keyboardOpen) await expect(tabs, `${label}: tab bar hidden`).toBeHidden();
    if (phone.width === 390) {
      for (const scheme of SCHEMES) {
        await applyScheme(page, scheme);
        const suffix = keyboardOpen ? '-keyboard-simulated' : '';
        await page.screenshot(shot(`390-webkit-${stage.name}${suffix}-${scheme}`));
      }
    }
  }
  await page.setViewportSize({ width: 393, height: 659 });
}

test('sign-in sheet and each onboarding step: axe, phone layout with the keyboard open, screenshots', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const project = testInfo.project.name;
  const email = testEmail(testInfo, 'ui');
  created.push(email);
  await invite(email);

  const listing = await seedListing(testInfo);
  seeded.push(listing);
  await page.goto(`/l/${listing.id}`);
  await page.getByRole('button', { name: 'Report' }).filter({ visible: true }).click();
  const sheet = page.getByRole('dialog', { name: /Sign in/ });
  await expect(sheet).toBeVisible();
  await checkStage(page, project, {
    name: 'sheet-methods',
    field: null,
    submit: sheet.getByRole('button', { name: 'Continue with email' }),
  });

  await sheet.getByRole('button', { name: 'Continue with email' }).click();
  await checkStage(page, project, {
    name: 'sheet-email',
    field: sheet.getByLabel('Email'),
    submit: sheet.getByRole('button', { name: 'Send code' }),
  });

  const started = new Date(Date.now() - 1000);
  await sheet.getByLabel('Email').fill(email);
  await sheet.getByRole('button', { name: 'Send code' }).click();
  await expect(sheet.getByRole('status')).toContainText('We sent a code if this address');
  await checkStage(page, project, {
    name: 'sheet-code',
    field: sheet.getByLabel('6-digit code'),
    submit: sheet.getByRole('button', { name: 'Continue' }),
  });

  await sheet.getByLabel('6-digit code').fill(await emailCode(email, started));
  await sheet.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Verify your phone' })).toBeVisible();
  await expect(page.getByLabel('Mobile number')).toHaveAttribute('type', 'tel');
  await expect(page.getByLabel('Mobile number')).toHaveAttribute('autocomplete', 'tel');
  await checkStage(page, project, {
    name: 'welcome-phone',
    field: page.getByLabel('Mobile number'),
    submit: page.getByRole('button', { name: 'Text me a code' }),
  });

  await page.getByLabel('Mobile number').fill(testPhone(testInfo));
  await page.getByRole('button', { name: 'Text me a code' }).click();
  const code = page.getByLabel('Code from the text');
  await expect(code).toHaveAttribute('inputmode', 'numeric');
  await expect(code).toHaveAttribute('autocomplete', 'one-time-code');
  await checkStage(page, project, {
    name: 'welcome-phone-code',
    field: code,
    submit: page.getByRole('button', { name: 'Verify' }),
  });

  await code.fill(TEST_SMS_CODE);
  await page.getByRole('button', { name: 'Verify' }).click();
  await expect(page.getByRole('heading', { name: 'Confirm your age' })).toBeVisible();
  await checkStage(page, project, {
    name: 'welcome-age',
    field: null,
    submit: page.getByRole('button', { name: 'Continue' }),
  });

  await page.getByLabel('I’m 18 or older.').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Set your home ZIP' })).toBeVisible();
  await checkStage(page, project, {
    name: 'welcome-zip',
    field: page.getByLabel('What’s your home ZIP?'),
    submit: page.getByRole('button', { name: 'Continue' }),
  });

  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Choose a display name' })).toBeVisible();
  await checkStage(page, project, {
    name: 'welcome-name',
    field: page.getByLabel('What should people call you?'),
    submit: page.getByRole('button', { name: 'Finish' }),
  });

  await page.getByLabel('What should people call you?').fill('Sam');
  await page.getByRole('button', { name: 'Finish' }).click();
  await expect(page).toHaveURL(`/l/${listing.id}`);
});
