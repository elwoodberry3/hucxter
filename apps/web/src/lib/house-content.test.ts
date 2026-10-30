import { FeedItem } from '@hucxter/contracts';
import { describe, expect, it } from 'vitest';
import { HERO_SLIDES, activeSlides, homeFeed } from './house-content';

describe('house content', () => {
  it('has at most 3 hero slides and respects seasonal windows', () => {
    expect(HERO_SLIDES.length).toBeLessThanOrEqual(3);
    expect(activeSlides(new Date('2026-12-01T12:00:00Z')).map((s) => s.id)).toContain(
      'holiday-finds',
    );
    expect(activeSlides(new Date('2027-03-01T12:00:00Z')).map((s) => s.id)).not.toContain(
      'holiday-finds',
    );
  });

  it('home feed is valid envelope items with no listings and only house promos', () => {
    const items = homeFeed();
    for (const item of items) expect(FeedItem.safeParse(item).success).toBe(true);
    expect(items.some((item) => item.type === 'listing')).toBe(false);
    for (const item of items) {
      if (item.type === 'sponsored') expect(item.disclosure).toBe('Promoted by Hucxter');
    }
  });

  it('never claims inventory size in copy', () => {
    const copy = JSON.stringify([HERO_SLIDES, homeFeed()]);
    expect(copy).not.toMatch(/\b(millions?|thousands?|hundreds?)\b|\d+\+?\s*(items|listings)/i);
  });
});
