import 'server-only';
import { z } from 'zod';

// Treat empty strings (e.g. `GIT_COMMIT_SHA=` copied from .env.example) as unset.
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema.optional());

const ServerEnv = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  APP_ORIGIN: optional(z.url({ protocol: /^https?$/ })),
  GIT_COMMIT_SHA: optional(z.string()),
  VERCEL_GIT_COMMIT_SHA: optional(z.string()),
});

export interface ServerConfig {
  appOrigin: URL;
  commit: string;
}

const DEV_ORIGIN = 'http://localhost:3000';

/** Server-only configuration. Throws on invalid values, or a missing APP_ORIGIN in production. */
export function serverConfig(env: Record<string, string | undefined> = process.env): ServerConfig {
  const parsed = ServerEnv.parse(env);
  if (parsed.APP_ORIGIN === undefined && parsed.NODE_ENV === 'production') {
    throw new Error('APP_ORIGIN must be set in production');
  }
  return {
    appOrigin: new URL(parsed.APP_ORIGIN ?? DEV_ORIGIN),
    commit: parsed.GIT_COMMIT_SHA ?? parsed.VERCEL_GIT_COMMIT_SHA ?? 'unknown',
  };
}
