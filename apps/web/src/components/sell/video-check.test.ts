import { describe, expect, it } from 'vitest';
import { checkVideo, videoTypeOf } from './video-check';

const limits = { maxBytes: 524_288_000, maxSeconds: 60 };

describe('sell video checks', () => {
  it('accepts MP4, MOV and WebM, by type or by extension when the type is empty', () => {
    expect(videoTypeOf({ type: 'video/mp4', name: 'a.mp4' })).toBe('video/mp4');
    expect(videoTypeOf({ type: '', name: 'IMG_0001.MOV' })).toBe('video/quicktime');
    expect(videoTypeOf({ type: 'video/webm', name: 'clip' })).toBe('video/webm');
    expect(videoTypeOf({ type: 'video/x-msvideo', name: 'a.avi' })).toBeNull();
    expect(videoTypeOf({ type: 'image/png', name: 'a.mp4' })).toBeNull();
  });

  it('explains type, size and duration problems in plain language', () => {
    expect(checkVideo({ type: 'image/gif', name: 'a.gif', size: 10 }, null, limits)).toMatchObject({
      ok: false,
      reason: 'wrong_type',
    });
    expect(
      checkVideo({ type: 'video/mp4', name: 'a.mp4', size: 600 * 1_048_576 }, 10, limits),
    ).toMatchObject({
      ok: false,
      reason: 'too_large',
      message: 'That video is 600 MB. Videos can be up to 500 MB.',
    });
    expect(checkVideo({ type: 'video/mp4', name: 'a.mp4', size: 1000 }, 75, limits)).toMatchObject({
      ok: false,
      reason: 'too_long',
      message: 'That video is 75 seconds. Keep it to 60 seconds or less.',
    });
  });

  it('passes a good video, and one whose duration this browser can’t read', () => {
    expect(checkVideo({ type: 'video/mp4', name: 'a.mp4', size: 1000 }, 60.2, limits)).toEqual({
      ok: true,
      type: 'video/mp4',
    });
    expect(checkVideo({ type: '', name: 'a.mov', size: 1000 }, null, limits)).toEqual({
      ok: true,
      type: 'video/quicktime',
    });
  });
});
