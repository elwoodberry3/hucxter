import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;
const PRODUCTION_PORT = 3101;
const baseURL = `http://localhost:${String(PORT)}`;
const productionURL = `http://localhost:${String(PRODUCTION_PORT)}`;

/**
 * The app reads categories and postal areas from the local Supabase stack (`supabase start`).
 * Uses SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY when set (CI), else asks the Supabase CLI.
 * Only the publishable (RLS-limited) key is used.
 */
function supabaseEnv(): { SUPABASE_URL: string; SUPABASE_PUBLISHABLE_KEY: string } {
  const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = process.env;
  if (SUPABASE_URL !== undefined && SUPABASE_PUBLISHABLE_KEY !== undefined) {
    return { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY };
  }
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
  return { SUPABASE_URL: read('API_URL'), SUPABASE_PUBLISHABLE_KEY: read('PUBLISHABLE_KEY') };
}

const sharedEnv = {
  ...supabaseEnv(),
  GIT_COMMIT_SHA: process.env.GITHUB_SHA ?? 'e2e',
  DEFAULT_AREA_ZIP: '75009',
};

export default defineConfig({
  testDir: './e2e',
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
  ],
  // Production builds, so headers and CSP are tested as they ship. Servers start in order: the
  // first builds; the second reuses that build with APP_ENV=production to prove /dev is gated.
  webServer: [
    {
      command: `pnpm build && pnpm start -p ${String(PORT)}`,
      url: `${baseURL}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
      env: { ...sharedEnv, APP_ENV: 'qa', APP_ORIGIN: baseURL },
    },
    {
      command: `pnpm start -p ${String(PRODUCTION_PORT)}`,
      url: `${productionURL}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: { ...sharedEnv, APP_ENV: 'production', APP_ORIGIN: productionURL },
    },
  ],
});
