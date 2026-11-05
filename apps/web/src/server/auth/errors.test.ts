import { describe, expect, it } from 'vitest';
import {
  CLOSED_TEST_MESSAGE,
  CODE_ERROR,
  GENERIC_ERROR,
  PHONE_IN_USE,
  callbackErrorOutcome,
  isClosedTestRejection,
  phoneErrorCopy,
  tooManyCodes,
} from './errors';

describe('isClosedTestRejection', () => {
  it('matches the before-user-created hook rejection (403 + our message, code "unknown")', () => {
    expect(
      isClosedTestRejection({ status: 403, code: 'unknown', message: CLOSED_TEST_MESSAGE }),
    ).toBe(true);
  });

  it('ignores other errors', () => {
    expect(isClosedTestRejection(null)).toBe(false);
    expect(isClosedTestRejection({ status: 403, message: 'Forbidden' })).toBe(false);
    expect(isClosedTestRejection({ status: 400, message: CLOSED_TEST_MESSAGE })).toBe(false);
  });
});

describe('phoneErrorCopy', () => {
  it('uses a neutral message for a number already in use', () => {
    expect(phoneErrorCopy({ code: 'phone_exists', message: 'Phone number already exists' })).toBe(
      PHONE_IN_USE,
    );
    expect(PHONE_IN_USE).not.toMatch(/account|registered|exists/i);
  });

  it('never echoes the Supabase message', () => {
    const copy = phoneErrorCopy({ code: 'something_new', message: 'leak +15035550100' });
    expect(copy).toBe(GENERIC_ERROR);
    expect(phoneErrorCopy({ code: 'otp_expired' })).toBe(CODE_ERROR);
  });
});

describe('callbackErrorOutcome (Google redirect errors)', () => {
  it('maps the hook rejection to the closed-test screen', () => {
    const params = new URLSearchParams({
      error: 'server_error',
      error_code: 'unexpected_failure',
      error_description: CLOSED_TEST_MESSAGE,
    });
    expect(callbackErrorOutcome(params)).toBe('closed_test');
  });

  it('maps a cancelled consent to "cancelled" and anything else to "failed"', () => {
    expect(callbackErrorOutcome(new URLSearchParams({ error: 'access_denied' }))).toBe('cancelled');
    expect(callbackErrorOutcome(new URLSearchParams({ error: 'server_error' }))).toBe('failed');
    expect(callbackErrorOutcome(new URLSearchParams())).toBe('failed');
  });
});

describe('tooManyCodes', () => {
  it('rounds up to whole minutes', () => {
    expect(tooManyCodes(30)).toBe('Too many codes requested. Try again in 1 minute.');
    expect(tooManyCodes(3599)).toBe('Too many codes requested. Try again in 60 minutes.');
  });
});
