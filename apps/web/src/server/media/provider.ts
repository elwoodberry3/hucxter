import 'server-only';
import type { PlayerSource } from '@/components/video/listing-player';
import { mediaConfig } from '@/lib/env';

/** What the listing page's player needs: signed Mux playback, or a local file (fake provider). */
export type PlaybackSource = PlayerSource;

/**
 * The video seam (Brief 03C.1 §3.3, hucxter-video-pipeline). Mux in qa and production; the fake
 * (local only, refused elsewhere by mediaConfig) for development and e2e. Both deliver state
 * changes through the same signed webhook handler.
 */
export interface VideoProvider {
  readonly name: 'mux' | 'fake';
  /** A direct-upload URL for one media row; the media id travels as the passthrough. */
  createUpload(mediaId: string): Promise<{ uploadId: string; url: string }>;
  cancelUpload(uploadId: string): Promise<void>;
  /** Deletes the asset; an asset that is already gone counts as deleted. */
  deleteAsset(assetId: string): Promise<void>;
  /** Revokes one playback id (takedown); already gone counts as revoked. */
  deletePlaybackId(assetId: string, playbackId: string): Promise<void>;
  playback(playbackId: string, ttlSeconds: number): Promise<PlaybackSource>;
  /** A short-lived poster URL for cards (the browser is redirected to it). */
  posterUrl(playbackId: string, width: number): Promise<string>;
  webhookSecret(): string;
}

let cached: VideoProvider | undefined;

export async function videoProvider(): Promise<VideoProvider> {
  if (cached === undefined) {
    const { provider } = mediaConfig();
    cached =
      provider === 'mux'
        ? new (await import('./mux')).MuxVideoProvider()
        : new (await import('./fake')).FakeVideoProvider();
  }
  return cached;
}
