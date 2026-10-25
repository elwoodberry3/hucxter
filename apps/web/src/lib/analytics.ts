import { envelope } from '@hucxter/contracts';
import type { AnalyticsEvent } from '@hucxter/contracts';

/**
 * Records an analytics event. Phase I has no vendor (ADR-0006): events are validated, then logged
 * to the console in development and dropped everywhere else. Safe on server and client.
 */
export function track(event: AnalyticsEvent): void {
  const tracked = envelope(event);
  if (process.env.NODE_ENV === 'development') {
    console.info('[track]', tracked);
  }
}
