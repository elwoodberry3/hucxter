import { describe, expect, it } from 'vitest';
import { AnalyticsEvent, CONSENT_VERSION, envelope } from './events';

describe('analytics events', () => {
  it('wraps events with schema and consent versions', () => {
    const tracked = envelope(
      { name: 'sign_in_started', method: 'tiktok' },
      new Date('2026-10-24T00:00:00Z'),
    );
    expect(tracked).toMatchObject({
      consent_version: CONSENT_VERSION,
      client: 'web',
      occurred_at: '2026-10-24T00:00:00.000Z',
    });
  });

  it('allows ZIP but nothing more precise on location_changed', () => {
    expect(
      AnalyticsEvent.safeParse({ name: 'location_changed', zip: '75009', source: 'zip' }).success,
    ).toBe(true);
    const withCoordinates = AnalyticsEvent.parse({
      name: 'location_changed',
      zip: '75009',
      source: 'browser',
      lat: 33.2,
      lon: -96.6,
    });
    expect(withCoordinates).not.toHaveProperty('lat');
    expect(withCoordinates).not.toHaveProperty('lon');
  });

  it('rejects unknown events', () => {
    expect(AnalyticsEvent.safeParse({ name: 'page_scrolled' }).success).toBe(false);
  });
});
