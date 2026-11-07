import 'server-only';
import { z } from 'zod';
import { adminDb, subjectHash } from '../admin-db';

/**
 * App-level one-time-code limits (Founder amendment 1), on top of Supabase Auth's own limits. One
 * place to change them; documented in docs/runbooks/accounts.md §5.
 */
export const OTP_LIMITS = {
  phoneSendsPerUserPerHour: 5,
  phoneSendsPerNumberPerHour: 3,
  distinctPhonesPerUserPerDay: 3,
  // Code checks (right or wrong): stops guessing a 6-digit code. Supabase's per-IP limits only see
  // this server's IP, so they can't do it. Only the account holder can check a phone code.
  phoneChecksPerUserPerHour: 10,
} as const;

/**
 * Email codes (Brief 03C.1 §3.0, Founder amendment 1). Checks are bound to the browser that asked
 * for the code, and wrong codes never start a timed lock, so someone without the inbox can't block
 * the person who has it. Guessing bound per address per hour: every check needs a send, so wrong
 * checks ≤ 6 × 5 (normal) + 6 × 3 (overflow, one per 10 min) = 48, P ≤ 4.8 × 10⁻⁵. Known-device
 * sends need a cookie only a past sign-in sets, so they don't widen it.
 */
export const EMAIL_CODE_LIMITS = {
  checksPerSend: 5,
  sendsPerBrowserPerHour: 3,
  sendsPerAddressPerHour: 6,
  overflowSpacingSeconds: 10 * 60,
  overflowChecksPerSend: 3,
  knownDeviceSendsPerHour: 3,
  wrongChecksCeilingPerHour: 15,
  // Matches [auth.email] otp_expiry in supabase/config.toml (and the cloud setting, runbook §5).
  sessionTtlSeconds: 600,
} as const;

const RetryAfter = z.number().int().nonnegative();

export type LimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

async function attempt(
  kind: 'phone' | 'phone_check',
  normalized: string,
  userId: string | null,
  limits: { perSubject: number; perUser: number | null; distinct: number | null },
): Promise<LimitResult> {
  const result = await adminDb().rpc('otp_send_attempt', {
    p_kind: kind,
    p_subject_hash: subjectHash(kind, normalized),
    p_user_id: userId,
    p_max_per_subject_hour: limits.perSubject,
    p_max_per_user_hour: limits.perUser,
    p_max_distinct_per_user_day: limits.distinct,
  });
  // Fail closed: if the counter can't be checked, don't send.
  const retryAfter = RetryAfter.safeParse(result.data);
  if (result.error !== null || !retryAfter.success) return { ok: false, retryAfterSeconds: 60 };
  return retryAfter.data === 0 ? { ok: true } : { ok: false, retryAfterSeconds: retryAfter.data };
}

/** Records a phone-code send for this member and E.164 number if it's within the limits. */
export function allowPhoneCodeSend(userId: string, e164: string): Promise<LimitResult> {
  return attempt('phone', e164, userId, {
    perSubject: OTP_LIMITS.phoneSendsPerNumberPerHour,
    perUser: OTP_LIMITS.phoneSendsPerUserPerHour,
    distinct: OTP_LIMITS.distinctPhonesPerUserPerDay,
  });
}

/** Records a phone-code check for this member if it's within the limit. */
export function allowPhoneCodeCheck(userId: string): Promise<LimitResult> {
  return attempt('phone_check', userId, userId, {
    perSubject: OTP_LIMITS.phoneChecksPerUserPerHour,
    perUser: null,
    distinct: null,
  });
}

const SendRow = z.array(
  z.object({
    session_id: z.uuid().nullable(),
    kind: z.enum(['normal', 'overflow', 'known', 'denied']),
  }),
);

export type EmailSendResult =
  { ok: true; sessionId: string; kind: 'normal' | 'overflow' | 'known' } | { ok: false };

/**
 * Records an email-code send for this (lowercased) address from this browser if the limits allow
 * it. `deviceId` is the known-device cookie, if any. Fails closed.
 */
export async function allowEmailCodeSend(
  email: string,
  browserId: string,
  deviceId: string | null,
): Promise<EmailSendResult> {
  const limits = EMAIL_CODE_LIMITS;
  const result = await adminDb().rpc('email_code_send', {
    p_email_hash: subjectHash('email', email),
    p_browser_hash: subjectHash('email_browser', browserId),
    p_device_hash: deviceId === null ? null : subjectHash('email_device', deviceId),
    p_checks_per_send: limits.checksPerSend,
    p_browser_per_hour: limits.sendsPerBrowserPerHour,
    p_email_per_hour: limits.sendsPerAddressPerHour,
    p_overflow_spacing_s: limits.overflowSpacingSeconds,
    p_overflow_checks: limits.overflowChecksPerSend,
    p_known_per_hour: limits.knownDeviceSendsPerHour,
    p_session_ttl_s: limits.sessionTtlSeconds,
  });
  const rows = SendRow.safeParse(result.data);
  const row = rows.success ? rows.data[0] : undefined;
  if (
    result.error !== null ||
    row === undefined ||
    row.session_id === null ||
    row.kind === 'denied'
  ) {
    return { ok: false };
  }
  return { ok: true, sessionId: row.session_id, kind: row.kind };
}

/**
 * Gives back an email send that Supabase refused with captcha_failed (no code went out), so a junk
 * bot-check token can't use up someone else's allowance. Best effort.
 */
export async function refundEmailCodeSend(sessionId: string): Promise<void> {
  await adminDb().rpc('email_code_refund', { p_session_id: sessionId });
}

/**
 * Reserves one email-code check for this browser. Returns the check id, or null when the browser
 * must ask for a new code (no live session here, its tries are used up, or the address's
 * wrong-code ceiling was hit and every outstanding code was invalidated). Fails closed.
 */
export async function beginEmailCodeCheck(
  email: string,
  browserId: string,
): Promise<string | null> {
  const result = await adminDb().rpc('email_code_check_begin', {
    p_email_hash: subjectHash('email', email),
    p_browser_hash: subjectHash('email_browser', browserId),
    p_ceiling: EMAIL_CODE_LIMITS.wrongChecksCeilingPerHour,
    p_session_ttl_s: EMAIL_CODE_LIMITS.sessionTtlSeconds,
  });
  const id = z.uuid().nullable().safeParse(result.data);
  return result.error === null && id.success ? id.data : null;
}

/** The code was right: ends every session for the address and marks this browser as known. */
export async function emailCodeSucceeded(
  email: string,
  checkId: string,
  deviceId: string,
): Promise<void> {
  const emailHash = subjectHash('email', email);
  await adminDb().rpc('email_code_check_succeeded', {
    p_email_hash: emailHash,
    p_check_id: checkId,
  });
  await adminDb().rpc('email_known_device_add', {
    p_email_hash: emailHash,
    p_device_hash: subjectHash('email_device', deviceId),
  });
}
