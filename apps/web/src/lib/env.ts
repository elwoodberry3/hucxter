import 'server-only';
import { Zip } from '@hucxter/contracts';
import { z } from 'zod';

// Treat empty strings (e.g. `GIT_COMMIT_SHA=` copied from .env.example) as unset.
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema.optional());

const ServerEnv = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  // Deployment tier. `production` hides /dev routes and demo fixtures.
  APP_ENV: optional(z.enum(['local', 'qa', 'production'])),
  // A bare origin (scheme + host + port): later CSRF checks compare request Origin headers to it.
  APP_ORIGIN: optional(
    z
      .url({ protocol: /^https?$/ })
      .refine((value) => new URL(value).origin === value.replace(/\/$/, ''), {
        message: 'APP_ORIGIN must be an origin, without credentials, path, query or fragment',
      }),
  ),
  GIT_COMMIT_SHA: optional(z.string()),
  VERCEL_GIT_COMMIT_SHA: optional(z.string()),
  // Set to "1" by Vercel. Only then are Vercel's IP-location headers trusted.
  VERCEL: optional(z.string()),
  SUPABASE_URL: optional(z.url({ protocol: /^https?$/ })),
  // Publishable (anon) key: RLS-limited, used server-side only. Never the service-role key.
  SUPABASE_PUBLISHABLE_KEY: optional(z.string().min(1)),
  // Guest location fallback when no IP location is available (e.g. local dev).
  DEFAULT_AREA_ZIP: optional(Zip),
});

export type AppEnv = 'local' | 'qa' | 'production';

export interface ServerConfig {
  appEnv: AppEnv;
  appOrigin: URL;
  commit: string;
  isProduction: boolean;
  isVercel: boolean;
  defaultAreaZip: string | undefined;
}

const DEV_ORIGIN = 'http://localhost:3000';

/** Server-only configuration. Throws on invalid values, or a missing APP_ORIGIN in production. */
export function serverConfig(env: Record<string, string | undefined> = process.env): ServerConfig {
  const parsed = ServerEnv.parse(env);
  if (parsed.APP_ORIGIN === undefined && parsed.NODE_ENV === 'production') {
    throw new Error('APP_ORIGIN must be set in production');
  }
  // Fail closed: a production build without APP_ENV is treated as production.
  const appEnv: AppEnv =
    parsed.APP_ENV ?? (parsed.NODE_ENV === 'production' ? 'production' : 'local');
  return {
    appEnv,
    appOrigin: new URL(parsed.APP_ORIGIN ?? DEV_ORIGIN),
    commit: parsed.GIT_COMMIT_SHA ?? parsed.VERCEL_GIT_COMMIT_SHA ?? 'unknown',
    isProduction: appEnv === 'production',
    isVercel: parsed.VERCEL === '1',
    defaultAreaZip: parsed.DEFAULT_AREA_ZIP,
  };
}

export interface SupabaseConfig {
  url: string;
  publishableKey: string;
}

/** Supabase connection for server-side reads. Throws a clear error when it isn't configured. */
export function supabaseConfig(
  env: Record<string, string | undefined> = process.env,
): SupabaseConfig {
  const parsed = ServerEnv.parse(env);
  if (parsed.SUPABASE_URL === undefined || parsed.SUPABASE_PUBLISHABLE_KEY === undefined) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must be set (see apps/web/.env.example)',
    );
  }
  return { url: parsed.SUPABASE_URL, publishableKey: parsed.SUPABASE_PUBLISHABLE_KEY };
}
