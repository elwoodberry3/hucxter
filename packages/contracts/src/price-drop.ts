/**
 * D-45 price-drop rule (Brief 03C.1 §3.4). A struck-through earlier price shows only when:
 *   1. the current price C is above $0 (Free never shows a strike),
 *   2. the change to C was itself a decrease and happened within the last 30 days, and
 *   3. an earlier price P > C was live on Hucxter for at least 7 consecutive days.
 * When several earlier prices qualify, P is the most recent one. Never an MSRP or "compare at".
 */
export interface PricePoint {
  at: Date;
  priceCents: number;
}

export interface LivePoint {
  at: Date;
  live: boolean;
}

export interface PriceDrop {
  wasCents: number;
  nowCents: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
export const PRICE_DROP_MIN_LIVE_DAYS = 7;
export const PRICE_DROP_WINDOW_DAYS = 30;

/** Merged live intervals [start, end) from status changes. */
function liveIntervals(statuses: readonly LivePoint[], now: Date): [number, number][] {
  const sorted = [...statuses].sort((a, b) => a.at.getTime() - b.at.getTime());
  const intervals: [number, number][] = [];
  let start: number | null = null;
  for (const point of sorted) {
    const t = point.at.getTime();
    if (point.live && start === null) start = t;
    if (!point.live && start !== null) {
      intervals.push([start, t]);
      start = null;
    }
  }
  if (start !== null) intervals.push([start, now.getTime()]);
  return intervals;
}

/** Longest single stretch the listing was live during [from, to). */
function longestLive(intervals: readonly [number, number][], from: number, to: number): number {
  let best = 0;
  for (const [start, end] of intervals) {
    const overlap = Math.min(end, to) - Math.max(start, from);
    if (overlap > best) best = overlap;
  }
  return best;
}

export function priceDrop(
  prices: readonly PricePoint[],
  statuses: readonly LivePoint[],
  now: Date = new Date(),
): PriceDrop | null {
  const sorted = [...prices].sort((a, b) => a.at.getTime() - b.at.getTime());
  const current = sorted.at(-1);
  const previous = sorted.at(-2);
  if (current === undefined || previous === undefined) return null;
  if (current.priceCents <= 0) return null;
  if (previous.priceCents <= current.priceCents) return null;
  if (now.getTime() - current.at.getTime() > PRICE_DROP_WINDOW_DAYS * DAY_MS) return null;

  const intervals = liveIntervals(statuses, now);
  for (let i = sorted.length - 2; i >= 0; i -= 1) {
    const segment = sorted[i];
    const next = sorted[i + 1];
    if (segment === undefined || next === undefined) continue;
    if (segment.priceCents <= current.priceCents) continue;
    const live = longestLive(intervals, segment.at.getTime(), next.at.getTime());
    if (live >= PRICE_DROP_MIN_LIVE_DAYS * DAY_MS) {
      return { wasCents: segment.priceCents, nowCents: current.priceCents };
    }
  }
  return null;
}
