'use server';

import {
  AgeAttestation,
  DisplayNameInput,
  HomeZipInput,
  PhoneCodeRequest,
  PhoneCodeVerify,
  parseUsPhone,
} from '@hucxter/contracts';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { authConfig } from '@/lib/env';
import { welcomeHref } from '@/lib/next-path';
import { lookupPostalArea } from '@/lib/postal-areas';
import { verifyCaptcha } from '@/server/auth/captcha';
import {
  CAPTCHA_ERROR,
  CLOSED_TEST_MESSAGE,
  CODE_ERROR,
  GENERIC_ERROR,
  ORIGIN_ERROR,
  PHONE_FORMAT,
  PHONE_NOT_ALLOWED,
  PHONE_NOT_US,
  phoneErrorCopy,
  tooManyCodes,
  tooManyTries,
} from '@/server/auth/errors';
import { requireSignedIn } from '@/server/auth/gate';
import { requestIsSameOrigin } from '@/server/auth/origin';
import { allowPhoneCodeCheck, allowPhoneCodeSend } from '@/server/auth/otp-limits';
import { sessionClient } from '@/server/supabase-server';

export type StepResult = { status: 'sent' } | { status: 'error'; message: string };

/** Where a phone change returns: the next onboarding step, or Settings. */
const PhoneReturn = z.discriminatedUnion('context', [
  z.object({ context: z.literal('welcome'), next: z.unknown() }),
  z.object({ context: z.literal('settings') }),
]);
type PhoneReturn = z.infer<typeof PhoneReturn>;

function returnPath(target: PhoneReturn): string {
  return target.context === 'settings'
    ? '/settings/account?updated=phone'
    : welcomeHref(nextOf(target.next));
}

function nextOf(next: unknown): string | null {
  return typeof next === 'string' ? next : null;
}

/**
 * Sends an SMS code to a US mobile number (D-34). Supabase doesn't captcha-check phone changes
 * (PUT /user), so the Turnstile token is verified here. App-level limits apply per account, per
 * number, and per distinct numbers a day. Uninvited accounts can't trigger SMS.
 */
export async function sendPhoneCode(input: unknown): Promise<StepResult> {
  if (!(await requestIsSameOrigin())) return { status: 'error', message: ORIGIN_ERROR };
  const member = await requireSignedIn('/welcome');
  if (!member.invited) return { status: 'error', message: CLOSED_TEST_MESSAGE };

  const parsed = PhoneCodeRequest.safeParse(input);
  if (!parsed.success) return { status: 'error', message: PHONE_FORMAT };
  const config = authConfig();
  const phone = parseUsPhone(parsed.data.phone, { allowFictional: config.allowTestPhoneNumbers });
  if (!phone.ok) {
    const message = { format: PHONE_FORMAT, not_us: PHONE_NOT_US, not_allowed: PHONE_NOT_ALLOWED };
    return { status: 'error', message: message[phone.reason] };
  }
  if (!(await verifyCaptcha(config.captcha, parsed.data.captchaToken))) {
    return { status: 'error', message: CAPTCHA_ERROR };
  }

  try {
    const limit = await allowPhoneCodeSend(member.userId, phone.e164);
    if (!limit.ok) return { status: 'error', message: tooManyCodes(limit.retryAfterSeconds) };
    const supabase = await sessionClient();
    const { error } = await supabase.auth.updateUser({ phone: phone.e164 });
    if (error !== null) return { status: 'error', message: phoneErrorCopy(error) };
    return { status: 'sent' };
  } catch {
    return { status: 'error', message: GENERIC_ERROR };
  }
}

/** Confirms the SMS code for the number Supabase is holding as the pending change. */
export async function verifyPhoneCode(input: unknown, target: unknown): Promise<StepResult> {
  if (!(await requestIsSameOrigin())) return { status: 'error', message: ORIGIN_ERROR };
  const member = await requireSignedIn('/welcome');
  const parsed = PhoneCodeVerify.safeParse(input);
  const back = PhoneReturn.safeParse(target);
  if (!parsed.success || !back.success) return { status: 'error', message: CODE_ERROR };

  try {
    const limit = await allowPhoneCodeCheck(member.userId);
    if (!limit.ok) return { status: 'error', message: tooManyTries(limit.retryAfterSeconds) };
    const supabase = await sessionClient();
    const { data } = await supabase.auth.getUser();
    const pending = data.user?.new_phone;
    if (pending === undefined || pending === '') {
      return { status: 'error', message: 'Send a code to your number first.' };
    }
    const { error } = await supabase.auth.verifyOtp({
      phone: pending,
      token: parsed.data.code,
      type: 'phone_change',
    });
    if (error !== null) return { status: 'error', message: phoneErrorCopy(error) };
  } catch {
    return { status: 'error', message: GENERIC_ERROR };
  }
  redirect(returnPath(back.data));
}

async function invitedMember(): Promise<{ ok: true } | StepResult> {
  if (!(await requestIsSameOrigin())) return { status: 'error', message: ORIGIN_ERROR };
  const member = await requireSignedIn('/welcome');
  if (!member.invited) return { status: 'error', message: CLOSED_TEST_MESSAGE };
  return { ok: true };
}

/** "I'm 18 or older." Stores the attestation time only (no date of birth). */
export async function attestAge(input: unknown, next: unknown): Promise<StepResult> {
  const gate = await invitedMember();
  if (!('ok' in gate)) return gate;
  if (!AgeAttestation.safeParse(input).success) {
    return { status: 'error', message: 'Confirm that you’re 18 or older to continue.' };
  }
  const supabase = await sessionClient();
  const { error } = await supabase.rpc('attest_age');
  if (error !== null) return { status: 'error', message: GENERIC_ERROR };
  redirect(welcomeHref(nextOf(next)));
}

/** Home ZIP: any valid US ZIP (a Census ZCTA). Becomes the member's default location. */
export async function saveHomeZip(input: unknown, next: unknown): Promise<StepResult> {
  const gate = await invitedMember();
  if (!('ok' in gate)) return gate;
  const parsed = HomeZipInput.safeParse(input);
  if (!parsed.success) return { status: 'error', message: 'Enter a 5-digit ZIP code.' };
  const area = await lookupPostalArea(parsed.data.zip);
  if (area === null) {
    return {
      status: 'error',
      message: 'We couldn’t find that ZIP. Try the ZIP where you live or pick up items.',
    };
  }
  const member = await requireSignedIn('/welcome');
  const supabase = await sessionClient();
  const { error } = await supabase
    .from('profiles')
    .update({ home_zip: area.zip })
    .eq('id', member.userId);
  if (error !== null) return { status: 'error', message: GENERIC_ERROR };
  redirect(welcomeHref(nextOf(next)));
}

/** Display name: first name or nickname (2–25, no links, emails, phone numbers or blocked terms). */
export async function saveDisplayName(input: unknown, next: unknown): Promise<StepResult> {
  const gate = await invitedMember();
  if (!('ok' in gate)) return gate;
  const parsed = DisplayNameInput.safeParse(input);
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? GENERIC_ERROR };
  }
  const member = await requireSignedIn('/welcome');
  const supabase = await sessionClient();
  const { error } = await supabase
    .from('profiles')
    .update({ display_name: parsed.data.displayName })
    .eq('id', member.userId);
  if (error !== null) return { status: 'error', message: GENERIC_ERROR };
  redirect(welcomeHref(nextOf(next)));
}
