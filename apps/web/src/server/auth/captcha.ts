import 'server-only';
import { z } from 'zod';
import type { CaptchaConfig } from '@/lib/env';

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const SiteverifyResponse = z.object({ success: z.boolean() });

/**
 * Server-side Turnstile check. Used for phone-code sends, which Supabase doesn't captcha-check
 * (GoTrue's PUT /user has no captcha middleware). Email-code sends pass the token to Supabase
 * instead. Fails closed on any error or timeout.
 * https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */
export async function verifyCaptcha(
  captcha: CaptchaConfig,
  token: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  if (captcha.provider === 'none') return true;
  if (token === undefined || token.length === 0 || token.length > 2048) return false;
  try {
    const response = await fetchImpl(SITEVERIFY_URL, {
      method: 'POST',
      body: new URLSearchParams({ secret: captcha.secretKey, response: token }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return false;
    const parsed = SiteverifyResponse.safeParse(await response.json());
    return parsed.success && parsed.data.success;
  } catch {
    return false;
  }
}
