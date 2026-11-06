import 'server-only';
import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { serverConfig } from '@/lib/env';

/**
 * Browser-binding cookies for email codes (Brief 03C.1 §3.0). Both hold 32 random bytes and are
 * httpOnly; the database only ever sees an HMAC of the value (subjectHash), bound to the address.
 *
 * - `hx_ec` ("email code"): identifies the browser that asked for a code. Checks are only accepted
 *   from a browser with a live send session, so guessing from elsewhere can't block the owner.
 * - `hx_kd` ("known device"): set after a successful email sign-in. Gives that browser its own send
 *   allowance for that address, outside the shared pool an attacker can use up.
 */
export const CODE_BROWSER_COOKIE = 'hx_ec';
export const KNOWN_DEVICE_COOKIE = 'hx_kd';

const CODE_BROWSER_MAX_AGE = 60 * 60;
const KNOWN_DEVICE_MAX_AGE = 60 * 60 * 24 * 180;
const VALUE = /^[A-Za-z0-9_-]{43}$/;

function secure(): boolean {
  const config = serverConfig();
  return config.isProduction || config.appOrigin.protocol === 'https:';
}

function newValue(): string {
  return randomBytes(32).toString('base64url');
}

export function isCookieValue(value: string | undefined): value is string {
  return value !== undefined && VALUE.test(value);
}

/** The browser's code-session id, creating the cookie on first send. */
export async function codeBrowserId({ create }: { create: boolean }): Promise<string | null> {
  const store = await cookies();
  const existing = store.get(CODE_BROWSER_COOKIE)?.value;
  if (isCookieValue(existing)) return existing;
  if (!create) return null;
  const value = newValue();
  store.set(CODE_BROWSER_COOKIE, value, {
    httpOnly: true,
    sameSite: 'strict',
    secure: secure(),
    path: '/',
    maxAge: CODE_BROWSER_MAX_AGE,
  });
  return value;
}

/** The known-device id, if this browser has one. */
export async function knownDeviceId(): Promise<string | null> {
  const value = (await cookies()).get(KNOWN_DEVICE_COOKIE)?.value;
  return isCookieValue(value) ? value : null;
}

/** Returns the known-device id, creating (or refreshing) the cookie. */
export async function rememberKnownDevice(): Promise<string> {
  const store = await cookies();
  const existing = store.get(KNOWN_DEVICE_COOKIE)?.value;
  const value = isCookieValue(existing) ? existing : newValue();
  store.set(KNOWN_DEVICE_COOKIE, value, {
    httpOnly: true,
    sameSite: 'lax',
    secure: secure(),
    path: '/',
    maxAge: KNOWN_DEVICE_MAX_AGE,
  });
  return value;
}
