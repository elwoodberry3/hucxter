'use server';

import { ReportInput } from '@hucxter/contracts';
import { GENERIC_ERROR, ORIGIN_ERROR } from '@/server/auth/errors';
import { loadMember } from '@/server/auth/member';
import { requestIsSameOrigin } from '@/server/auth/origin';
import { recordEvent } from '@/server/events';
import { sessionClient } from '@/server/supabase-server';

export type ReportResult =
  | { status: 'sent' }
  | { status: 'limited'; retryAfter: number; message: string }
  | { status: 'error'; message: string };

/**
 * Report a listing or a profile (hucxter-trust-safety). Verified members only; one open report per
 * member per target, reports-per-day limits in the database. The reporter is never shown to the
 * person reported. Profiles are named by @handle and resolved in the database.
 */
export async function submitReport(input: unknown): Promise<ReportResult> {
  if (!(await requestIsSameOrigin())) return { status: 'error', message: ORIGIN_ERROR };
  let userId: string;
  try {
    const member = await loadMember();
    if (member === null || !member.verified) {
      return { status: 'error', message: 'Finish setting up your account to report.' };
    }
    userId = member.userId;
  } catch {
    return { status: 'error', message: GENERIC_ERROR };
  }
  const parsed = ReportInput.safeParse(input);
  if (!parsed.success) return { status: 'error', message: 'Choose a reason.' };
  const report = parsed.data;
  const supabase = await sessionClient();
  const result =
    report.targetType === 'listing'
      ? await supabase.rpc('report_create', {
          p_target_type: 'listing',
          p_target_id: report.targetId,
          p_reason: report.reason,
          p_note: report.note,
        })
      : await supabase.rpc('report_profile', {
          p_handle: report.handle,
          p_reason: report.reason,
          p_note: report.note,
        });
  const { error } = result;
  const data: unknown = result.data;
  if (error !== null || typeof data !== 'string')
    return { status: 'error', message: GENERIC_ERROR };
  if (data.startsWith('retry_after:')) {
    const retryAfter = Number(data.slice('retry_after:'.length));
    return {
      status: 'limited',
      retryAfter,
      message: 'You’ve sent a lot of reports today. Try again tomorrow.',
    };
  }
  if (data === 'not_found') {
    return {
      status: 'error',
      message:
        report.targetType === 'listing'
          ? 'This listing is no longer available.'
          : 'This profile is no longer available.',
    };
  }
  if (data === 'created') {
    await recordEvent(
      { name: 'report_submitted', target: report.targetType, reason: report.reason },
      { listingId: report.targetType === 'listing' ? report.targetId : null, actor: userId },
    );
  }
  // A duplicate is reported as sent: the first report is still open.
  return { status: 'sent' };
}
