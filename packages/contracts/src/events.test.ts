import { describe, expect, it } from 'vitest';
import { AnalyticsEvent, CONSENT_VERSION, ServerEvent, envelope } from './events';

describe('analytics events', () => {
  it('wraps events with schema and consent versions', () => {
    const tracked = envelope(
      { name: 'sign_in_started', method: 'google' },
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

describe('discover events (3D)', () => {
  it('accepts the two feed events with no properties', () => {
    expect(ServerEvent.parse({ name: 'discover_viewed' })).toEqual({ name: 'discover_viewed' });
    expect(ServerEvent.parse({ name: 'discover_item_viewed' })).toEqual({
      name: 'discover_item_viewed',
    });
  });

  it('refuses extra properties, so nothing personal can ride along', () => {
    expect(ServerEvent.safeParse({ name: 'discover_viewed', zip: '97205' }).success).toBe(false);
    expect(ServerEvent.safeParse({ name: 'discover_item_viewed', listing_id: 'x' }).success).toBe(
      false,
    );
  });

  it('records sign-in prompts from the feed as the discover surface', () => {
    expect(
      AnalyticsEvent.safeParse({ name: 'sign_in_prompted', action: 'save', surface: 'discover' })
        .success,
    ).toBe(true);
  });
});
