import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const rpc = vi.fn();
const remove = vi.fn();
vi.mock('@/server/admin-db', () => ({
  adminDb: () => ({ rpc, storage: { from: () => ({ remove }) } }),
}));
vi.mock('@/server/media/playback', () => ({ posterUrl: vi.fn() }));
vi.mock('@/lib/avatar', () => ({ avatarUrl: () => null }));
vi.spyOn(console, 'error').mockImplementation(() => undefined);
const { moderateProfile } = await import('./queue');

const STAFF = '7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const REPORT = '1b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d5e';
const PHOTO = '3f1c2b9a-6d4e-4f7a-9b2c-1e8d7a6b5c4d.webp';

describe('moderateProfile (Brief 03C.2 profile reports)', () => {
  beforeEach(() => {
    rpc.mockReset();
    remove.mockReset();
  });

  it('remove_photo deletes the returned file from the avatars bucket', async () => {
    rpc.mockResolvedValue({ data: PHOTO, error: null });
    remove.mockResolvedValue({ data: [], error: null });
    expect(await moderateProfile(STAFF, REPORT, 'remove_photo', 'Explicit image')).toBe('ok');
    expect(rpc).toHaveBeenCalledWith('admin_profile_action', {
      p_actor: STAFF,
      p_report_id: REPORT,
      p_action: 'remove_photo',
      p_reason: 'Explicit image',
    });
    expect(remove).toHaveBeenCalledWith([PHOTO]);
    expect(rpc).not.toHaveBeenCalledWith('jobs_enqueue', expect.anything());
  });

  it('queues a storage_delete_avatar job when Storage refuses the delete', async () => {
    rpc.mockImplementation((name: string) =>
      Promise.resolve(
        name === 'admin_profile_action'
          ? { data: PHOTO, error: null }
          : { data: null, error: null },
      ),
    );
    remove.mockResolvedValue({ data: null, error: { message: 'boom' } });
    expect(await moderateProfile(STAFF, REPORT, 'remove_photo', 'Explicit image')).toBe('ok');
    expect(rpc).toHaveBeenCalledWith('jobs_enqueue', {
      p_kind: 'storage_delete_avatar',
      p_payload: { path: PHOTO },
    });
  });

  it('touches Storage only for remove_photo, and maps SQL refusals', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await moderateProfile(STAFF, REPORT, 'clear_bio', 'Contact details')).toBe('ok');
    expect(remove).not.toHaveBeenCalled();
    rpc.mockResolvedValue({ data: null, error: { code: 'P0002' } });
    expect(await moderateProfile(STAFF, REPORT, 'dismiss', 'Fine')).toBe('gone');
    rpc.mockResolvedValue({ data: null, error: { code: '42501' } });
    expect(await moderateProfile(STAFF, REPORT, 'require_new_name', 'Impersonation')).toBe(
      'forbidden',
    );
  });
});
