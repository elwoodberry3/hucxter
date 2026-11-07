import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();
vi.mock('./admin-db', () => ({
  adminDb: () => ({ rpc }),
  dailyActorHash: (subject: string) => `h:${subject}`,
}));
const { recordEvent } = await import('./events');

describe('recordEvent', () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockResolvedValue({ error: null });
  });

  it('writes the validated props and a hashed actor, never the raw id', async () => {
    await recordEvent(
      {
        name: 'listing_published',
        department: 'home',
        category: 'furniture',
        free: false,
        outcome: 'published',
      },
      { listingId: 'l1', actor: 'user-1' },
    );
    expect(rpc).toHaveBeenCalledWith(
      'events_insert',
      expect.objectContaining({
        p_name: 'listing_published',
        p_listing_id: 'l1',
        p_actor_hash: 'h:user-1',
        p_props: { department: 'home', category: 'furniture', free: false, outcome: 'published' },
      }),
    );
  });

  it('rejects events outside the contract (no free-form props)', async () => {
    await expect(recordEvent({ name: 'upload_failed', reason: 'boom' } as never)).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('never throws on a database error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    rpc.mockResolvedValue({ error: { code: '500' } });
    await expect(recordEvent({ name: 'sell_started' }, { actor: 'u' })).resolves.toBeUndefined();
  });
});
