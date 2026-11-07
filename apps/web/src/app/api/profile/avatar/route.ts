import { revalidatePath } from 'next/cache';
import { profileConfig } from '@/lib/env';
import { loadMember } from '@/server/auth/member';
import { rejectCrossOrigin } from '@/server/auth/origin';
import { removeAvatar, saveAvatar, takeAvatarAttempt } from '@/server/profile/avatar';
import {
  AVATAR_MAX_BYTES,
  AVATAR_TYPES,
  AvatarInputError,
  processAvatar,
  readCapped,
} from '@/server/profile/image';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const WRONG_FILE = 'Choose a JPEG, PNG or WebP photo up to 5 MB.';

function json(status: number, body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

/** Same gate for both methods: photos on, same origin, a verified member. */
async function gate(
  request: Request,
): Promise<Response | { userId: string; handle: string | null }> {
  if (!profileConfig().avatarUploads) return new Response('Not found', { status: 404 });
  const crossOrigin = rejectCrossOrigin(request);
  if (crossOrigin !== null) return crossOrigin;
  const member = await loadMember();
  if (member === null) return json(401, { error: 'Sign in again to change your photo.' });
  if (!member.verified) return json(403, { error: 'Finish setting up your account first.' });
  return { userId: member.userId, handle: member.handle };
}

function revalidate(handle: string | null) {
  if (handle !== null) revalidatePath(`/u/${handle}`);
  revalidatePath('/settings', 'layout');
}

/**
 * Upload a profile photo (Brief 03C.2 §4.5): raw body, ≤ 5 MB, JPEG/PNG/WebP by magic bytes and
 * by the decoder. Re-encoded on the server to a metadata-free 512×512 WebP before it's stored.
 */
export async function POST(request: Request) {
  const who = await gate(request);
  if (who instanceof Response) return who;
  const type = (request.headers.get('content-type') ?? '').split(';')[0]?.trim() ?? '';
  if (!(AVATAR_TYPES as readonly string[]).includes(type)) return json(415, { error: WRONG_FILE });
  // The limit comes first: decoding is the expensive part, so every attempt counts.
  let retryAfter: number;
  try {
    retryAfter = await takeAvatarAttempt(who.userId);
  } catch {
    console.error(JSON.stringify({ event: 'avatar_limit_failed' }));
    return json(500, { error: 'We couldn’t save your photo. Try again.' });
  }
  if (retryAfter > 0) {
    return json(
      429,
      { error: 'You’ve changed your photo a lot today. Try again tomorrow.' },
      { 'Retry-After': String(retryAfter) },
    );
  }
  const body = await readCapped(request, AVATAR_MAX_BYTES);
  if (body === null) return json(413, { error: WRONG_FILE });
  if (body.byteLength === 0) return json(400, { error: WRONG_FILE });
  let webp: Buffer;
  try {
    webp = await processAvatar(body);
  } catch (error) {
    if (error instanceof AvatarInputError) return json(422, { error: WRONG_FILE });
    throw error;
  }
  try {
    await saveAvatar(who.userId, webp);
  } catch {
    console.error(JSON.stringify({ event: 'avatar_save_failed' }));
    return json(500, { error: 'We couldn’t save your photo. Try again.' });
  }
  revalidate(who.handle);
  return json(200, { status: 'ok' });
}

/** Remove the photo: initials show everywhere and the file is deleted. */
export async function DELETE(request: Request) {
  const who = await gate(request);
  if (who instanceof Response) return who;
  try {
    await removeAvatar(who.userId);
  } catch {
    console.error(JSON.stringify({ event: 'avatar_remove_failed' }));
    return json(500, { error: 'We couldn’t remove your photo. Try again.' });
  }
  revalidate(who.handle);
  return json(200, { status: 'ok' });
}
