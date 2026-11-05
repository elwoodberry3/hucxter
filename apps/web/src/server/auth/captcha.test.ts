import { describe, expect, it, vi } from 'vitest';
import { verifyCaptcha } from './captcha';

// Cloudflare's documented test keys/token (never real keys):
// https://developers.cloudflare.com/turnstile/troubleshooting/testing/
const turnstile = {
  provider: 'turnstile' as const,
  siteKey: '1x00000000000000000000AA',
  secretKey: '1x0000000000000000000000000000000AA',
};
const DUMMY_TOKEN = 'XXXX.DUMMY.TOKEN.XXXX';

function reply(body: unknown, status = 200) {
  return vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status })));
}

describe('verifyCaptcha', () => {
  it('is a no-op when the captcha is off', async () => {
    const fetchImpl = reply({ success: false });
    expect(await verifyCaptcha({ provider: 'none' }, undefined, fetchImpl)).toBe(true);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('posts the secret and token to siteverify and accepts success', async () => {
    const fetchImpl = reply({ success: true });
    expect(await verifyCaptcha(turnstile, DUMMY_TOKEN, fetchImpl)).toBe(true);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify');
    const body = init.body as URLSearchParams;
    expect(body.get('secret')).toBe(turnstile.secretKey);
    expect(body.get('response')).toBe(DUMMY_TOKEN);
  });

  it('fails closed on a missing token, a failed check, an HTTP error, or a network error', async () => {
    expect(await verifyCaptcha(turnstile, undefined, reply({ success: true }))).toBe(false);
    expect(await verifyCaptcha(turnstile, DUMMY_TOKEN, reply({ success: false }))).toBe(false);
    expect(await verifyCaptcha(turnstile, DUMMY_TOKEN, reply({ success: true }, 500))).toBe(false);
    expect(await verifyCaptcha(turnstile, DUMMY_TOKEN, reply({ nope: 1 }))).toBe(false);
    const broken = vi.fn(() => Promise.reject(new Error('offline')));
    expect(await verifyCaptcha(turnstile, DUMMY_TOKEN, broken)).toBe(false);
  });
});
