import 'server-only';
import Mux, { NotFoundError } from '@mux/ts';
import { z } from 'zod';
import { serverConfig } from '@/lib/env';
import type { PlaybackSource, VideoProvider } from './provider';

/**
 * The ONLY module that reads Mux credentials (`media-secrets.guard.test.ts`). API tokens create
 * uploads and delete assets; the signing key (separate from the API token) signs playback JWTs.
 * Settings per hucxter-video-pipeline: signed playback only, no master or MP4 downloads (phone
 * videos carry GPS), 1080p cap, basic quality.
 */
const MuxEnv = z.object({
  MUX_TOKEN_ID: z.string().min(1),
  MUX_TOKEN_SECRET: z.string().min(1),
  MUX_WEBHOOK_SECRET: z.string().min(1),
  MUX_SIGNING_KEY_ID: z.string().min(1),
  MUX_SIGNING_PRIVATE_KEY: z.string().min(1),
});

type MuxSecrets = z.infer<typeof MuxEnv>;

function muxSecrets(): MuxSecrets {
  const parsed = MuxEnv.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      'VIDEO_PROVIDER=mux needs MUX_TOKEN_ID, MUX_TOKEN_SECRET, MUX_WEBHOOK_SECRET, MUX_SIGNING_KEY_ID and MUX_SIGNING_PRIVATE_KEY',
    );
  }
  return parsed.data;
}

async function ignoreNotFound(call: Promise<unknown>): Promise<void> {
  try {
    await call;
  } catch (error) {
    if (error instanceof NotFoundError) return;
    throw error;
  }
}

export class MuxVideoProvider implements VideoProvider {
  readonly name = 'mux';
  private secrets: MuxSecrets | undefined;
  private client: Mux | undefined;

  private mux(): { client: Mux; secrets: MuxSecrets } {
    this.secrets ??= muxSecrets();
    // Explicit values: the SDK would otherwise fall back to other MUX_* variable names.
    this.client ??= new Mux({
      tokenId: this.secrets.MUX_TOKEN_ID,
      tokenSecret: this.secrets.MUX_TOKEN_SECRET,
      webhookSecret: null,
      jwtSigningKey: this.secrets.MUX_SIGNING_KEY_ID,
      jwtPrivateKey: this.secrets.MUX_SIGNING_PRIVATE_KEY,
    });
    return { client: this.client, secrets: this.secrets };
  }

  async createUpload(mediaId: string): Promise<{ uploadId: string; url: string }> {
    const upload = await this.mux().client.video.uploads.create({
      cors_origin: serverConfig().appOrigin.origin,
      timeout: 3600,
      new_asset_settings: {
        playback_policies: ['signed'],
        video_quality: 'basic',
        max_resolution_tier: '1080p',
        master_access: 'none',
        passthrough: mediaId,
      },
    });
    if (upload.url === undefined) throw new Error('mux_upload_url_missing');
    return { uploadId: upload.id, url: upload.url };
  }

  async cancelUpload(uploadId: string): Promise<void> {
    await ignoreNotFound(this.mux().client.video.uploads.cancel(uploadId));
  }

  async deleteAsset(assetId: string): Promise<void> {
    await ignoreNotFound(this.mux().client.video.assets.delete(assetId));
  }

  async deletePlaybackId(assetId: string, playbackId: string): Promise<void> {
    await ignoreNotFound(this.mux().client.video.assets.deletePlaybackId(assetId, playbackId));
  }

  async playback(playbackId: string, ttlSeconds: number): Promise<PlaybackSource> {
    const tokens = await this.mux().client.jwt.signPlaybackId(playbackId, {
      type: ['video', 'thumbnail', 'storyboard'],
      expiration: `${String(ttlSeconds)}s`,
    });
    const playback = tokens['playback-token'];
    const thumbnail = tokens['thumbnail-token'];
    const storyboard = tokens['storyboard-token'];
    if (playback === undefined || thumbnail === undefined || storyboard === undefined) {
      throw new Error('mux_token_missing');
    }
    return { kind: 'mux', playbackId, tokens: { playback, thumbnail, storyboard } };
  }

  async posterUrl(playbackId: string, width: number): Promise<string> {
    // Signed thumbnails take their options as token claims, not query parameters.
    const token = await this.mux().client.jwt.signPlaybackId(playbackId, {
      type: 'thumbnail',
      expiration: '600s',
      params: { width: String(width), fit_mode: 'preserve' },
    });
    return `https://image.mux.com/${encodeURIComponent(playbackId)}/thumbnail.webp?token=${encodeURIComponent(token)}`;
  }

  webhookSecret(): string {
    return this.mux().secrets.MUX_WEBHOOK_SECRET;
  }
}
