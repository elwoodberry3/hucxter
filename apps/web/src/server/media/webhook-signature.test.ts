import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { signWebhook, verifyWebhook } from './webhook-signature';

const SECRET = 'whsec-test';
const BODY = '{"id":"evt_1","type":"video.asset.ready","data":{}}';
const NOW = Date.UTC(2026, 10, 6, 12, 0, 0);

describe('Mux webhook signatures', () => {
  it('accepts the Mux format: t=<s>,v1=<hex HMAC-SHA256 of "t.body">', () => {
    const t = Math.floor(NOW / 1000);
    const v1 = createHmac('sha256', SECRET)
      .update(`${String(t)}.${BODY}`)
      .digest('hex');
    expect(verifyWebhook(BODY, `t=${String(t)},v1=${v1}`, SECRET, NOW)).toBe(true);
    expect(verifyWebhook(BODY, signWebhook(BODY, SECRET, NOW), SECRET, NOW)).toBe(true);
  });

  it('rejects a wrong secret, a changed body, or a missing header', () => {
    const header = signWebhook(BODY, SECRET, NOW);
    expect(verifyWebhook(BODY, header, 'other', NOW)).toBe(false);
    expect(verifyWebhook(`${BODY} `, header, SECRET, NOW)).toBe(false);
    expect(verifyWebhook(BODY, null, SECRET, NOW)).toBe(false);
    expect(verifyWebhook(BODY, header, '', NOW)).toBe(false);
  });

  it('rejects timestamps more than 5 minutes old or in the future', () => {
    const header = signWebhook(BODY, SECRET, NOW);
    expect(verifyWebhook(BODY, header, SECRET, NOW + 300_000)).toBe(true);
    expect(verifyWebhook(BODY, header, SECRET, NOW + 301_000)).toBe(false);
    expect(verifyWebhook(BODY, header, SECRET, NOW - 301_000)).toBe(false);
  });

  it('rejects malformed headers and accepts any one matching v1', () => {
    const good = signWebhook(BODY, SECRET, NOW);
    const t = good.split(',')[0] ?? '';
    for (const bad of ['', 'v1=abc', t, `${t},v1=zz`, `t=abc,${good.split(',')[1] ?? ''}`]) {
      expect(verifyWebhook(BODY, bad, SECRET, NOW), bad).toBe(false);
    }
    expect(
      verifyWebhook(BODY, `${t},v1=${'0'.repeat(64)},${good.split(',')[1] ?? ''}`, SECRET, NOW),
    ).toBe(true);
  });
});
