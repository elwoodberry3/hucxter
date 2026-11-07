'use server';

import {
  HANDLE_MESSAGES,
  HANDLE_STATUSES,
  ProfileResetInput,
  handleProblem,
  normalizeHandle,
} from '@hucxter/contracts';
import type { HandleStatus } from '@hucxter/contracts';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { GENERIC_ERROR, ORIGIN_ERROR } from '@/server/auth/errors';
import { loadMember } from '@/server/auth/member';
import { requestIsSameOrigin } from '@/server/auth/origin';
import { sessionClient } from '@/server/supabase-server';

const HandleStatusSchema = z.enum(HANDLE_STATUSES);

/**
 * Availability while someone types a handle (settings, /welcome reset). Verified members and
 * members in a staff-required reset; rate-limited in the database (handle_check, 60 per 10 min),
 * which answers 'limited'.
 */
export async function checkHandle(raw: unknown): Promise<HandleStatus> {
  if (typeof raw !== 'string' || raw.length > 100) return 'invalid';
  const handle = normalizeHandle(raw);
  if (handleProblem(handle) !== null) return 'invalid';
  if (!(await requestIsSameOrigin())) return 'limited';
  const result = await (await sessionClient()).rpc('handle_status', { p_handle: handle });
  const status = HandleStatusSchema.safeParse(result.data);
  return result.error === null && status.success ? status.data : 'limited';
}

export type ResetResult =
  { status: 'saved' } | { status: 'error'; message: string; field?: 'displayName' | 'handle' };

/**
 * After staff required a new name and handle: the member picks both (Brief 03C.2 moderation).
 * Allowed only while the reset is pending; doesn't count toward the 30-day handle rule.
 */
export async function completeProfileReset(input: unknown): Promise<ResetResult> {
  if (!(await requestIsSameOrigin())) return { status: 'error', message: ORIGIN_ERROR };
  const member = await loadMember();
  if (member === null || !member.nameResetRequired) {
    return { status: 'error', message: GENERIC_ERROR };
  }
  const parsed = ProfileResetInput.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      status: 'error',
      message: issue?.message ?? GENERIC_ERROR,
      ...(issue?.path[0] === 'handle'
        ? { field: 'handle' as const }
        : { field: 'displayName' as const }),
    };
  }
  const result = await (
    await sessionClient()
  ).rpc('profile_complete_reset', {
    p_display_name: parsed.data.displayName,
    p_handle: parsed.data.handle,
  });
  const data: unknown = result.data;
  if (result.error !== null) {
    return result.error.code === '23514'
      ? { status: 'error', field: 'displayName', message: 'Choose a different display name.' }
      : { status: 'error', message: GENERIC_ERROR };
  }
  if (data !== 'ok') {
    const status = HandleStatusSchema.safeParse(data);
    return {
      status: 'error',
      field: 'handle',
      message:
        status.success && status.data === 'invalid'
          ? HANDLE_MESSAGES.reserved
          : 'That handle isn’t available.',
    };
  }
  revalidatePath('/', 'layout');
  return { status: 'saved' };
}
