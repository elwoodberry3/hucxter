import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls: string[] = [];
const rpc = vi.fn();
const deleteUser = vi.fn();
const insert = vi.fn();
vi.mock('server-only', () => ({}));
vi.mock('../admin-db', () => ({
  adminDb: () => ({
    rpc: (...args: unknown[]) => {
      calls.push(`rpc:${String(args[0])}`);
      return rpc(...args) as unknown;
    },
    auth: {
      admin: {
        deleteUser: (id: string) => {
          calls.push('deleteUser');
          return deleteUser(id) as unknown;
        },
      },
    },
    from: (table: string) => ({
      insert: (row: unknown) => {
        calls.push(`insert:${table}`);
        return insert(row) as unknown;
      },
    }),
  }),
}));
const { deleteAccount } = await import('./delete-account');

const session = {
  auth: {
    signOut: () => {
      calls.push('signOut');
      return Promise.resolve({ error: null });
    },
  },
} as unknown as Parameters<typeof deleteAccount>[1];

describe('deleteAccount (Founder amendment 2)', () => {
  beforeEach(() => {
    calls.length = 0;
    rpc.mockReset().mockResolvedValue({ data: 2, error: null });
    deleteUser.mockReset().mockResolvedValue({ error: null });
    insert.mockReset().mockResolvedValue({ error: null });
  });

  it('prepares (audit + Mux jobs) before signing out everywhere and deleting the user', async () => {
    await expect(deleteAccount('u1', session)).resolves.toEqual({ ok: true });
    expect(calls).toEqual(['rpc:account_delete_prepare', 'signOut', 'deleteUser']);
    expect(rpc).toHaveBeenCalledWith('account_delete_prepare', { p_user_id: 'u1' });
  });

  it('never deletes the user when preparing fails', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'XX000' } });
    await expect(deleteAccount('u1', session)).resolves.toEqual({ ok: false });
    expect(calls).toEqual(['rpc:account_delete_prepare']);
  });

  it('records account.delete_failed when the auth delete fails', async () => {
    deleteUser.mockResolvedValue({ error: { message: 'boom' } });
    await expect(deleteAccount('u1', session)).resolves.toEqual({ ok: false });
    expect(calls.at(-1)).toBe('insert:audit_log');
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'account.delete_failed', target_id: 'u1' }),
    );
  });
});
