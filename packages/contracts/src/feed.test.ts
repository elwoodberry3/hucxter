import { describe, expect, it } from 'vitest';
import { FeedItem, ListingCard, formatPrice, parseFeedItems } from './feed';

const houseItem = {
  type: 'sponsored',
  id: 'house-1',
  sponsored: {
    sponsor: { kind: 'house', name: 'Hucxter' },
    headline: 'Clear out the garage',
    body: 'List in a minute.',
    cta_label: 'How selling works',
    href: '/how-selling-works',
    art_key: 'sell',
  },
  disclosure: 'Promoted by Hucxter',
  why_shown: 'Hucxter promotes its own features here.',
};

describe('feed envelope', () => {
  it('accepts a house promo labeled "Promoted by Hucxter"', () => {
    expect(FeedItem.safeParse(houseItem).success).toBe(true);
  });

  it('rejects a house promo disguised as a third-party ad, and vice versa', () => {
    expect(FeedItem.safeParse({ ...houseItem, disclosure: 'Sponsored' }).success).toBe(false);
    expect(
      FeedItem.safeParse({
        ...houseItem,
        sponsored: { ...houseItem.sponsored, sponsor: { kind: 'advertiser', name: 'Shop' } },
      }).success,
    ).toBe(false);
  });

  it('skips unknown item types instead of failing', () => {
    const items = parseFeedItems([{ type: 'hologram', id: 'x' }, houseItem, null]);
    expect(items.map((item) => item.type)).toEqual(['sponsored']);
  });

  it('only allows same-origin poster and link URLs', () => {
    const listing = {
      id: '00000000-0000-4000-8000-000000000001',
      title: 'Desk',
      price_cents: 0,
      condition: 'good',
      status: 'available',
      distance_bucket: '1–5 mi',
      area_label: 'Celina',
      posted_at: '2026-10-24T12:00:00Z',
      poster_url: '/art/desk.svg',
      category_slug: 'furniture',
    };
    expect(ListingCard.safeParse(listing).success).toBe(true);
    for (const poster_url of ['https://cdn.example/x.jpg', '//cdn.example/x.jpg', '/\\x.jpg']) {
      expect(ListingCard.safeParse({ ...listing, poster_url }).success, poster_url).toBe(false);
    }
    expect(ListingCard.safeParse({ ...listing, lat: 33.2 }).success).toBe(false);
  });

  it('formats prices, with Free for zero', () => {
    expect(formatPrice(0)).toBe('Free');
    expect(formatPrice(12500)).toBe('$125');
    expect(formatPrice(1999)).toBe('$19.99');
  });
});
