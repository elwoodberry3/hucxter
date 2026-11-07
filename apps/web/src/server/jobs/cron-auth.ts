import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * `/api/cron/*` authorization: `Authorization: Bearer <CRON_SECRET>` (Vercel Cron sends this).
 * Both sides are hashed to equal-length SHA-256 digests and compared with timingSafeEqual, so
 * neither the content nor the length of the secret leaks through timing. A missing or short
 * secret refuses every request (fail closed). The only module that reads CRON_SECRET.
 */
const MIN_SECRET_LENGTH = 32;

const digest = (value: string) => createHash('sha256').update(value, 'utf8').digest();

export function cronAuthorized(
  authorization: string | null,
  secret: string | undefined = process.env.CRON_SECRET,
): boolean {
  if (secret === undefined || secret.length < MIN_SECRET_LENGTH) return false;
  if (authorization === null || authorization.length > 1000) return false;
  return timingSafeEqual(digest(authorization), digest(`Bearer ${secret}`));
}
