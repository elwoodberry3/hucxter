import { describe, expect, it } from 'vitest';
import { priceDrop } from './price-drop';
import type { LivePoint, PricePoint } from './price-drop';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-11-06T12:00:00Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY);
const price = (days: number, dollars: number): PricePoint => ({
  at: daysAgo(days),
  priceCents: dollars * 100,
});
const live = (days: number, isLive = true): LivePoint => ({ at: daysAgo(days), live: isLive });

describe('D-45 price-drop rule', () => {
  it('shows the earlier price after 7 live days and a drop within 30 days', () => {
    expect(priceDrop([price(20, 75), price(2, 50)], [live(20)], NOW)).toEqual({
      wasCents: 7500,
      nowCents: 5000,
    });
  });

  it('needs at least 7 consecutive live days at the earlier price', () => {
    const almost = 7 - 1 / 24; // 6 days 23 hours
    expect(priceDrop([price(10, 75), price(10 - almost, 50)], [live(10)], NOW)).toBeNull();
    expect(priceDrop([price(10, 75), price(3, 50)], [live(10)], NOW)).toEqual({
      wasCents: 7500,
      nowCents: 5000,
    });
  });

  it('expires 30 days after the drop', () => {
    expect(priceDrop([price(60, 75), price(31, 50)], [live(60)], NOW)).toBeNull();
    expect(priceDrop([price(60, 75), price(30, 50)], [live(60)], NOW)).not.toBeNull();
  });

  it('a raise shows nothing', () => {
    expect(priceDrop([price(20, 50), price(2, 75)], [live(20)], NOW)).toBeNull();
  });

  it('a raise then a drop compares against the earlier qualifying price', () => {
    // $75 for 10 days, $90 for 2 days (too short), now $50.
    expect(priceDrop([price(14, 75), price(4, 90), price(2, 50)], [live(14)], NOW)).toEqual({
      wasCents: 7500,
      nowCents: 5000,
    });
  });

  it('a drop after a raise from a lower price does not count as a drop to the old price', () => {
    // $75 → $40 → $50: the change to $50 was a raise.
    expect(priceDrop([price(30, 75), price(20, 40), price(2, 50)], [live(30)], NOW)).toBeNull();
  });

  it('a drop to Free shows nothing', () => {
    expect(priceDrop([price(20, 75), price(2, 0)], [live(20)], NOW)).toBeNull();
  });

  it('time as a draft or hidden does not count toward the 7 days', () => {
    // Priced $75 for 20 days but live for only the last 5 of them.
    const statuses = [live(20, false), live(7), live(2, false), live(2)];
    expect(priceDrop([price(20, 75), price(2, 50)], statuses, NOW)).toBeNull();
  });

  it('pauses split the live time: two 4-day stretches are not 7 consecutive days', () => {
    const statuses = [live(10), live(6, false), live(5), live(1, false), live(1)];
    expect(priceDrop([price(10, 75), price(1, 50)], statuses, NOW)).toBeNull();
  });

  it('no history or one price shows nothing', () => {
    expect(priceDrop([], [], NOW)).toBeNull();
    expect(priceDrop([price(10, 50)], [live(10)], NOW)).toBeNull();
  });
});
