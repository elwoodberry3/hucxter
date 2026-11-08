import { decodeCursor, parseListingQuery } from '@hucxter/contracts';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const rpc = vi.fn();
vi.mock('@/server/supabase-server', () => ({
  sessionClient: () => Promise.resolve({ rpc }),
  readOrGuest: (db: unknown, _event: string, run: (client: unknown) => unknown) => run(db),
}));
vi.mock('./taxonomy', () => ({ getTaxonomy: vi.fn(), findDepartment: vi.fn() }));
vi.mock('./viewer-location', () => ({ getViewerLocation: vi.fn() }));
// Guests: cards come back without viewer flags (server/saves.ts reads nothing).
vi.mock('@/server/auth/member', () => ({ loadMemberForDisplay: () => Promise.resolve(null) }));

const { nearbyFilters, searchListings } = await import('./listings');

describe('nearbyFilters', () => {
  it('sends only what the URL sets, with prices in cents', () => {
    expect(nearbyFilters(parseListingQuery({}))).toEqual({ sort: 'newest' });
    expect(
      nearbyFilters(
        parseListingQuery({
          price_min: '20',
          price_max: '150',
          condition: ['good', 'like_new'],
          posted: '7d',
          status: 'include_pending',
          sort: 'price_asc',
        }),
      ),
    ).toEqual({
      sort: 'price_asc',
      posted: '7d',
      conditions: ['like_new', 'good'],
      price_min: 2000,
      price_max: 15000,
      include_pending: true,
    });
    expect(nearbyFilters(parseListingQuery({ free: 'true' }))).toEqual({
      sort: 'newest',
      free: true,
    });
  });
});

describe('searchListings', () => {
  it('returns nothing without a location (no query is made)', async () => {
    const page = await searchListings({
      query: parseListingQuery({}),
      zip: null,
      radiusMi: 25,
      limit: 24,
    });
    expect(page).toEqual({ items: [], nextCursor: null });
  });
});

const row = (i: number) => ({
  id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
  title: `Chair ${String(i)}`,
  price_cents: 1000,
  condition: 'good',
  status: 'available',
  distance_bucket: '1–5 mi',
  area_label: 'Portland',
  state: 'OR',
  published_at: '2026-11-06T21:00:00.123456+00:00',
  category_slug: 'furniture',
  department_slug: 'home',
  media_id: null,
  cursor: { k: 0, t: '2026-11-06T21:00:00.123456+00:00', id: `id-${String(i)}` },
});

describe('searchListings rows', () => {
  it('maps rows to cards, asks for one extra row, and keeps the cursor exact', async () => {
    const rows = [row(1), row(2), row(3)].map((r) => ({ ...r, cursor: { ...r.cursor, id: r.id } }));
    rpc.mockResolvedValue({ data: rows, error: null });
    const page = await searchListings({
      query: parseListingQuery({ q: 'chair' }),
      zip: '97205',
      radiusMi: 25,
      limit: 2,
    });
    expect(rpc).toHaveBeenCalledWith(
      'listings_nearby',
      expect.objectContaining({ p_zip: '97205', p_radius_mi: 25, p_query: 'chair', p_limit: 3 }),
    );
    expect(page.items.map((card) => card.title)).toEqual(['Chair 1', 'Chair 2']);
    expect(page.items[0]).toMatchObject({
      posted_at: '2026-11-06T21:00:00.123Z',
      poster_url: `/media/poster/${rows[0]?.id ?? ''}`,
      is_demo: false,
    });
    // Microseconds survive into the cursor, so the next page starts exactly after row 2.
    expect(decodeCursor(page.nextCursor ?? undefined)).toEqual({
      k: 0,
      t: '2026-11-06T21:00:00.123456+00:00',
      id: rows[1]?.id,
    });
  });

  it('has no next page when the extra row is missing, drops malformed rows, and degrades on errors', async () => {
    rpc.mockResolvedValue({ data: [row(1), { ...row(2), distance_bucket: '3 mi' }], error: null });
    const page = await searchListings({
      query: parseListingQuery({}),
      zip: '97205',
      radiusMi: 25,
      limit: 5,
    });
    expect(page.items.map((card) => card.title)).toEqual(['Chair 1']);
    expect(page.nextCursor).toBeNull();
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    rpc.mockResolvedValue({ data: null, error: { code: '22023' } });
    await expect(
      searchListings({ query: parseListingQuery({}), zip: '97205', radiusMi: 25, limit: 5 }),
    ).resolves.toEqual({ items: [], nextCursor: null });
    expect(error).toHaveBeenCalledWith('{"event":"listings_nearby_failed","code":"22023"}');
    error.mockRestore();
  });
});
