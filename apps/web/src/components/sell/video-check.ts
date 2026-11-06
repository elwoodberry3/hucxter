import { VIDEO_TYPES } from '@hucxter/contracts';
import type { UploadFailureReason } from '@hucxter/contracts';

export type VideoType = (typeof VIDEO_TYPES)[number];

const BY_EXTENSION: Record<string, VideoType> = {
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
};

/** The file's video type; some browsers leave `type` empty for .mov, so the extension decides. */
export function videoTypeOf(file: { type: string; name: string }): VideoType | null {
  if ((VIDEO_TYPES as readonly string[]).includes(file.type)) return file.type as VideoType;
  if (file.type !== '' && file.type !== 'application/octet-stream') return null;
  const extension = /\.([a-z0-9]+)$/i.exec(file.name)?.[1]?.toLowerCase();
  return extension === undefined ? null : (BY_EXTENSION[extension] ?? null);
}

export type VideoCheck =
  { ok: true; type: VideoType } | { ok: false; reason: UploadFailureReason; message: string };

function sizeLabel(bytes: number): string {
  return bytes >= 1_000_000_000
    ? `${(bytes / 1_073_741_824).toFixed(1)} GB`
    : `${String(Math.round(bytes / 1_048_576))} MB`;
}

/** Client-side checks with plain-language errors; the server and the ready webhook re-check. */
export function checkVideo(
  file: { type: string; name: string; size: number },
  durationSeconds: number | null,
  limits: { maxBytes: number; maxSeconds: number },
): VideoCheck {
  const type = videoTypeOf(file);
  if (type === null) {
    return { ok: false, reason: 'wrong_type', message: 'Choose an MP4, MOV or WebM video.' };
  }
  if (file.size > limits.maxBytes) {
    return {
      ok: false,
      reason: 'too_large',
      message: `That video is ${sizeLabel(file.size)}. Videos can be up to ${sizeLabel(limits.maxBytes)}.`,
    };
  }
  if (durationSeconds !== null && durationSeconds > limits.maxSeconds + 0.5) {
    return {
      ok: false,
      reason: 'too_long',
      message: `That video is ${String(Math.round(durationSeconds))} seconds. Keep it to ${String(limits.maxSeconds)} seconds or less.`,
    };
  }
  return { ok: true, type };
}

/** Reads the duration from metadata; null when this browser can't decode the format. */
export function readDuration(file: File, timeoutMs = 8000): Promise<number | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    const done = (value: number | null) => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      video.removeAttribute('src');
      resolve(value);
    };
    const timer = setTimeout(() => {
      done(null);
    }, timeoutMs);
    video.preload = 'metadata';
    video.muted = true;
    video.onloadedmetadata = () => {
      done(Number.isFinite(video.duration) ? video.duration : null);
    };
    video.onerror = () => {
      done(null);
    };
    video.src = url;
  });
}
