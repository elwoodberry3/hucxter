import { afterEach, describe, expect, it, vi } from 'vitest';
import { FakeVideoProvider, fakeUploadSignature, fakeUploadSignatureValid } from './fake';

const MEDIA = '3f1c2b9a-6d4e-4f7a-9b2c-1e8d7a6b5c4d';

describe('FakeVideoProvider', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('refuses to start in qa, production, or a production build without APP_ENV', () => {
    vi.stubEnv('APP_ORIGIN', 'https://hucxter.app');
    vi.stubEnv('VIDEO_PROVIDER', 'fake');
    for (const appEnv of ['qa', 'production', '']) {
      vi.stubEnv('APP_ENV', appEnv);
      vi.stubEnv('NODE_ENV', 'production');
      expect(() => new FakeVideoProvider(), appEnv).toThrow();
    }
  });

  it('starts locally and signs upload URLs to one media id', async () => {
    vi.stubEnv('APP_ENV', 'local');
    const { url } = await new FakeVideoProvider().createUpload(MEDIA);
    const sig = new URL(url).searchParams.get('sig');
    expect(fakeUploadSignatureValid(MEDIA, sig)).toBe(true);
    expect(fakeUploadSignatureValid('00000000-0000-4000-8000-000000000000', sig)).toBe(false);
    expect(fakeUploadSignatureValid(MEDIA, null)).toBe(false);
    expect(fakeUploadSignature(MEDIA)).toMatch(/^[0-9a-f]{64}$/);
  });
});
