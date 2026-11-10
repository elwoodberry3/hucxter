import 'server-only';
import { CONSENT_VERSION, EVENT_SCHEMA_VERSION, ServerEvent } from '@hucxter/contracts';
import { adminDb, dailyActorHash } from './admin-db';
import { codeOf, logError } from './log';

/**
 * First-party event log (Brief 03C.1 §3.6, hucxter-event-taxonomy): validated against the
 * contracts union, written server-side to `events` with no PII. The actor is a daily-salted hash
 * (member id, or the guest's per-day hx_vid), never an id. Failures are logged and swallowed:
 * analytics must never break a user action.
 */
export async function recordEvent(
  event: ServerEvent,
  context: { listingId?: string | null; actor?: string | null; viewerId?: string | null } = {},
): Promise<void> {
  const { name, ...props } = ServerEvent.parse(event);
  const actor = context.actor ?? context.viewerId ?? null;
  try {
    const { error, status } = await adminDb().rpc('events_insert', {
      p_name: name,
      p_listing_id: context.listingId ?? null,
      p_actor_hash: actor === null ? null : dailyActorHash(actor),
      p_viewer_id: context.viewerId ?? null,
      p_props: props,
      p_schema_version: EVENT_SCHEMA_VERSION,
      p_consent_version: CONSENT_VERSION,
    });
    if (error !== null) logError(`event_insert_failed.${name}`, { status, code: error.code });
  } catch (thrown) {
    logError(`event_insert_failed.${name}`, { code: codeOf(thrown) });
  }
}
