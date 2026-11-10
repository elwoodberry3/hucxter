import 'server-only';
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { mediaConfig, serverConfig } from '@/lib/env';
import type { PlaybackSource, VideoProvider } from './provider';
import { signWebhook } from './webhook-signature';

/**
 * Local-only stand-in for Mux (Brief 03C.1 §3.3): uploads go to /api/dev/fake-video/upload/<id>,
 * which stores nothing and then feeds signed Mux-shaped events through the real webhook handler.
 * Refused unless the resolved APP_ENV is local (mediaConfig and this constructor both check).
 * The webhook secret is random per server process, so no fixed secret exists in the code.
 */
const state = globalThis as typeof globalThis & { __hxFakeVideoSecret?: string };

function fakeSecret(): string {
  state.__hxFakeVideoSecret ??= randomBytes(32).toString('hex');
  return state.__hxFakeVideoSecret;
}

export function assertFakeVideoAllowed(): void {
  if (mediaConfig().provider !== 'fake') throw new Error('fake video provider is not active');
}

/** Upload URLs carry an HMAC of the media id, so one can't be guessed for someone else's draft. */
export function fakeUploadSignature(mediaId: string): string {
  return createHmac('sha256', fakeSecret()).update(`upload:${mediaId}`).digest('hex');
}

export function fakeUploadSignatureValid(mediaId: string, sig: string | null): boolean {
  if (sig === null || !/^[0-9a-f]{64}$/.test(sig)) return false;
  return timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(fakeUploadSignature(mediaId), 'hex'));
}

/**
 * The "slow" outcome's ready URL carries an HMAC of the media id too (Brief 03C.1b H6), so only
 * the uploader (it comes back on the last upload chunk as Hx-Fake-Ready) can finish processing.
 */
export function fakeReadySignature(mediaId: string): string {
  return createHmac('sha256', fakeSecret()).update(`ready:${mediaId}`).digest('hex');
}

export function fakeReadySignatureValid(mediaId: string, sig: string | null): boolean {
  if (sig === null || !/^[0-9a-f]{64}$/.test(sig)) return false;
  return timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(fakeReadySignature(mediaId), 'hex'));
}

export const FAKE_IDS = {
  upload: (mediaId: string) => `fake-upload-${mediaId}`,
  asset: (mediaId: string) => `fake-asset-${mediaId}`,
  playback: (mediaId: string) => `fake-playback-${mediaId}`,
};

export type FakeOutcome = 'ready' | 'slow' | 'error' | 'overlong';

/** A Mux-shaped, signed event, as the webhook route would receive it. */
export function fakeEvent(
  type: string,
  mediaId: string,
  durationSeconds?: number,
): { rawBody: string; signature: string } {
  const data: Record<string, unknown> = type.startsWith('video.upload.')
    ? {
        id: FAKE_IDS.upload(mediaId),
        asset_id: FAKE_IDS.asset(mediaId),
        new_asset_settings: { passthrough: mediaId },
      }
    : {
        id: FAKE_IDS.asset(mediaId),
        upload_id: FAKE_IDS.upload(mediaId),
        passthrough: mediaId,
        duration: durationSeconds ?? null,
        playback_ids: [{ id: FAKE_IDS.playback(mediaId), policy: 'signed' }],
      };
  const rawBody = JSON.stringify({ id: randomUUID(), type, data });
  return { rawBody, signature: signWebhook(rawBody, fakeSecret()) };
}

export class FakeVideoProvider implements VideoProvider {
  readonly name = 'fake';

  constructor() {
    assertFakeVideoAllowed();
  }

  createUpload(mediaId: string): Promise<{ uploadId: string; url: string }> {
    const url = new URL(`/api/dev/fake-video/upload/${mediaId}`, serverConfig().appOrigin);
    url.searchParams.set('sig', fakeUploadSignature(mediaId));
    return Promise.resolve({ uploadId: FAKE_IDS.upload(mediaId), url: url.toString() });
  }

  cancelUpload(): Promise<void> {
    return Promise.resolve();
  }

  deleteAsset(): Promise<void> {
    return Promise.resolve();
  }

  deletePlaybackId(): Promise<void> {
    return Promise.resolve();
  }

  playback(): Promise<PlaybackSource> {
    return Promise.resolve({
      kind: 'file',
      // The .mp4 extension is how Mux Player infers video/mp4 for a plain file source.
      src: '/api/dev/fake-video/file/sample.mp4',
      poster: '/api/dev/fake-video/file/poster.svg',
    });
  }

  posterUrl(): Promise<string> {
    return Promise.resolve('/api/dev/fake-video/file/poster.svg');
  }

  webhookSecret(): string {
    return fakeSecret();
  }
}
