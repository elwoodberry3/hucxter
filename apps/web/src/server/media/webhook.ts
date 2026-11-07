import 'server-only';
import { z } from 'zod';
import { mediaConfig } from '@/lib/env';
import { adminDb } from '@/server/admin-db';
import { videoProvider } from './provider';
import { verifyWebhook } from './webhook-signature';

/**
 * Mux webhook handling (hucxter-video-pipeline): verify the signature on the raw body before
 * parsing, then apply the event in one database transaction (media_apply_webhook: event-id
 * dedupe, legal transitions only, duration re-check, "Publish when ready"). Mux retries for 24 h
 * and may deliver duplicates or out of order; both are safe.
 */
export const MAX_WEBHOOK_BYTES = 64 * 1024;

const Event = z.object({
  id: z.string().min(1).max(200),
  type: z.string().min(1).max(100),
  data: z.record(z.string(), z.unknown()),
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const str = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 && value.length <= 200 ? value : null;

export interface WebhookArgs {
  p_event_id: string;
  p_type: string;
  p_media_id: string | null;
  p_upload_id: string | null;
  p_asset_id: string | null;
  p_playback_id: string | null;
  p_duration_s: number | null;
  p_max_seconds: number;
}

/** Maps a verified Mux event to media_apply_webhook arguments (pure; unit-tested). */
export function webhookArgs(event: z.infer<typeof Event>, maxSeconds: number): WebhookArgs {
  const { data } = event;
  let type = event.type;
  let mediaId: unknown;
  let uploadId: string | null;
  let assetId: string | null;
  let playbackId: string | null = null;
  let duration: number | null = null;
  if (type.startsWith('video.upload.')) {
    uploadId = str(data.id);
    assetId = str(data.asset_id);
    const settings = data.new_asset_settings;
    mediaId =
      typeof settings === 'object' && settings !== null
        ? (settings as Record<string, unknown>).passthrough
        : undefined;
  } else {
    assetId = str(data.id);
    uploadId = str(data.upload_id);
    mediaId = data.passthrough;
    if (typeof data.duration === 'number' && Number.isFinite(data.duration)) {
      duration = data.duration;
    }
    const ids = Array.isArray(data.playback_ids) ? (data.playback_ids as unknown[]) : [];
    for (const entry of ids) {
      if (typeof entry !== 'object' || entry === null) continue;
      const { id, policy } = entry as Record<string, unknown>;
      if (policy === 'signed' && str(id) !== null) playbackId = str(id);
    }
    // We only create signed assets; a ready asset without a signed playback id is never shown.
    if (type === 'video.asset.ready' && playbackId === null) type = 'video.asset.errored';
  }
  return {
    p_event_id: event.id,
    p_type: type,
    p_media_id: typeof mediaId === 'string' && UUID.test(mediaId) ? mediaId : null,
    p_upload_id: uploadId,
    p_asset_id: assetId,
    p_playback_id: playbackId,
    p_duration_s: duration,
    p_max_seconds: maxSeconds,
  };
}

export type WebhookResult =
  { status: 200; outcome: string } | { status: 400 | 401 | 413 | 500; outcome: string };

export async function handleMuxWebhook(
  rawBody: string,
  signatureHeader: string | null,
): Promise<WebhookResult> {
  if (rawBody.length > MAX_WEBHOOK_BYTES) return { status: 413, outcome: 'too_large' };
  const provider = await videoProvider();
  if (!verifyWebhook(rawBody, signatureHeader, provider.webhookSecret())) {
    return { status: 401, outcome: 'bad_signature' };
  }
  let event: z.infer<typeof Event>;
  try {
    event = Event.parse(JSON.parse(rawBody));
  } catch {
    return { status: 400, outcome: 'bad_body' };
  }
  const result = await adminDb().rpc(
    'media_apply_webhook',
    webhookArgs(event, mediaConfig().maxSeconds),
  );
  const { error } = result;
  const data: unknown = result.data;
  if (error !== null) {
    console.error(
      JSON.stringify({ event: 'mux_webhook_failed', type: event.type, code: error.code }),
    );
    return { status: 500, outcome: 'db_error' };
  }
  return { status: 200, outcome: typeof data === 'string' ? data : 'ok' };
}
