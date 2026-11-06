import { z } from 'zod';
import { Zip } from './location';

/** Sign-in email: trimmed and lowercased. Never logged or sent to analytics. */
export const Email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, 'Enter a valid email address.')
  .pipe(z.email('Enter a valid email address.'));

/** A 6-digit one-time code (email or SMS). Spaces are ignored. */
export const OtpCode = z
  .string()
  .transform((value) => value.replace(/\s+/g, ''))
  .pipe(z.string().regex(/^\d{6}$/, 'Enter the 6-digit code.'));

export type PhoneRejection = 'format' | 'not_us' | 'not_allowed';
export type ParsedPhone = { ok: true; e164: string } | { ok: false; reason: PhoneRejection };

const TOLL_FREE_AREA_CODES = new Set(['800', '833', '844', '855', '866', '877', '888']);

/**
 * US (+1) mobile numbers only, as E.164. Rejects other countries, malformed NANP numbers
 * (area code or exchange starting 0/1, N11 codes), toll-free (8XX), and premium (900, 976).
 * The 555-0100–0199 range is fictional; only the local test stack (with `allowFictional`)
 * accepts it, for its fixed-code test numbers.
 */
export function parseUsPhone(raw: string, { allowFictional = false } = {}): ParsedPhone {
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > 25) return { ok: false, reason: 'format' };
  if (/[^\d\s().+-]/.test(trimmed)) return { ok: false, reason: 'format' };
  const hasPlus = trimmed.startsWith('+');
  if (trimmed.indexOf('+') > 0 || (trimmed.match(/\+/g)?.length ?? 0) > 1) {
    return { ok: false, reason: 'format' };
  }
  let digits = trimmed.replace(/\D/g, '');
  if (hasPlus) {
    if (!digits.startsWith('1')) return { ok: false, reason: 'not_us' };
    digits = digits.slice(1);
  } else if (digits.length === 11 && digits.startsWith('1')) {
    digits = digits.slice(1);
  }
  if (digits.length !== 10) return { ok: false, reason: 'format' };

  const area = digits.slice(0, 3);
  const exchange = digits.slice(3, 6);
  const line = digits.slice(6);
  if (!/^[2-9]\d\d$/.test(area) || !/^[2-9]\d\d$/.test(exchange)) {
    return { ok: false, reason: 'format' };
  }
  if (/^[2-9]11$/.test(area) || /^[2-9]11$/.test(exchange)) return { ok: false, reason: 'format' };
  if (TOLL_FREE_AREA_CODES.has(area) || area === '900' || exchange === '976') {
    return { ok: false, reason: 'not_allowed' };
  }
  if (exchange === '555' && /^01\d\d$/.test(line) && !allowFictional) {
    return { ok: false, reason: 'not_allowed' };
  }
  return { ok: true, e164: `+1${digits}` };
}

const DIGITS_LIMIT = 7;
const URL_LIKE = /(:\/\/|www\.|\.(com|net|org|io|app|co|me|ly|gg|tv|us|info|biz)\b)/i;

/**
 * Display name: first name or nickname, 2–40 characters, with no URLs, emails, or phone numbers
 * (the database CHECK on profiles.display_name mirrors this).
 */
export const DisplayName = z
  .string()
  .trim()
  .min(2, 'Use at least 2 characters.')
  .max(40, 'Use 40 characters or fewer.')
  // eslint-disable-next-line no-control-regex -- control characters are exactly what we reject
  .refine((value) => !/[\u0000-\u001f\u007f]/.test(value), 'Use letters, numbers, and spaces.')
  .refine(
    (value) => !value.includes('@') && !URL_LIKE.test(value),
    'Don’t include links or emails.',
  )
  .refine(
    (value) => value.replace(/\D/g, '').length < DIGITS_LIMIT,
    'Don’t include a phone number.',
  );

export const EmailCodeRequest = z.object({
  email: Email,
  captchaToken: z.string().max(4096).optional(),
});
export const EmailCodeVerify = z.object({ email: Email, code: OtpCode });
export const PhoneCodeRequest = z.object({
  phone: z.string().max(25),
  captchaToken: z.string().max(4096).optional(),
});
export const PhoneCodeVerify = z.object({ code: OtpCode });
export const AgeAttestation = z.object({ confirmed: z.literal(true) });
export const HomeZipInput = z.object({ zip: Zip });
export const DisplayNameInput = z.object({ displayName: DisplayName });
export const ProfileUpdate = z.object({ displayName: DisplayName, zip: Zip });
export const DeleteAccountInput = z.object({ confirm: z.literal('DELETE') });

/** The onboarding steps in order (D-34). Email is confirmed by signing in. */
export const ONBOARDING_STEPS = ['phone', 'age', 'zip', 'name'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];
