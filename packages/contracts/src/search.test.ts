import { describe, expect, it } from 'vitest';
import {
  activeFilterKeys,
  decodeCursor,
  encodeCursor,
  listingQueryParams,
  parseListingQuery,
} from './search';
import type { AttributeFilter } from './taxonomy';

const filters: AttributeFilter[] = [
  { key: 'brand', label: 'Brand', type: 'text' },
  { key: 'storage_gb', label: 'Storage', type: 'enum', options: [64, 128] },
  { key: 'graded', label: 'Graded', type: 'boolean' },
];

describe('parseListingQuery', () => {
  it('uses defaults for an empty query', () => {
    expect(parseListingQuery({})).toMatchObject({
      posted: 'any',
      status: 'available',
      sort: 'newest',
      conditions: [],
      free: false,
      attributes: {},
    });
  });

  it('parses every filter and round-trips through the URL', () => {
    const raw = {
      q: '  red bike ',
      price_min: '10',
      price_max: '200',
      distance: '25',
      condition: ['good', 'like_new'],
      posted: '7d',
      status: 'include_pending',
      sort: 'price_asc',
      brand: 'Trek',
      storage_gb: '128',
      graded: 'true',
    };
    const query = parseListingQuery(raw, filters);
    expect(query).toMatchObject({
      q: 'red bike',
      priceMin: 10,
      priceMax: 200,
      distanceMi: 25,
      conditions: ['like_new', 'good'],
      posted: '7d',
      status: 'include_pending',
      sort: 'price_asc',
      attributes: { brand: 'Trek', storage_gb: 128, graded: true },
    });
    const again = parseListingQuery(
      Object.fromEntries(
        [...new Set(listingQueryParams(query).keys())].map((key) => [
          key,
          listingQueryParams(query).getAll(key),
        ]),
      ),
      filters,
    );
    expect(again).toEqual(query);
  });

  it('drops invalid and unknown values instead of failing', () => {
    const query = parseListingQuery(
      {
        price_min: '-5',
        price_max: '1e9',
        distance: '500',
        condition: ['mint', 'good'],
        posted: 'forever',
        sort: 'random',
        storage_gb: '100',
        mileage: '20000',
        graded: 'yes',
      },
      filters,
    );
    expect(query.priceMin).toBeUndefined();
    expect(query.priceMax).toBeUndefined();
    expect(query.distanceMi).toBeUndefined();
    expect(query.conditions).toEqual(['good']);
    expect(query.posted).toBe('any');
    expect(query.sort).toBe('newest');
    expect(query.attributes).toEqual({});
  });

  it('swaps an inverted price range and caps the query length', () => {
    const query = parseListingQuery({ price_min: '500', price_max: '50', q: 'x'.repeat(300) });
    expect([query.priceMin, query.priceMax]).toEqual([50, 500]);
    expect(query.q).toHaveLength(100);
  });

  it('lists active filter keys, excluding q and sort', () => {
    const query = parseListingQuery(
      { q: 'desk', sort: 'nearest', free: 'true', brand: 'Ikea' },
      filters,
    );
    expect(activeFilterKeys(query)).toEqual(['free', 'brand']);
  });
});

describe('result cursors', () => {
  it('round-trips and rejects anything malformed', () => {
    const cursor = {
      k: -5000,
      t: '2026-11-01T12:00:00.000Z',
      id: '3f1c2b9a-6d4e-4f7a-9b2c-1e8d7a6b5c4d',
    };
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
    expect(decodeCursor(undefined)).toBeNull();
    expect(decodeCursor('not json')).toBeNull();
    expect(decodeCursor(encodeCursor({ ...cursor, id: 'x' }))).toBeNull();
    expect(decodeCursor('a'.repeat(300))).toBeNull();
  });
});
