import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();
vi.mock('../admin-db', () => ({
  adminDb: () => ({ rpc }),
  subjectHash: (kind: string, value: string) => `${kind}#${String(value.length)}`.padEnd(64, '0'),
}));

const { allowEmailCodeSend, beginEmailCodeCheck, emailCodeSucceeded, EMAIL_CODE_LIMITS } =
  await import('./otp-limits');

const SESSION = '3f1c2b9a-6d4e-4f7a-9b2c-1e8d7a6b5c4d';
const EMAIL = 'someone@example.test';

describe('email-code limits (Brief 03C.1 §3.0)', () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it('passes only hashes and the configured limits to the database', async () => {
    rpc.mockResolvedValue({ data: [{ session_id: SESSION, kind: 'normal' }], error: null });
    await expect(allowEmailCodeSend(EMAIL, 'browser-id', null)).resolves.toEqual({
      ok: true,
      sessionId: SESSION,
      kind: 'normal',
    });
    const [name, args] = rpc.mock.calls[0] as [string, Record<string, unknown>];
    expect(name).toBe('email_code_send');
    expect(JSON.stringify(args)).not.toContain(EMAIL);
    expect(JSON.stringify(args)).not.toContain('browser-id');
    expect(args).toMatchObject({
      p_device_hash: null,
      p_checks_per_send: 5,
      p_browser_per_hour: 3,
      p_email_per_hour: 6,
      p_overflow_spacing_s: 600,
      p_overflow_checks: 3,
      p_known_per_hour: 3,
    });
  });

  it('keeps the guessing bound at 48 wrong checks per address per hour', () => {
    const overflowSendsPerHour = 3600 / EMAIL_CODE_LIMITS.overflowSpacingSeconds;
    const bound =
      EMAIL_CODE_LIMITS.sendsPerAddressPerHour * EMAIL_CODE_LIMITS.checksPerSend +
      overflowSendsPerHour * EMAIL_CODE_LIMITS.overflowChecksPerSend;
    expect(bound).toBe(48);
  });

  it('fails closed when the database errors or answers something unexpected', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'down' } });
    await expect(allowEmailCodeSend(EMAIL, 'b', null)).resolves.toEqual({ ok: false });
    rpc.mockResolvedValueOnce({ data: [{ session_id: null, kind: 'denied' }], error: null });
    await expect(allowEmailCodeSend(EMAIL, 'b', 'd')).resolves.toEqual({ ok: false });
    rpc.mockResolvedValueOnce({ data: 'nope', error: null });
    await expect(beginEmailCodeCheck(EMAIL, 'b')).resolves.toBeNull();
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'down' } });
    await expect(beginEmailCodeCheck(EMAIL, 'b')).resolves.toBeNull();
  });

  it('a successful check ends the sessions and remembers the device', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await emailCodeSucceeded(EMAIL, SESSION, 'device-id');
    expect(rpc.mock.calls.map(([name]) => name as string)).toEqual([
      'email_code_check_succeeded',
      'email_known_device_add',
    ]);
  });
});
