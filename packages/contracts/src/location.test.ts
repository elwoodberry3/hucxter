import { describe, expect, it } from 'vitest';
import {
  Coordinates,
  LocationPreference,
  MAX_RADIUS_M,
  RadiusMi,
  Zip,
  radiusMeters,
} from './location';

describe('location contracts', () => {
  it('accepts 5-digit ZIPs only', () => {
    expect(Zip.safeParse('75009').success).toBe(true);
    for (const bad of ['7500', '750091', '75009-1234', 'abcde', ' 75009']) {
      expect(Zip.safeParse(bad).success, bad).toBe(false);
    }
  });

  it('allows only the radius options, capped at 100 mi', () => {
    expect(RadiusMi.safeParse(25).success).toBe(true);
    expect(RadiusMi.safeParse(101).success).toBe(false);
    expect(RadiusMi.safeParse(0).success).toBe(false);
    expect(radiusMeters(100)).toBe(MAX_RADIUS_M);
  });

  it('stores only ZIP and radius', () => {
    expect(LocationPreference.safeParse({ zip: '75009', radiusMi: 10, lat: 33 }).success).toBe(
      false,
    );
  });

  it('validates coordinate ranges', () => {
    expect(Coordinates.safeParse({ lat: 91, lon: 0 }).success).toBe(false);
    expect(Coordinates.safeParse({ lat: 33.2, lon: -96.6 }).success).toBe(true);
  });
});
