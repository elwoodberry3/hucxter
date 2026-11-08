import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

vi.mock('server-only', () => ({}));
const rpc = vi.fn();
const remove = vi.fn();
vi.mock('@/server/admin-db', () => ({
  adminDb: () => ({ rpc, storage: { from: () => ({ remove }) } }),
}));
vi.mock('@/server/media/provider', () => ({ videoProvider: () => Promise.resolve({}) }));
const { jobErrorCode, runJobs } = await import('./run');

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

describe('storage_delete_avatar jobs (3C.2 account deletion)', () => {
  const path = '3f1c2b9a-6d4e-4f7a-9b2c-1e8d7a6b5c4d.webp';
  beforeEach(() => {
    rpc.mockReset();
    remove.mockReset();
  });

  function queue(payload: unknown) {
    rpc.mockImplementation((name: string) =>
      Promise.resolve(
        name === 'media_sweep_orphans'
          ? { data: 0, error: null }
          : name === 'jobs_claim'
            ? { data: [{ id: 7, kind: 'storage_delete_avatar', payload }], error: null }
            : { data: null, error: null },
      ),
    );
  }

  it('deletes the photo from the avatars bucket and completes the job', async () => {
    queue({ path });
    remove.mockResolvedValue({ data: [], error: null });
    expect(await runJobs()).toEqual({ done: 1, failed: 0, swept: 0 });
    expect(remove).toHaveBeenCalledWith([path]);
    expect(rpc).toHaveBeenCalledWith('jobs_complete', { p_id: 7 });
  });

  it('retries (fails the job) when Storage refuses, and never touches other paths', async () => {
    queue({ path });
    remove.mockResolvedValue({ data: null, error: { message: 'boom' } });
    expect(await runJobs()).toMatchObject({ done: 0, failed: 1 });
    expect(rpc).toHaveBeenCalledWith('jobs_fail', { p_id: 7, p_error: 'storage_delete_failed' });

    rpc.mockClear();
    remove.mockClear();
    queue({ path: '../listings/secret.mp4' });
    expect(await runJobs()).toMatchObject({ failed: 1 });
    expect(remove).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith('jobs_fail', { p_id: 7, p_error: 'bad_payload' });
  });
});
