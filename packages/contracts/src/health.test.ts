import { describe, expect, it } from 'vitest';
import { HealthResponse } from './health';

describe('HealthResponse', () => {
  it('accepts a valid body', () => {
    const body = { status: 'ok', version: '0.1.0', commit: 'abc123' };
    expect(HealthResponse.parse(body)).toEqual(body);
  });

  it('rejects any status other than "ok"', () => {
    expect(
      HealthResponse.safeParse({ status: 'down', version: '0.1.0', commit: 'x' }).success,
    ).toBe(false);
  });

  it('rejects extra keys so nothing else leaks', () => {
    const result = HealthResponse.safeParse({
      status: 'ok',
      version: '0.1.0',
      commit: 'x',
      env: 'secret',
    });
    expect(result.success).toBe(false);
  });
});
