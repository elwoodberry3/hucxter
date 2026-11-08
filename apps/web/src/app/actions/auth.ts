'use server';

import { EmailCodeRequest, EmailCodeVerify } from '@hucxter/contracts';
import { redirect } from 'next/navigation';
import { authConfig } from '@/lib/env';
import { destinationAfterSignIn } from '@/server/auth/destination';
import {
  CAPTCHA_ERROR,
  CLOSED_TEST_MESSAGE,
  CODE_ERROR,
  GENERIC_ERROR,
  ORIGIN_ERROR,
  NEW_CODE_NEEDED,
  isClosedTestRejection,
} from '@/server/auth/errors';
import { codeBrowserId, knownDeviceId, rememberKnownDevice } from '@/server/auth/code-cookies';
import { loadMember } from '@/server/auth/member';
import { requestIsSameOrigin } from '@/server/auth/origin';
import {
  allowEmailCodeSend,
  beginEmailCodeCheck,
  emailCodeSucceeded,
  refundEmailCodeSend,
} from '@/server/auth/otp-limits';
import { sessionClient } from '@/server/supabase-server';

/**
 * `notice: 'trickle'`: the address is in trickle mode (too many wrong codes today), so new devices
 * get one code per hour. It depends only on guesses against the address, not on whether an
 * account exists, so the answer stays enumeration-neutral.
 */
export type EmailCodeResult =
  | { status: 'sent'; notice?: 'trickle' }
  | { status: 'closed_test'; message: string }
  | { status: 'error'; message: string };

/** Every email-code request takes at least this long, so timing doesn't reveal anything. */
const MIN_SEND_MS = 900;

async function atLeast<T>(ms: number, work: Promise<T>): Promise<T> {
  const [result] = await Promise.all([work, new Promise((resolve) => setTimeout(resolve, ms))]);
  return result;
}

/**
 * Sends a 6-digit email code (D-34). Enumeration-neutral: whether the address has an account, is
 * over the send limit, or Supabase refuses for another reason, the answer and timing are the same
 * ("We sent a code if this address can sign in"). Exceptions that reveal nothing about accounts:
 * a failed bot check, and the QA invite hook's closed-test answer.
 */
export async function sendEmailCode(input: unknown): Promise<EmailCodeResult> {
  if (!(await requestIsSameOrigin())) return { status: 'error', message: ORIGIN_ERROR };
  const parsed = EmailCodeRequest.safeParse(input);
  if (!parsed.success) return { status: 'error', message: 'Enter a valid email address.' };
  const { email, captchaToken } = parsed.data;
  const { captcha } = authConfig();
  if (captcha.provider === 'turnstile' && (captchaToken === undefined || captchaToken === '')) {
    return { status: 'error', message: CAPTCHA_ERROR };
  }

  return atLeast(MIN_SEND_MS, sendNeutrally(email, captchaToken));
}

async function sendNeutrally(
  email: string,
  captchaToken: string | undefined,
): Promise<EmailCodeResult> {
  try {
    const browserId = await codeBrowserId({ create: true });
    if (browserId === null) return { status: 'sent' };
    const limit = await allowEmailCodeSend(email, browserId, await knownDeviceId());
    if (!limit.ok)
      return limit.trickle ? { status: 'sent', notice: 'trickle' } : { status: 'sent' };
    const sent: EmailCodeResult =
      limit.kind === 'trickle' ? { status: 'sent', notice: 'trickle' } : { status: 'sent' };
    const supabase = await sessionClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true, ...(captchaToken ? { captchaToken } : {}) },
    });
    if (error === null) return sent;
    if (isClosedTestRejection(error))
      return { status: 'closed_test', message: CLOSED_TEST_MESSAGE };
    if (error.code === 'captcha_failed') {
      // No code went out: don't let a junk token use up this address's allowance.
      await refundEmailCodeSend(limit.sessionId).catch(() => undefined);
      return { status: 'error', message: CAPTCHA_ERROR };
    }
    return sent;
  } catch {
    return { status: 'sent' };
  }
}

export type VerifyResult = { status: 'error'; message: string };

/** Checks the email code; on success the session cookie is set and we redirect onward. */
export async function verifyEmailCode(input: unknown, next: unknown): Promise<VerifyResult> {
  if (!(await requestIsSameOrigin())) return { status: 'error', message: ORIGIN_ERROR };
  const parsed = EmailCodeVerify.safeParse(input);
  if (!parsed.success) return { status: 'error', message: 'Enter the 6-digit code.' };
  let destination: string;
  try {
    // Only the browser that asked for the code may check it, a limited number of times. Out of
    // tries (or the address hit its wrong-code ceiling): ask for a new code. Never a timed lock.
    const browserId = await codeBrowserId({ create: false });
    const checkId =
      browserId === null ? null : await beginEmailCodeCheck(parsed.data.email, browserId);
    if (checkId === null) return { status: 'error', message: NEW_CODE_NEEDED };
    const supabase = await sessionClient();
    const { error } = await supabase.auth.verifyOtp({
      email: parsed.data.email,
      token: parsed.data.code,
      type: 'email',
    });
    if (error !== null) return { status: 'error', message: CODE_ERROR };
    await emailCodeSucceeded(parsed.data.email, checkId, await rememberKnownDevice()).catch(
      () => undefined,
    );
    destination = destinationAfterSignIn(await loadMember(), next);
  } catch {
    return { status: 'error', message: GENERIC_ERROR };
  }
  redirect(destination);
}
