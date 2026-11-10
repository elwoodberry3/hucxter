import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const recordEvent = vi.fn();
const loadListingView = vi.fn();
vi.mock('@/server/auth/origin', () => ({
  rejectCrossOrigin: (request: Request) =>
    request.headers.get('origin') === 'http://app.test'
      ? null
      : new Response(null, { status: 403 }),
}));
vi.mock('@/server/events', () => ({ recordEvent }));
vi.mock('@/server/listings/public', () => ({ loadListingView }));
vi.mock('@/server/listings/view-actor', () => ({
  viewActor: () => Promise.resolve({ actor: 'guest:abc', viewerId: null }),
}));
vi.mock('@/server/supabase-server', () => ({ sessionClient: () => Promise.resolve({}) }));
const { POST } = await import('./route');

const LISTING = '00000000-0000-4000-8000-000000000003';
function beacon(body: string, headers: Record<string, string> = {}) {
  return new Request('http://app.test/api/discover/view', {
    method: 'POST',
    body,
    headers: { origin: 'http://app.test', 'sec-fetch-site': 'same-origin', ...headers },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Discover view beacon (3D)', () => {
  it('records discover_viewed for {}', async () => {
    expect((await POST(beacon('{}'))).status).toBe(204);
    expect(recordEvent).toHaveBeenCalledWith(
      { name: 'discover_viewed' },
      { actor: 'guest:abc', viewerId: null },
    );
  });

  it('records discover_item_viewed for a visible listing', async () => {
    loadListingView.mockResolvedValue({
      kind: 'listing',
      isOwner: false,
      inReview: false,
      listing: { id: LISTING },
    });
    expect((await POST(beacon(JSON.stringify({ listingId: LISTING })))).status).toBe(204);
    expect(recordEvent).toHaveBeenCalledWith(
      { name: 'discover_item_viewed' },
      { listingId: LISTING, actor: 'guest:abc', viewerId: null },
    );
  });

  it('never counts the owner, or an item in review', async () => {
    loadListingView.mockResolvedValueOnce({ kind: 'listing', isOwner: true, inReview: false });
    expect((await POST(beacon(JSON.stringify({ listingId: LISTING })))).status).toBe(204);
    loadListingView.mockResolvedValueOnce({ kind: 'listing', isOwner: false, inReview: true });
    expect((await POST(beacon(JSON.stringify({ listingId: LISTING })))).status).toBe(404);
    expect(recordEvent).not.toHaveBeenCalled();
  });

  it('answers but records nothing without a same-origin Sec-Fetch-Site', async () => {
    expect((await POST(beacon('{}', { 'sec-fetch-site': 'cross-site' }))).status).toBe(204);
    expect((await POST(beacon('{}', { 'sec-fetch-site': 'none' }))).status).toBe(204);
    expect(recordEvent).not.toHaveBeenCalled();
  });

  it('refuses another Origin, bad bodies and extra fields', async () => {
    expect((await POST(beacon('{}', { origin: 'https://evil.test' }))).status).toBe(403);
    expect((await POST(beacon('not json'))).status).toBe(400);
    expect((await POST(beacon('{"listingId":"x"}'))).status).toBe(400);
    expect((await POST(beacon('{"zip":"97205"}'))).status).toBe(400);
    expect((await POST(beacon(JSON.stringify({ pad: 'x'.repeat(300) })))).status).toBe(413);
    expect(recordEvent).not.toHaveBeenCalled();
  });
});
