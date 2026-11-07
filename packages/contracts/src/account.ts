import { z } from 'zod';
import { containsBlockedTerm } from './handle';
import { Zip } from './location';
import { plainText } from './sell';

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

export const DISPLAY_NAME_MAX = 25;
export const BIO_MAX = 150;
export const BIO_MAX_LINE_BREAKS = 3;

/** Copy for BLOCKED_TERMS (handle.ts). */
const BLOCKED_MESSAGE = 'Don’t use “Hucxter”, “admin”, “support” or “official”.';
/** Seven digits close together (spaces or punctuation between them): a phone number. */
const PHONE_LIKE = /(\d[^\da-z]{0,3}){7}/i;

/**
 * Display name: first name or nickname, 2–25 characters (Brief 03C.2 §4.4), with no URLs, emails,
 * phone numbers or blocked terms (Founder amendment 2). The database CHECKs on
 * profiles.display_name mirror this.
 */
export const DisplayName = z
  .string()
  .trim()
  .min(2, 'Use at least 2 characters.')
  .max(DISPLAY_NAME_MAX, `Use ${String(DISPLAY_NAME_MAX)} characters or fewer.`)
  // eslint-disable-next-line no-control-regex -- control characters are exactly what we reject
  .refine((value) => !/[\u0000-\u001f\u007f]/.test(value), 'Use letters, numbers, and spaces.')
  .refine(
    (value) => !value.includes('@') && !URL_LIKE.test(value),
    'Don’t include links or emails.',
  )
  .refine(
    (value) => value.replace(/\D/g, '').length < DIGITS_LIMIT,
    'Don’t include a phone number.',
  )
  .refine((value) => !containsBlockedTerm(value), BLOCKED_MESSAGE);

/** Profile bio: optional plain text, 0–150 characters, at most 3 line breaks, same rules. */
export const Bio = plainText(BIO_MAX)
  .refine(
    (value) => (value.match(/\n/g) ?? []).length <= BIO_MAX_LINE_BREAKS,
    `Use ${String(BIO_MAX_LINE_BREAKS)} line breaks or fewer.`,
  )
  .refine(
    (value) => !value.includes('@') && !URL_LIKE.test(value),
    'Don’t include links or emails.',
  )
  .refine((value) => !PHONE_LIKE.test(value), 'Don’t include a phone number.')
  .refine((value) => !containsBlockedTerm(value), BLOCKED_MESSAGE);

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
