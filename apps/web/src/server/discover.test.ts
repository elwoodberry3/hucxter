import { decodeCursor } from '@hucxter/contracts';
import type { ListingCard } from '@hucxter/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const searchListings = vi.fn();
const loadListingView = vi.fn();
const playbackSource = vi.fn();
const savedAmong = vi.fn();
vi.mock('@/lib/listings', () => ({ searchListings }));
vi.mock('@/server/listings/public', () => ({ loadListingView }));
vi.mock('@/server/media/playback', () => ({ playbackSource }));
vi.mock('@/server/saves', () => ({ savedAmong }));
vi.mock('@/lib/taxonomy', () => ({
  getTaxonomy: () => Promise.resolve({ departments: [] }),
  findDepartment: () => undefined,
}));
vi.mock('@/server/supabase-server', () => ({ sessionClient: () => Promise.resolve({}) }));
vi.mock('@/server/log', () => ({ logError: vi.fn(), codeOf: () => 'x' }));
const { discoverItem, discoverPage, startCursor } = await import('./discover');

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
function card(n: number): ListingCard {
  return {
    id: id(n),
    title: `Lamp ${String(n)}`,
    price_cents: 1000,
    condition: 'good',
    status: 'available',
    distance_bucket: '<1 mi',
    area_label: 'Portland',
    posted_at: '2026-11-09T10:00:00.000Z',
    poster_url: `/media/poster/${id(n)}`,
    category_slug: 'lighting',
    is_demo: false,
  };
}
function view(overrides: Record<string, unknown> = {}, listing: Record<string, unknown> = {}) {
  return {
    kind: 'listing',
    isOwner: false,
    inReview: false,
    mediaReady: true,
    mediaId: 'm1',
    listing: { id: id(3), status: 'available', posted_at: '2026-11-09T10:00:00.123Z', ...listing },
    ...overrides,
  };
}
const viewer = { zip: '97205', radiusMi: 25 as const };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('startCursor', () => {
  it('starts 1 ms after the posted time, so microsecond timestamps still include the listing', () => {
    expect(decodeCursor(startCursor('2026-11-09T10:00:00.123Z'))).toEqual({
      k: 0,
      t: '2026-11-09T10:00:00.124Z',
      id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
    });
  });
});

describe('discoverPage', () => {
  it('wraps cards in the typed feed envelope, newest first with Pending included', async () => {
    searchListings.mockResolvedValue({ items: [card(1), card(2)], nextCursor: 'c' });
    const page = await discoverPage(viewer);
    expect(page.items.map((item) => item.type)).toEqual(['listing', 'listing']);
    expect(page.nextCursor).toBe('c');
    const query = (searchListings.mock.calls[0]?.[0] as { query: { sort: string; status: string } })
      .query;
    expect(query).toMatchObject({ sort: 'newest', status: 'include_pending' });
  });

  it('starts at ?l= when the listing is in the feed, and says when that is below the newest', async () => {
    loadListingView.mockResolvedValue(view());
    searchListings.mockImplementation(({ limit }: { limit: number }) =>
      Promise.resolve(
        limit === 1
          ? { items: [card(1)], nextCursor: 'n' }
          : { items: [card(2), card(3), card(4)], nextCursor: 'after-4' },
      ),
    );
    const page = await discoverPage(viewer, { startAt: id(3) });
    expect(page.items.map((item) => item.id)).toEqual([id(3), id(4)]);
    expect(page).toMatchObject({ startId: id(3), startMissing: false, startedMidway: true });
  });

  it('starts at the newest with a note when ?l= is out of the feed', async () => {
    loadListingView.mockResolvedValue(view({}, { status: 'sold' }));
    searchListings.mockResolvedValue({ items: [card(1)], nextCursor: null });
    const page = await discoverPage(viewer, { startAt: id(3) });
    expect(page).toMatchObject({ startId: null, startMissing: true, startedMidway: false });
    expect(page.items.map((item) => item.id)).toEqual([id(1)]);
  });

  it('ignores a malformed ?l= without a lookup', async () => {
    searchListings.mockResolvedValue({ items: [], nextCursor: null });
    const page = await discoverPage(viewer, { startAt: 'not-a-uuid' });
    expect(loadListingView).not.toHaveBeenCalled();
    expect(page.startMissing).toBe(false);
  });
});

describe('discoverItem', () => {
  it.each([
    ['sold', view({}, { status: 'sold' })],
    ['in review', view({ inReview: true })],
    ['not ready', view({ mediaReady: false })],
    ['a draft', { kind: 'draft', id: id(3) }],
    ['gone', null],
  ])('is null when the item is %s, and signs nothing', async (_label, value) => {
    loadListingView.mockResolvedValue(value);
    expect(await discoverItem(id(3), '97205')).toBeNull();
    expect(playbackSource).not.toHaveBeenCalled();
  });

  it('returns details, saved state and playback for a live item', async () => {
    loadListingView.mockResolvedValue(view());
    playbackSource.mockResolvedValue({ kind: 'file', src: '/v.mp4', poster: '/p.svg' });
    savedAmong.mockResolvedValue(new Set([id(3)]));
    const item = await discoverItem(id(3), '97205');
    expect(item).toMatchObject({ saved: true, own: false, source: { kind: 'file' } });
  });

  it('still returns the details when the video provider fails', async () => {
    loadListingView.mockResolvedValue(view());
    playbackSource.mockRejectedValue(new Error('down'));
    savedAmong.mockResolvedValue(new Set());
    expect((await discoverItem(id(3), '97205'))?.source).toBeNull();
  });

  it('throws on a database error so the route can answer 503', async () => {
    loadListingView.mockRejectedValue(new Error('listing_public:500'));
    await expect(discoverItem(id(3), '97205')).rejects.toThrow();
  });
});
