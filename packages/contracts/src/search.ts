import { ListingCondition } from './feed';
import { RADIUS_OPTIONS_MI } from './location';
import type { RadiusMi } from './location';
import type { AttributeFilter } from './taxonomy';

/** Common filters on every category and search page (category-taxonomy.md). */
export const POSTED_OPTIONS = ['24h', '7d', '30d', 'any'] as const;
export const STATUS_OPTIONS = ['available', 'include_pending'] as const;
export const SORT_OPTIONS = ['newest', 'nearest', 'price_asc', 'price_desc'] as const;

export const SORT_LABELS: Record<(typeof SORT_OPTIONS)[number], string> = {
  newest: 'Newest',
  nearest: 'Nearest',
  price_asc: 'Price: low to high',
  price_desc: 'Price: high to low',
};

export const POSTED_LABELS: Record<(typeof POSTED_OPTIONS)[number], string> = {
  '24h': 'Last 24 hours',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  any: 'Any time',
};

export interface ListingQuery {
  q: string | undefined;
  priceMin: number | undefined;
  priceMax: number | undefined;
  free: boolean;
  distanceMi: RadiusMi | undefined;
  conditions: ListingCondition[];
  posted: (typeof POSTED_OPTIONS)[number];
  status: (typeof STATUS_OPTIONS)[number];
  sort: (typeof SORT_OPTIONS)[number];
  /** Category-specific filters, keyed by filter key; only keys defined for the category. */
  attributes: Record<string, string | number | boolean>;
}

export type RawSearchParams = Record<string, string | string[] | undefined>;

const MAX_DOLLARS = 1_000_000;

function first(value: string | string[] | undefined): string | undefined {
  const single = Array.isArray(value) ? value[0] : value;
  const trimmed = single?.trim();
  return trimmed === undefined || trimmed === '' ? undefined : trimmed;
}

function all(value: string | string[] | undefined): string[] {
  return (Array.isArray(value) ? value : value === undefined ? [] : [value]).slice(0, 20);
}

function dollars(value: string | undefined): number | undefined {
  if (value === undefined || !/^\d{1,7}$/.test(value)) return undefined;
  const parsed = Number(value);
  return parsed <= MAX_DOLLARS ? parsed : undefined;
}

function oneOf<T extends string>(options: readonly T[], value: string | undefined, fallback: T): T {
  return options.find((option) => option === value) ?? fallback;
}

/**
 * Parses filter state from the URL. Lenient by design: anything invalid or unknown is dropped so
 * shared links always render. Only attribute keys defined for the category are kept.
 */
export function parseListingQuery(
  raw: RawSearchParams,
  filters: readonly AttributeFilter[] = [],
): ListingQuery {
  const q = first(raw.q)?.slice(0, 100);
  let priceMin = dollars(first(raw.price_min));
  let priceMax = dollars(first(raw.price_max));
  if (priceMin !== undefined && priceMax !== undefined && priceMin > priceMax) {
    [priceMin, priceMax] = [priceMax, priceMin];
  }
  const distance = Number(first(raw.distance));
  const conditions = ListingCondition.options.filter((option) =>
    all(raw.condition).includes(option),
  );

  const attributes: ListingQuery['attributes'] = {};
  for (const filter of filters) {
    const value = first(raw[filter.key]);
    if (value === undefined) continue;
    if (filter.type === 'text') {
      attributes[filter.key] = value.slice(0, 80);
    } else if (filter.type === 'boolean') {
      if (value === 'true') attributes[filter.key] = true;
    } else {
      const match = filter.options.find((option) => String(option) === value);
      if (match !== undefined) attributes[filter.key] = match;
    }
  }

  return {
    q,
    priceMin,
    priceMax,
    free: first(raw.free) === 'true',
    distanceMi: RADIUS_OPTIONS_MI.find((option) => option === distance),
    conditions,
    posted: oneOf(POSTED_OPTIONS, first(raw.posted), 'any'),
    status: oneOf(STATUS_OPTIONS, first(raw.status), 'available'),
    sort: oneOf(SORT_OPTIONS, first(raw.sort), 'newest'),
    attributes,
  };
}

/** Serializes a query back to URL params, omitting defaults, in a stable order. */
export function listingQueryParams(query: ListingQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.q !== undefined) params.set('q', query.q);
  if (query.priceMin !== undefined) params.set('price_min', String(query.priceMin));
  if (query.priceMax !== undefined) params.set('price_max', String(query.priceMax));
  if (query.free) params.set('free', 'true');
  if (query.distanceMi !== undefined) params.set('distance', String(query.distanceMi));
  for (const condition of query.conditions) params.append('condition', condition);
  if (query.posted !== 'any') params.set('posted', query.posted);
  if (query.status !== 'available') params.set('status', query.status);
  if (query.sort !== 'newest') params.set('sort', query.sort);
  for (const key of Object.keys(query.attributes).sort()) {
    params.set(key, String(query.attributes[key]));
  }
  return params;
}

/** Names of the filters that differ from defaults (for analytics and "Clear all"). */
export function activeFilterKeys(query: ListingQuery): string[] {
  return [...new Set(listingQueryParams(query).keys())].filter(
    (key) => key !== 'q' && key !== 'sort',
  );
}
