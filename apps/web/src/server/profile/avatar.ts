import 'server-only';
import { randomUUID } from 'node:crypto';
import { adminDb } from '@/server/admin-db';
import { codeOf, logError } from '@/server/log';

/**
 * Profile photo storage (Brief 03C.2 §4.5). The service role is the only writer of the public
 * `avatars` bucket; names are random `<uuid>.webp` and never reused, so they cache for a day.
 */
const BUCKET = 'avatars';
const OBJECT_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/;

/** Deletes one stored photo. Logs (without the name) and carries on when Storage fails. */
export async function deleteAvatarObject(path: string | null | undefined): Promise<boolean> {
  if (path === null || path === undefined || !OBJECT_NAME.test(path)) return true;
  const { error } = await adminDb().storage.from(BUCKET).remove([path]);
  if (error !== null) {
    logError('avatar_delete_failed', { code: codeOf(error) });
    return false;
  }
  return true;
}

/**
 * Deletes a replaced or removed photo; if Storage refuses, a storage_delete_avatar job retries it
 * so the public file doesn't linger.
 */
export async function deleteAvatarOrQueue(path: string | null | undefined): Promise<void> {
  if (await deleteAvatarObject(path)) return;
  const queued = await adminDb().rpc('jobs_enqueue', {
    p_kind: 'storage_delete_avatar',
    p_payload: { path },
  });
  if (queued.error !== null) {
    logError('avatar_delete_enqueue_failed', { status: queued.status, code: queued.error.code });
  }
}

/**
 * Takes one upload attempt from the member's avatar_upload limit (10 a day, 5 for new accounts).
 * Called before the photo is read or decoded, so refused and broken files count too. Returns 0,
 * or the seconds until the next attempt is allowed.
 */
export async function takeAvatarAttempt(userId: string): Promise<number> {
  const limit = await adminDb().rpc('action_limit_take', {
    p_user_id: userId,
    p_action: 'avatar_upload',
  });
  if (limit.error !== null) throw new Error(`avatar_limit:${limit.error.code}`);
  return typeof limit.data === 'number' ? limit.data : 0;
}

/** Stores a processed photo as the member's avatar and deletes the one it replaces. */
export async function saveAvatar(userId: string, webp: Buffer): Promise<void> {
  const db = adminDb();
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
  await deleteAvatarOrQueue(typeof set.data === 'string' ? set.data : null);
}

/** Removes the member's photo (initials show) and deletes the file. */
export async function removeAvatar(userId: string): Promise<void> {
  const set = await adminDb().rpc('profile_set_avatar', { p_user_id: userId, p_path: null });
  if (set.error !== null) throw new Error(`avatar_remove:${set.error.code}`);
  await deleteAvatarOrQueue(typeof set.data === 'string' ? set.data : null);
}
