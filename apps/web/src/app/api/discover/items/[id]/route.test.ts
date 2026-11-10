import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const discoverItem = vi.fn();
vi.mock('@/server/discover', () => ({ discoverItem }));
vi.mock('@/lib/viewer-location', () => ({
  getViewerLocation: () => Promise.resolve({ zip: '97205', radiusMi: 25 }),
}));
vi.mock('@/server/log', () => ({ logError: vi.fn(), codeOf: () => 'x' }));
const { GET } = await import('./route');

const ID = '00000000-0000-4000-8000-000000000003';
const call = (headers: Record<string, string> = { 'sec-fetch-site': 'same-origin' }) =>
  GET(new Request(`http://app.test/api/discover/items/${ID}`, { headers }), {
    params: Promise.resolve({ id: ID }),
  });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Discover item route (3D)', () => {
  it('answers 404 when the item left the feed, never cached', async () => {
    discoverItem.mockResolvedValue(null);
    const response = await call();
    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });

  it('answers 503 on a database error, so the client may retry', async () => {
    discoverItem.mockRejectedValue(new Error('listing_public:500'));
    expect((await call()).status).toBe(503);
  });

  it('returns the item as private JSON using the viewer ZIP', async () => {
    discoverItem.mockResolvedValue({ detail: { id: ID }, saved: false, own: false, source: null });
    const response = await call();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(discoverItem).toHaveBeenCalledWith(ID, '97205');
  });

  it('refuses requests from other sites', async () => {
    expect((await call({ 'sec-fetch-site': 'cross-site' })).status).toBe(403);
    expect(discoverItem).not.toHaveBeenCalled();
  });
});
