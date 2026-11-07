import 'server-only';
import { profileConfig, supabaseConfig } from './env';

const AVATAR_PATH = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/;

/**
 * The public URL of a profile photo in the `avatars` bucket, or null for the initials avatar:
 * no photo, an unexpected object name, or photos switched off (AVATAR_UPLOADS=off).
 */
export function avatarUrl(path: string | null | undefined): string | null {
  if (path === null || path === undefined || !AVATAR_PATH.test(path)) return null;
  const { avatarOrigin } = profileConfig();
  if (avatarOrigin === null) return null;
  const base = supabaseConfig().url.replace(/\/$/, '');
  return `${base}/storage/v1/object/public/avatars/${path}`;
}
