import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const handleMuxWebhook = vi.fn(() => Promise.resolve({ status: 200, outcome: 'ok' }));
vi.mock('./webhook', () => ({ handleMuxWebhook }));
let outcome: string | undefined;
vi.mock('next/headers', () => ({
  cookies: () =>
    Promise.resolve({ get: () => (outcome === undefined ? undefined : { value: outcome }) }),
}));
const { fakeReady, fakeUpload } = await import('./fake-routes');
const { fakeUploadSignature } = await import('./fake');

const MEDIA = '3f1c2b9a-6d4e-4f7a-9b2c-1e8d7a6b5c4d';
const ORIGIN = 'http://localhost:3000';

function post(path: string): Request {
  return new Request(`${ORIGIN}${path}`, { method: 'POST', headers: { Origin: ORIGIN } });
}

describe('fake video ready route (Brief 03C.1b H6)', () => {
  beforeEach(() => {
    vi.stubEnv('APP_ENV', 'local');
    vi.stubEnv('APP_ORIGIN', ORIGIN);
    vi.stubEnv('VIDEO_PROVIDER', 'fake');
    handleMuxWebhook.mockClear();
    outcome = 'slow';
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('refuses a ready call without a signature, with a wrong one, or with the upload one', async () => {
    const base = `/api/dev/fake-video/ready/${MEDIA}`;
    for (const path of [
      base,
      `${base}?sig=${'0'.repeat(64)}`,
      `${base}?sig=${fakeUploadSignature(MEDIA)}`,
    ]) {
      expect((await fakeReady(post(path), MEDIA)).status, path).toBe(403);
    }
    expect(handleMuxWebhook).not.toHaveBeenCalled();
  });

  it('hands the uploader a signed ready URL on the last chunk of a slow upload, and it works', async () => {
    const upload = new Request(
      `${ORIGIN}/api/dev/fake-video/upload/${MEDIA}?sig=${fakeUploadSignature(MEDIA)}`,
      { method: 'PUT', headers: { Origin: ORIGIN }, body: new Uint8Array(8) },
    );
    const done = await fakeUpload(upload, MEDIA);
    expect(done.status).toBe(200);
    const ready = done.headers.get('Hx-Fake-Ready');
    expect(ready).toMatch(new RegExp(`^/api/dev/fake-video/ready/${MEDIA}\\?sig=[0-9a-f]{64}$`));
    expect((await fakeReady(post(ready ?? ''), MEDIA)).status).toBe(204);
    // asset_created on upload, then ready.
    expect(handleMuxWebhook).toHaveBeenCalledTimes(2);
  });
});
