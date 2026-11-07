import 'server-only';
import { randomUUID } from 'node:crypto';
import { adminDb } from '@/server/admin-db';

/**
 * Profile photo storage (Brief 03C.2 §4.5). The service role is the only writer of the public
 * `avatars` bucket; names are random `<uuid>.webp` and never reused, so they cache for a day.
 */
const BUCKET = 'avatars';
const OBJECT_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/;

export type AvatarSaveResult = { status: 'ok' } | { status: 'limited'; retryAfter: number };

/** Deletes one stored photo. Logs (without the name) and carries on when Storage fails. */
export async function deleteAvatarObject(path: string | null | undefined): Promise<boolean> {
  if (path === null || path === undefined || !OBJECT_NAME.test(path)) return true;
  const { error } = await adminDb().storage.from(BUCKET).remove([path]);
  if (error !== null) {
    console.error(JSON.stringify({ event: 'avatar_delete_failed' }));
    return false;
  }
  return true;
}

/** Stores a processed photo as the member's avatar and deletes the one it replaces. */
export async function saveAvatar(userId: string, webp: Buffer): Promise<AvatarSaveResult> {
  const db = adminDb();
  const limit = await db.rpc('action_limit_take', { p_user_id: userId, p_action: 'avatar_upload' });
  if (limit.error !== null) throw new Error(`avatar_limit:${limit.error.code}`);
  const retryAfter = typeof limit.data === 'number' ? limit.data : 0;
  if (retryAfter > 0) return { status: 'limited', retryAfter };

  const path = `${randomUUID()}.webp`;
  const upload = await db.storage.from(BUCKET).upload(path, webp, {
    contentType: 'image/webp',
    cacheControl: '86400',
    upsert: false,
  });
  if (upload.error !== null) throw new Error('avatar_upload_failed');
  const set = await db.rpc('profile_set_avatar', { p_user_id: userId, p_path: path });
  if (set.error !== null) {
    await deleteAvatarObject(path);
    throw new Error(`avatar_set:${set.error.code}`);
  }
  await deleteAvatarObject(typeof set.data === 'string' ? set.data : null);
  return { status: 'ok' };
}

/** Removes the member's photo (initials show) and deletes the file. */
export async function removeAvatar(userId: string): Promise<void> {
  const set = await adminDb().rpc('profile_set_avatar', { p_user_id: userId, p_path: null });
  if (set.error !== null) throw new Error(`avatar_remove:${set.error.code}`);
  await deleteAvatarObject(typeof set.data === 'string' ? set.data : null);
}
