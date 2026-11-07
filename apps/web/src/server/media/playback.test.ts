import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();
const playback = vi.fn();
vi.mock('@/server/admin-db', () => ({ adminDb: () => ({ rpc }) }));
vi.mock('./provider', () => ({
  videoProvider: () => Promise.resolve({ playback, posterUrl: () => Promise.resolve('poster') }),
}));
const { playbackSource, posterUrl } = await import('./playback');

describe('playback tokens', () => {
  beforeEach(() => {
    rpc.mockReset();
    playback.mockReset();
  });

  it('signs only when media_playback returns a playback id (ready, listing visible)', async () => {
    rpc.mockResolvedValue({ data: 'pb1', error: null });
    playback.mockResolvedValue({ kind: 'mux', playbackId: 'pb1', tokens: {} });
    await expect(playbackSource('m1')).resolves.toMatchObject({ playbackId: 'pb1' });
    expect(rpc).toHaveBeenCalledWith('media_playback', { p_media_id: 'm1' });
  });

  it('returns no token for removed or errored media (no playback id)', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await expect(playbackSource('m1')).resolves.toBeNull();
    await expect(posterUrl('m1', 480)).resolves.toBeNull();
    expect(playback).not.toHaveBeenCalled();
  });
});
