import { afterEach, describe, expect, it, vi } from 'vitest';
import { codeOf, logError } from './log';
import { isStaleAuthError, isStaleSessionRead } from './auth/stale-session';

describe('logError (Brief 03C.1b H5)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes the event, HTTP status and code only', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    logError('profile_by_handle_stale_session', { status: 401, code: 'PGRST301' });
    expect(spy).toHaveBeenCalledWith(
      '{"event":"profile_by_handle_stale_session","status":401,"code":"PGRST301"}',
    );
  });

  it('drops anything that is not code-shaped, so a message or address never lands in the log', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    logError('x', { code: 'someone@example.test' });
    logError('y', { code: 'duplicate key value violates unique constraint' });
    expect(spy.mock.calls).toEqual([['{"event":"x"}'], ['{"event":"y"}']]);
  });

  it('takes a code from thrown values, never their messages', () => {
    expect(codeOf({ code: '23505', message: 'Key (email)=(a@b.c) exists' })).toBe('23505');
    expect(codeOf(new Error('listing_public:PGRST301'))).toBe('PGRST301');
    expect(codeOf(new Error('Key (email)=(a@b.c) exists'))).toBeUndefined();
    expect(codeOf('boom')).toBeUndefined();
  });
});

describe('stale sessions', () => {
  it('treats invalid tokens, missing users and sessions as stale', () => {
    expect(isStaleAuthError({ name: 'AuthInvalidJwtError' })).toBe(true);
    expect(isStaleAuthError({ name: 'AuthApiError', status: 403, code: 'user_not_found' })).toBe(
      true,
    );
    expect(isStaleAuthError({ name: 'AuthApiError', status: 403, code: 'bad_jwt' })).toBe(true);
    expect(isStaleAuthError({ name: 'AuthApiError', status: 400, code: 'session_not_found' })).toBe(
      true,
    );
  });

  it('keeps the session through outages and network errors', () => {
    expect(isStaleAuthError({ name: 'AuthRetryableFetchError', status: 0 })).toBe(false);
    expect(
      isStaleAuthError({ name: 'AuthApiError', status: 500, code: 'unexpected_failure' }),
    ).toBe(false);
    expect(isStaleAuthError(null)).toBe(false);
  });

  it('spots PostgREST refusing the JWT', () => {
    expect(isStaleSessionRead({ status: 401, error: { code: 'PGRST301' } })).toBe(true);
    expect(isStaleSessionRead({ status: 401, error: { code: 'PGRST303' } })).toBe(true);
    expect(isStaleSessionRead({ status: 400, error: { code: '22023' } })).toBe(false);
    expect(isStaleSessionRead({ status: 200, error: null })).toBe(false);
  });
});
