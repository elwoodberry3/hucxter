/**
 * Fixed, PII-free copy for auth outcomes. Supabase error *messages* are never shown or logged
 * (they can echo an email or number); we map the error code or status to these strings.
 */
export const CLOSED_TEST_MESSAGE = 'Hucxter is in a closed test. Ask the team for an invite.';
export const EMAIL_CODE_SENT = 'We sent a code if this address can sign in.';
export const GENERIC_ERROR = 'Something went wrong. Try again.';
export const ORIGIN_ERROR = 'This request didn’t come from Hucxter. Reload the page and try again.';
export const CAPTCHA_ERROR = 'We couldn’t confirm you’re a person. Try again.';
export const CODE_ERROR = 'That code didn’t work. Check it, or send a new one.';
export const PHONE_IN_USE = 'We can’t use that number. Try a different mobile number.';
export const PHONE_NOT_US = 'Enter a US mobile number (+1).';
export const PHONE_FORMAT = 'Enter a 10-digit US mobile number.';
export const PHONE_NOT_ALLOWED = 'That number can’t receive codes. Use a US mobile number.';
export const SMS_FAILED = 'We couldn’t send a text to that number. Check it and try again.';
export const GOOGLE_FAILED = 'Google sign-in didn’t finish. Try again.';

export function tooManyCodes(retryAfterSeconds: number): string {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return `Too many codes requested. Try again in ${String(minutes)} minute${minutes === 1 ? '' : 's'}.`;
}

/** Over the code-check limit (same answer whether or not the address has an account). */
export function tooManyTries(retryAfterSeconds: number): string {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return `Too many tries. Try again in ${String(minutes)} minute${minutes === 1 ? '' : 's'}.`;
}

interface AuthErrorLike {
  status?: number | undefined;
  code?: string | undefined;
  message?: string | undefined;
}

/**
 * True when Supabase Auth refused to create the user because the before-user-created hook
 * rejected it. GoTrue returns the hook's own status (403) and message with code "unknown"
 * (verified against the local stack, GoTrue v2.197.0), so the message is our own copy.
 */
export function isClosedTestRejection(error: AuthErrorLike | null | undefined): boolean {
  return error?.status === 403 && error.message === CLOSED_TEST_MESSAGE;
}

/** Copy for errors on the phone step (send or verify). */
export function phoneErrorCopy(error: AuthErrorLike): string {
  switch (error.code) {
    case 'phone_exists':
      return PHONE_IN_USE;
    case 'otp_expired':
    case 'invalid_credentials':
      return CODE_ERROR;
    case 'over_sms_send_rate_limit':
    case 'over_request_rate_limit':
      return tooManyCodes(60);
    case 'sms_send_failed':
      return SMS_FAILED;
    case 'validation_failed':
      return PHONE_FORMAT;
    default:
      return GENERIC_ERROR;
  }
}

export type CallbackOutcome = 'closed_test' | 'cancelled' | 'failed';

/**
 * Classifies the error Supabase Auth adds to the OAuth redirect (`error`, `error_code`,
 * `error_description` query parameters). Only fixed copy reaches the page.
 */
export function callbackErrorOutcome(params: URLSearchParams): CallbackOutcome {
  if (params.get('error_description') === CLOSED_TEST_MESSAGE) return 'closed_test';
  if (params.get('error') === 'access_denied') return 'cancelled';
  return 'failed';
}
