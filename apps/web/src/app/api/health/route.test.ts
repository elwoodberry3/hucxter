import { HealthResponse } from '@hucxter/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import packageJson from '../../../../package.json';
import { GET } from './route';

describe('GET /api/health', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 200 with status, version and commit only', async () => {
    vi.stubEnv('GIT_COMMIT_SHA', 'test-sha');
    const response = GET();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');

    const body: unknown = await response.json();
    expect(HealthResponse.parse(body)).toEqual({
      status: 'ok',
      version: packageJson.version,
      commit: 'test-sha',
    });
    expect(Object.keys(body as object).sort()).toEqual(['commit', 'status', 'version']);
  });
});
