import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Mux webhook signatures (https://www.mux.com/docs/core/verify-webhook-signatures): the
 * `mux-signature` header is `t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<raw body>">`. We verify
 * it ourselves rather than with the SDK so that a timestamp too far in the future is refused too,
 * and so the fake provider signs with exactly the same code.
 */
export const WEBHOOK_TOLERANCE_SECONDS = 300;

function signature(timestamp: number, rawBody: string, secret: string): string {
  return createHmac('sha256', secret)
    .update(`${String(timestamp)}.${rawBody}`)
    .digest('hex');
}

export function signWebhook(rawBody: string, secret: string, now = Date.now()): string {
  const t = Math.floor(now / 1000);
  return `t=${String(t)},v1=${signature(t, rawBody, secret)}`;
}

/** True only for a well-formed header whose v1 signature matches and whose t is within 5 min. */
export function verifyWebhook(
  rawBody: string,
  header: string | null,
  secret: string,
  now = Date.now(),
): boolean {
  if (header === null || header.length > 1000 || secret.length === 0) return false;
  let t = Number.NaN;
  const signatures: string[] = [];
  for (const part of header.split(',')) {
    const [key, value] = part.split('=', 2);
    if (key === 't' && value !== undefined && /^\d{1,12}$/.test(value)) t = Number(value);
    if (key === 'v1' && value !== undefined && /^[0-9a-f]{64}$/.test(value)) signatures.push(value);
  }
  if (!Number.isFinite(t) || signatures.length === 0) return false;
  if (Math.abs(Math.floor(now / 1000) - t) > WEBHOOK_TOLERANCE_SECONDS) return false;
  const expected = Buffer.from(signature(t, rawBody, secret), 'hex');
  return signatures.some((sig) => timingSafeEqual(Buffer.from(sig, 'hex'), expected));
}
