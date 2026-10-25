import { z } from 'zod';
import { Zip } from './location';

/**
 * Analytics events (hucxter-event-taxonomy). Names are object_action. Properties never include
 * precise coordinates, IP-derived data beyond ZIP, phone numbers, or message text.
 */
export const EVENT_SCHEMA_VERSION = 1;

/** No consent UI exists yet; every event records that it predates consent capture. */
export const CONSENT_VERSION = 'pre-consent-0';

export const SignInMethod = z.enum(['email', 'facebook', 'tiktok']);
export type SignInMethod = z.infer<typeof SignInMethod>;

/** The action a guest tried that needs an account. */
export const GatedAction = z.enum([
  'sell',
  'message',
  'availability',
  'save',
  'share_list',
  'report',
  'follow',
  'messages',
  'saved',
  'listings',
  'profile',
  'settings',
]);
export type GatedAction = z.infer<typeof GatedAction>;

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
const surface = z.enum(['home', 'category', 'search', 'listing', 'header', 'footer', 'sign_in']);

export const AnalyticsEvent = z.discriminatedUnion('name', [
  z.object({ name: z.literal('category_viewed'), department: slug, subcategory: slug.optional() }),
  z.object({ name: z.literal('mega_menu_opened'), via: z.enum(['click', 'hover', 'keyboard']) }),
  z.object({ name: z.literal('hero_clicked'), slide: z.string().max(40) }),
  // ZIP only: never coordinates or the IP-derived guess.
  z.object({ name: z.literal('location_changed'), zip: Zip, source: z.enum(['zip', 'browser']) }),
  z.object({
    name: z.literal('filter_applied'),
    surface,
    keys: z.array(z.string().max(40)).max(30),
  }),
  z.object({ name: z.literal('sign_in_prompted'), action: GatedAction, surface }),
  z.object({ name: z.literal('sign_in_started'), method: SignInMethod }),
]);
export type AnalyticsEvent = z.infer<typeof AnalyticsEvent>;

/** What a sink receives: the event plus the envelope every event carries. */
export interface TrackedEvent {
  event: AnalyticsEvent;
  schema_version: number;
  consent_version: string;
  client: 'web';
  occurred_at: string;
}

export function envelope(event: AnalyticsEvent, now: Date = new Date()): TrackedEvent {
  return {
    event: AnalyticsEvent.parse(event),
    schema_version: EVENT_SCHEMA_VERSION,
    consent_version: CONSENT_VERSION,
    client: 'web',
    occurred_at: now.toISOString(),
  };
}
