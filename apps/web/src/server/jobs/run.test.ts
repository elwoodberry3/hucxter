import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

vi.mock('@/server/admin-db', () => ({ adminDb: () => ({}) }));
vi.mock('@/server/media/provider', () => ({ videoProvider: () => Promise.resolve({}) }));
const { jobErrorCode } = await import('./run');

describe('jobErrorCode', () => {
  it('stores short codes only, never provider messages', () => {
    expect(jobErrorCode(z.object({ a: z.string() }).safeParse({}).error)).toBe('bad_payload');
    expect(jobErrorCode(Object.assign(new Error('Asset abc123 not ready'), { status: 409 }))).toBe(
      'provider_409',
    );
    expect(jobErrorCode(new Error('unknown_job_kind'))).toBe('unknown_job_kind');
    expect(jobErrorCode(new Error('Something with ids: asset_9'))).toBe('job_failed');
    expect(jobErrorCode('x')).toBe('job_failed');
  });
});
