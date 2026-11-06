import 'server-only';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cookies } from 'next/headers';
import { mediaConfig } from '@/lib/env';
import { rejectCrossOrigin } from '@/server/auth/origin';
import { assertFakeVideoAllowed, fakeEvent, fakeUploadSignatureValid } from './fake';
import type { FakeOutcome } from './fake';
import { handleMuxWebhook } from './webhook';

/**
 * Route logic for /api/dev/fake-video/* (local only; 404 whenever the fake provider isn't the
 * active one). e2e picks an outcome with the `hx_fake_video` cookie: ready (default), slow (stays
 * processing until /ready is called), error, overlong.
 */
export const FAKE_OUTCOME_COOKIE = 'hx_fake_video';
const FAKE_DURATION_SECONDS = 12;
const notFound = () => new Response('Not found', { status: 404 });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function fakeActive(): boolean {
  try {
    assertFakeVideoAllowed();
    return true;
  } catch {
    return false;
  }
}

const received = ((
  globalThis as typeof globalThis & { __hxFakeReceived?: Map<string, number> }
).__hxFakeReceived ??= new Map<string, number>());

async function emit(type: string, mediaId: string, duration?: number): Promise<void> {
  const { rawBody, signature } = fakeEvent(type, mediaId, duration);
  const result = await handleMuxWebhook(rawBody, signature);
  if (result.status !== 200) throw new Error(`fake_webhook_${String(result.status)}`);
}

export async function emitReady(mediaId: string, outcome: FakeOutcome = 'ready'): Promise<void> {
  if (outcome === 'error') return emit('video.asset.errored', mediaId);
  const duration = outcome === 'overlong' ? mediaConfig().maxSeconds + 15 : FAKE_DURATION_SECONDS;
  return emit('video.asset.ready', mediaId, duration);
}

const CONTENT_RANGE = /^bytes (\d+)-(\d+)\/(\d+)$/;

/** PUT, chunked like a GCS resumable upload (UpChunk): 308 until the last chunk, then 200. */
export async function fakeUpload(request: Request, mediaId: string): Promise<Response> {
  if (!fakeActive() || !UUID.test(mediaId)) return notFound();
  const crossOrigin = rejectCrossOrigin(request);
  if (crossOrigin !== null) return crossOrigin;
  if (!fakeUploadSignatureValid(mediaId, new URL(request.url).searchParams.get('sig'))) {
    return new Response('Forbidden', { status: 403 });
  }
  const body = await request.arrayBuffer();
  const range = CONTENT_RANGE.exec(request.headers.get('content-range') ?? '');
  const total = range === null ? body.byteLength : Number(range[3]);
  const end = range === null ? body.byteLength - 1 : Number(range[2]);
  if (total > mediaConfig().maxBytes) return new Response('Too large', { status: 413 });
  received.set(mediaId, (received.get(mediaId) ?? 0) + body.byteLength);
  if (end + 1 < total) return new Response(null, { status: 308 });

  received.delete(mediaId);
  const value = (await cookies()).get(FAKE_OUTCOME_COOKIE)?.value;
  const outcome: FakeOutcome =
    value === 'slow' || value === 'error' || value === 'overlong' ? value : 'ready';
  await emit('video.upload.asset_created', mediaId);
  if (outcome !== 'slow') await emitReady(mediaId, outcome);
  return new Response(null, { status: 200 });
}

/** POST: finish a "slow" upload (e2e for "Publish when ready"). */
export async function fakeReady(request: Request, mediaId: string): Promise<Response> {
  if (!fakeActive() || !UUID.test(mediaId)) return notFound();
  const crossOrigin = rejectCrossOrigin(request);
  if (crossOrigin !== null) return crossOrigin;
  await emitReady(mediaId);
  return new Response(null, { status: 204 });
}

const POSTER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="640" viewBox="0 0 360 640"><rect width="360" height="640" fill="#3a3a3c"/><text x="180" y="330" fill="#d1d1d6" font-family="system-ui,sans-serif" font-size="28" text-anchor="middle">Test video</text></svg>`;

/** GET the local test video (with Range support, which Safari needs) or the poster. */
export async function fakeFile(request: Request, name: string): Promise<Response> {
  if (!fakeActive()) return notFound();
  if (name === 'poster.svg') {
    return new Response(POSTER_SVG, {
      headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-store' },
    });
  }
  if (name !== 'sample.webm') return notFound();
  let file: Buffer;
  try {
    file = await readFile(join(process.cwd(), 'e2e', 'fixtures', 'fake-video', 'sample.webm'));
  } catch {
    return notFound();
  }
  const headers = {
    'Content-Type': 'video/webm',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-store',
  };
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range') ?? '');
  if (range === null) return new Response(new Uint8Array(file), { headers });
  const start = range[1] === '' ? Math.max(0, file.length - Number(range[2])) : Number(range[1]);
  const end =
    range[1] !== '' && range[2] !== ''
      ? Math.min(Number(range[2]), file.length - 1)
      : file.length - 1;
  if (start > end || start >= file.length) {
    return new Response(null, {
      status: 416,
      headers: { 'Content-Range': `bytes */${String(file.length)}` },
    });
  }
  return new Response(new Uint8Array(file.subarray(start, end + 1)), {
    status: 206,
    headers: {
      ...headers,
      'Content-Range': `bytes ${String(start)}-${String(end)}/${String(file.length)}`,
    },
  });
}
