import 'server-only';
import { adminDb } from '@/server/admin-db';
import type { PlaybackSource } from './provider';
import { videoProvider } from './provider';

/** Playback tokens live 15 minutes past the longest allowed video, then expire. */
const TOKEN_TTL_SECONDS = 20 * 60;

async function playbackId(mediaId: string): Promise<string | null> {
  const result = await adminDb().rpc('media_playback', { p_media_id: mediaId });
  if (result.error !== null) throw new Error(`media_playback:${result.error.code}`);
  const data: unknown = result.data;
  return typeof data === 'string' && data.length > 0 ? data : null;
}

/**
 * Signed playback for a listing's video. Callers must first establish that the viewer may see
 * the listing (listing_public). media_playback returns nothing for media that isn't ready or
 * whose listing is deleted or removed, so removed and errored media never get a token.
 */
export async function playbackSource(mediaId: string): Promise<PlaybackSource | null> {
  const id = await playbackId(mediaId);
  if (id === null) return null;
  return (await videoProvider()).playback(id, TOKEN_TTL_SECONDS);
}

/** A short-lived poster URL for a card, or null (same rules as playback). */
export async function posterUrl(mediaId: string, width: number): Promise<string | null> {
  const id = await playbackId(mediaId);
  if (id === null) return null;
  return (await videoProvider()).posterUrl(id, width);
}
