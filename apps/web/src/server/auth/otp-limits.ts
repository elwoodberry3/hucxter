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
  emailSendsPerAddressPerHour: 5,
  // Code checks (right or wrong): stops guessing a 6-digit code. Supabase's per-IP limits only see
  // this server's IP, so they can't do it.
  emailChecksPerAddressPerHour: 10,
  phoneChecksPerUserPerHour: 10,
} as const;

const RetryAfter = z.number().int().nonnegative();

export type LimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

async function attempt(
  kind: 'email' | 'phone' | 'email_check' | 'phone_check',
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

/** Records an email-code send for this (lowercased) address if it's within the limit. */
export function allowEmailCodeSend(email: string): Promise<LimitResult> {
  return attempt('email', email, null, {
    perSubject: OTP_LIMITS.emailSendsPerAddressPerHour,
    perUser: null,
    distinct: null,
  });
}

/** Records a phone-code send for this member and E.164 number if it's within the limits. */
export function allowPhoneCodeSend(userId: string, e164: string): Promise<LimitResult> {
  return attempt('phone', e164, userId, {
    perSubject: OTP_LIMITS.phoneSendsPerNumberPerHour,
    perUser: OTP_LIMITS.phoneSendsPerUserPerHour,
    distinct: OTP_LIMITS.distinctPhonesPerUserPerDay,
  });
}

/**
 * Gives back an email send that Supabase refused with captcha_failed (no code went out), so a junk
 * bot-check token can't use up someone else's allowance. Best effort.
 */
export async function refundEmailCodeSend(email: string): Promise<void> {
  await adminDb().rpc('otp_send_refund', {
    p_kind: 'email',
    p_subject_hash: subjectHash('email', email),
  });
}

/** Records an email-code check for this (lowercased) address if it's within the limit. */
export function allowEmailCodeCheck(email: string): Promise<LimitResult> {
  return attempt('email_check', email, null, {
    perSubject: OTP_LIMITS.emailChecksPerAddressPerHour,
    perUser: null,
    distinct: null,
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
