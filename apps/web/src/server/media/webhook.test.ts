import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signWebhook } from './webhook-signature';

const rpc = vi.fn();
vi.mock('@/server/admin-db', () => ({ adminDb: () => ({ rpc }) }));
vi.mock('./provider', () => ({
  videoProvider: () => Promise.resolve({ webhookSecret: () => 'whsec' }),
}));

const { handleMuxWebhook, MAX_WEBHOOK_BYTES, webhookArgs } = await import('./webhook');

const MEDIA = '3f1c2b9a-6d4e-4f7a-9b2c-1e8d7a6b5c4d';

describe('webhookArgs', () => {
  it('maps an upload event: upload id, asset id, passthrough media id', () => {
    expect(
      webhookArgs(
        {
          id: 'e1',
          type: 'video.upload.asset_created',
          data: { id: 'up1', asset_id: 'as1', new_asset_settings: { passthrough: MEDIA } },
        },
        60,
      ),
    ).toMatchObject({
      p_type: 'video.upload.asset_created',
      p_media_id: MEDIA,
      p_upload_id: 'up1',
      p_asset_id: 'as1',
      p_playback_id: null,
    });
  });

  it('maps a ready asset: signed playback id only, and the duration', () => {
    expect(
      webhookArgs(
        {
          id: 'e2',
          type: 'video.asset.ready',
          data: {
            id: 'as1',
            upload_id: 'up1',
            passthrough: MEDIA,
            duration: 12.5,
            playback_ids: [
              { id: 'pub', policy: 'public' },
              { id: 'sig', policy: 'signed' },
            ],
          },
        },
        60,
      ),
    ).toMatchObject({
      p_type: 'video.asset.ready',
      p_asset_id: 'as1',
      p_playback_id: 'sig',
      p_duration_s: 12.5,
      p_max_seconds: 60,
    });
  });

  it('treats a ready asset without a signed playback id as errored', () => {
    expect(
      webhookArgs(
        {
          id: 'e3',
          type: 'video.asset.ready',
          data: { id: 'as1', passthrough: MEDIA, playback_ids: [{ id: 'pub', policy: 'public' }] },
        },
        60,
      ).p_type,
    ).toBe('video.asset.errored');
  });

  it('ignores a passthrough that is not a media id', () => {
    expect(
      webhookArgs({ id: 'e4', type: 'video.asset.ready', data: { passthrough: "x' or 1=1" } }, 60)
        .p_media_id,
    ).toBeNull();
  });
});

describe('handleMuxWebhook', () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  const body = JSON.stringify({
    id: 'evt_1',
    type: 'video.asset.ready',
    data: { id: 'as1', passthrough: MEDIA },
  });

  it('rejects a bad signature before parsing or touching the database', async () => {
    await expect(handleMuxWebhook(body, signWebhook(body, 'wrong'))).resolves.toEqual({
      status: 401,
      outcome: 'bad_signature',
    });
    await expect(handleMuxWebhook(body, null)).resolves.toMatchObject({ status: 401 });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('rejects oversized bodies and invalid JSON', async () => {
    const big = 'x'.repeat(MAX_WEBHOOK_BYTES + 1);
    await expect(handleMuxWebhook(big, signWebhook(big, 'whsec'))).resolves.toMatchObject({
      status: 413,
    });
    await expect(handleMuxWebhook('nope', signWebhook('nope', 'whsec'))).resolves.toMatchObject({
      status: 400,
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('applies a verified event, and a replay is a harmless duplicate', async () => {
    rpc
      .mockResolvedValueOnce({ data: 'ready', error: null })
      .mockResolvedValueOnce({ data: 'duplicate', error: null });
    await expect(handleMuxWebhook(body, signWebhook(body, 'whsec'))).resolves.toEqual({
      status: 200,
      outcome: 'ready',
    });
    await expect(handleMuxWebhook(body, signWebhook(body, 'whsec'))).resolves.toEqual({
      status: 200,
      outcome: 'duplicate',
    });
    expect(rpc).toHaveBeenCalledWith(
      'media_apply_webhook',
      expect.objectContaining({ p_event_id: 'evt_1', p_media_id: MEDIA }),
    );
  });

  it('returns 500 on a database error so Mux retries', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '40001' } });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(handleMuxWebhook(body, signWebhook(body, 'whsec'))).resolves.toMatchObject({
      status: 500,
    });
  });
});
