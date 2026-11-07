'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { GENERIC_ERROR, ORIGIN_ERROR } from '@/server/auth/errors';
import { loadMember } from '@/server/auth/member';
import { requestIsSameOrigin } from '@/server/auth/origin';
import { approveListing, dismissReport, removeListing } from '@/server/admin/queue';
import type { ModerationResult } from '@/server/admin/queue';

/**
 * Moderation actions (Brief 03C.1 §3.6). Staff only: checked here and again in SQL
 * (assert_staff), which also writes the audit_log row. Removing a listing hides it at once and
 * enqueues revoking its Mux playback id.
 */
export type AdminResult = { status: 'ok' } | { status: 'error'; message: string };

const ListingTarget = z.object({ listingId: z.uuid() }).strict();
const RemoveInput = z.object({ listingId: z.uuid(), reason: z.string().trim().max(500) }).strict();
const ReportTarget = z.object({ reportId: z.uuid() }).strict();

async function staffId(): Promise<string | AdminResult> {
  if (!(await requestIsSameOrigin())) return { status: 'error', message: ORIGIN_ERROR };
  try {
    const member = await loadMember();
    if (member === null || !member.verified || !member.isStaff) {
      return { status: 'error', message: 'Staff only.' };
    }
    return member.userId;
  } catch {
    return { status: 'error', message: GENERIC_ERROR };
  }
}

function result(outcome: ModerationResult, listingId?: string): AdminResult {
  revalidatePath('/admin');
  if (listingId !== undefined) {
    revalidatePath(`/l/${listingId}`);
    revalidatePath('/');
  }
  switch (outcome) {
    case 'ok':
      return { status: 'ok' };
    case 'gone':
      return { status: 'error', message: 'Someone already handled this. Reload the queue.' };
    case 'forbidden':
      return { status: 'error', message: 'Staff only.' };
    case 'failed':
      return { status: 'error', message: GENERIC_ERROR };
  }
}

export async function approveHeldListing(input: unknown): Promise<AdminResult> {
  const actor = await staffId();
  if (typeof actor !== 'string') return actor;
  const parsed = ListingTarget.safeParse(input);
  if (!parsed.success) return { status: 'error', message: GENERIC_ERROR };
  return result(await approveListing(actor, parsed.data.listingId), parsed.data.listingId);
}

export async function removeReportedListing(input: unknown): Promise<AdminResult> {
  const actor = await staffId();
  if (typeof actor !== 'string') return actor;
  const parsed = RemoveInput.safeParse(input);
  if (!parsed.success) return { status: 'error', message: GENERIC_ERROR };
  return result(
    await removeListing(actor, parsed.data.listingId, parsed.data.reason),
    parsed.data.listingId,
  );
}

export async function dismissOpenReport(input: unknown): Promise<AdminResult> {
  const actor = await staffId();
  if (typeof actor !== 'string') return actor;
  const parsed = ReportTarget.safeParse(input);
  if (!parsed.success) return { status: 'error', message: GENERIC_ERROR };
  return result(await dismissReport(actor, parsed.data.reportId));
}
