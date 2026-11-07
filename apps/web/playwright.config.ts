import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;
const PRODUCTION_PORT = 3101;
const baseURL = `http://localhost:${String(PORT)}`;
const productionURL = `http://localhost:${String(PRODUCTION_PORT)}`;
const INVITE_OFF_PORT = 3102;
const inviteOffURL = `http://localhost:${String(INVITE_OFF_PORT)}`;
const LOCAL_PORT = 3103;
const localURL = `http://localhost:${String(LOCAL_PORT)}`;

interface SupabaseEnv {
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_SECRET_KEY: string;
  MAILPIT_URL: string;
}

/**
 * The app reads categories and postal areas from the LOCAL Supabase stack (`supabase start`) and
 * needs its secret key for account deletion. Values come from `supabase status` (the local
 * stack's own keys), never from a .env file. e2e/support/local-guard.ts refuses anything that
 * isn't localhost.
 */
function supabaseEnv(): SupabaseEnv {
  let output: string;
  try {
    output = execFileSync('supabase', ['status', '-o', 'env'], {
      cwd: fileURLToPath(new URL('../..', import.meta.url)),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    throw new Error(
      'Local Supabase is not running. Run `supabase start && supabase db reset` first.',
    );
  }
  const read = (key: string) => {
    const match = new RegExp(`^${key}="?([^"\\n]+)"?$`, 'm').exec(output);
    if (match?.[1] === undefined) throw new Error(`supabase status did not report ${key}`);
    return match[1];
  };
  return {
    SUPABASE_URL: read('API_URL'),
    SUPABASE_PUBLISHABLE_KEY: read('PUBLISHABLE_KEY'),
    SUPABASE_SECRET_KEY: read('SECRET_KEY'),
    MAILPIT_URL: read('MAILPIT_URL'),
  };
}

const supabase = supabaseEnv();
// The test process reads these too (global setup, Mailpit, account cleanup).
Object.assign(process.env, supabase);

// Cloudflare's documented always-pass TEST keys, never real keys:
// https://developers.cloudflare.com/turnstile/troubleshooting/testing/
const TURNSTILE_TEST_KEYS = {
  CAPTCHA_PROVIDER: 'turnstile',
  TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
  TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
};

const sharedEnv = {
  SUPABASE_URL: supabase.SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY: supabase.SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_SECRET_KEY: supabase.SUPABASE_SECRET_KEY,
  GIT_COMMIT_SHA: process.env.GITHUB_SHA ?? 'e2e',
  DEFAULT_AREA_ZIP: '97205',
};

export default defineConfig({
  testDir: './e2e',
  testIgnore: ['**/*.unit.test.ts'],
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop-1440',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'desktop-1280',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
    // Phones (ADR-0011): Android Chrome and iPhone Safari profiles.
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
    { name: 'mobile-webkit', use: { ...devices['iPhone 15'] } },
  ],
  // Production builds, so headers and CSP are tested as they ship. Servers start in order: the
  // first builds; the second reuses that build with APP_ENV=production to prove /dev is gated;
  // the third reuses it with the invite gate off; the fourth runs it as a local deployment with the
  // fake video provider.
  webServer: [
    {
      command: `pnpm build && pnpm start -p ${String(PORT)}`,
      url: `${baseURL}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
      // Like hosted QA (invite-only), but without the bot challenge so e2e can sign up.
      env: {
        ...sharedEnv,
        APP_ENV: 'qa',
        APP_ORIGIN: baseURL,
        INVITE_ONLY: 'true',
        CAPTCHA_PROVIDER: 'none',
      },
    },
    {
      command: `pnpm start -p ${String(PRODUCTION_PORT)}`,
      url: `${productionURL}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        ...sharedEnv,
        ...TURNSTILE_TEST_KEYS,
        APP_ENV: 'production',
        APP_ORIGIN: productionURL,
      },
    },
    {
      // Same build, invite gate off: proves INVITE_ONLY=false lets an uninvited email sign up.
      command: `pnpm start -p ${String(INVITE_OFF_PORT)}`,
      url: `${inviteOffURL}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        ...sharedEnv,
        APP_ENV: 'qa',
        APP_ORIGIN: inviteOffURL,
        INVITE_ONLY: 'false',
        CAPTCHA_PROVIDER: 'none',
      },
    },
    {
      // Same build as a local deployment with the fake video provider (refused in qa and
      // production): the sell flow, listing pages and storefront with real listings.
      command: `pnpm start -p ${String(LOCAL_PORT)}`,
      url: `${localURL}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        ...sharedEnv,
        APP_ENV: 'local',
        APP_ORIGIN: localURL,
        INVITE_ONLY: 'false',
        CAPTCHA_PROVIDER: 'none',
        VIDEO_PROVIDER: 'fake',
      },
    },
  ],
});
