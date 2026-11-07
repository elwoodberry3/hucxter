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
  // QA invite gate (Brief 03B). Defaults to true when APP_ENV=qa, false otherwise.
  INVITE_ONLY: optional(z.enum(['true', 'false'])),
  // Bot challenge on one-time-code sends. `none` is refused when APP_ENV=production.
  CAPTCHA_PROVIDER: optional(z.enum(['turnstile', 'none'])),
  TURNSTILE_SITE_KEY: optional(z.string().min(1).max(100)),
  TURNSTILE_SECRET_KEY: optional(z.string().min(1).max(200)),
  // Video (Brief 03C.1 §3.3). `fake` is local only; Mux secrets are read in server/media/mux.ts.
  VIDEO_PROVIDER: optional(z.enum(['mux', 'fake'])),
  MEDIA_MAX_SECONDS: optional(z.coerce.number().int().min(5).max(180)),
  MEDIA_MAX_BYTES: optional(z.coerce.number().int().min(1_000_000).max(2_000_000_000)),
  // Profile photos (Brief 03C.2 §4.5). `off` hides uploads and shows initials everywhere.
  AVATAR_UPLOADS: optional(z.enum(['on', 'off'])),
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

export type CaptchaConfig =
  { provider: 'none' } | { provider: 'turnstile'; siteKey: string; secretKey: string };

export interface AuthConfig {
  inviteOnly: boolean;
  captcha: CaptchaConfig;
  /**
   * True only against a local Supabase stack (localhost/127.0.0.1) outside production: allows the
   * fictional 555-01xx numbers that `supabase/config.toml` maps to fixed test codes.
   */
  allowTestPhoneNumbers: boolean;
}

function isLocalHost(url: string | undefined): boolean {
  if (url === undefined) return false;
  const { hostname } = new URL(url);
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

/**
 * Account settings (Brief 03B). Fails closed: production requires Turnstile, and Turnstile requires
 * both keys. Outside local, the captcha defaults to Turnstile.
 */
export function authConfig(env: Record<string, string | undefined> = process.env): AuthConfig {
  const parsed = ServerEnv.parse(env);
  const { appEnv } = serverConfig(env);
  const provider = parsed.CAPTCHA_PROVIDER ?? (appEnv === 'local' ? 'none' : 'turnstile');
  if (provider === 'none' && appEnv === 'production') {
    throw new Error('CAPTCHA_PROVIDER=none is not allowed when APP_ENV=production');
  }
  let captcha: CaptchaConfig = { provider: 'none' };
  if (provider === 'turnstile') {
    if (parsed.TURNSTILE_SITE_KEY === undefined || parsed.TURNSTILE_SECRET_KEY === undefined) {
      throw new Error(
        'CAPTCHA_PROVIDER=turnstile needs TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY',
      );
    }
    captcha = {
      provider,
      siteKey: parsed.TURNSTILE_SITE_KEY,
      secretKey: parsed.TURNSTILE_SECRET_KEY,
    };
  }
  return {
    inviteOnly: parsed.INVITE_ONLY === undefined ? appEnv === 'qa' : parsed.INVITE_ONLY === 'true',
    captcha,
    allowTestPhoneNumbers: appEnv !== 'production' && isLocalHost(parsed.SUPABASE_URL),
  };
}

export interface MediaConfig {
  provider: 'mux' | 'fake';
  maxSeconds: number;
  maxBytes: number;
}

/**
 * Video settings (Brief 03C.1 §3.3). The fake provider defaults on, and is only allowed, when the
 * resolved APP_ENV is local: it is refused for qa, production, and a production build without
 * APP_ENV (fail closed, like the /dev route gate).
 */
export function mediaConfig(env: Record<string, string | undefined> = process.env): MediaConfig {
  const parsed = ServerEnv.parse(env);
  const { appEnv } = serverConfig(env);
  const provider = parsed.VIDEO_PROVIDER ?? (appEnv === 'local' ? 'fake' : 'mux');
  if (provider === 'fake' && appEnv !== 'local') {
    throw new Error(`VIDEO_PROVIDER=fake is not allowed when APP_ENV=${appEnv}`);
  }
  return {
    provider,
    maxSeconds: parsed.MEDIA_MAX_SECONDS ?? 60,
    maxBytes: parsed.MEDIA_MAX_BYTES ?? 524_288_000,
  };
}

export interface ProfileConfig {
  /** AVATAR_UPLOADS (default on). Off: no upload control, initials everywhere, no CSP change. */
  avatarUploads: boolean;
  /** The Supabase origin serving public avatars (CSP img-src), or null when photos are off. */
  avatarOrigin: string | null;
}

/** Profile photo settings (Brief 03C.2 §4.5; Founder note 2026-11-07). */
export function profileConfig(
  env: Record<string, string | undefined> = process.env,
): ProfileConfig {
  const parsed = ServerEnv.parse(env);
  const avatarUploads = parsed.AVATAR_UPLOADS !== 'off';
  const supabaseUrl = parsed.SUPABASE_URL;
  return {
    avatarUploads,
    avatarOrigin: avatarUploads && supabaseUrl !== undefined ? new URL(supabaseUrl).origin : null,
  };
}
