import 'server-only';
import { z } from 'zod';
import { adminDb } from '@/server/admin-db';
import { videoProvider } from '@/server/media/provider';
import { deleteAvatarObject } from '@/server/profile/avatar';

/**
 * Postgres job queue runner (ADR-0004): Mux deletions and cancellations queued by deletes,
 * takedowns, replaced videos and account deletion, profile photos of deleted accounts (3C.2),
 * plus the 24 h orphan-upload sweep. Claimed
 * jobs are locked, so overlapping runs are safe; failures back off (jobs_fail).
 */
const Job = z.object({ id: z.number(), kind: z.string(), payload: z.unknown() });
const AssetPayload = z.object({ asset_id: z.string().min(1).max(200) });
const PlaybackPayload = AssetPayload.extend({ playback_id: z.string().min(1).max(200) });
const UploadPayload = z.object({ upload_id: z.string().min(1).max(200) });
const AvatarPayload = z.object({ path: z.string().regex(/^[0-9a-f-]{36}\.webp$/) });

const BATCH = 20;
const LOCK_SECONDS = 120;

/** jobs.last_error holds a short code only (no provider messages, which may echo ids). */
export function jobErrorCode(error: unknown): string {
  if (error instanceof z.ZodError) return 'bad_payload';
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const { status } = error;
    if (typeof status === 'number' && Number.isInteger(status)) return `provider_${String(status)}`;
  }
  if (error instanceof Error && /^[a-z0-9_]{1,60}$/.test(error.message)) return error.message;
  return 'job_failed';
}

export interface JobRunSummary {
  done: number;
  failed: number;
  swept: number;
}

export async function runJobs(): Promise<JobRunSummary> {
  const db = adminDb();
  const provider = await videoProvider();
  const summary: JobRunSummary = { done: 0, failed: 0, swept: 0 };

  const sweep = await db.rpc('media_sweep_orphans');
  if (sweep.error !== null) throw new Error(`media_sweep_failed:${sweep.error.code}`);
  summary.swept = typeof sweep.data === 'number' ? sweep.data : 0;

  const claimed = await db.rpc('jobs_claim', { p_limit: BATCH, p_lock_seconds: LOCK_SECONDS });
  if (claimed.error !== null) throw new Error(`jobs_claim_failed:${claimed.error.code}`);
  const jobs = z.array(Job).parse(claimed.data);

  for (const job of jobs) {
    try {
      switch (job.kind) {
        case 'mux_delete_asset':
          await provider.deleteAsset(AssetPayload.parse(job.payload).asset_id);
          break;
        case 'mux_delete_playback_id': {
          const { asset_id, playback_id } = PlaybackPayload.parse(job.payload);
          await provider.deletePlaybackId(asset_id, playback_id);
          break;
        }
        case 'mux_cancel_upload':
          await provider.cancelUpload(UploadPayload.parse(job.payload).upload_id);
          break;
        case 'storage_delete_avatar':
          if (!(await deleteAvatarObject(AvatarPayload.parse(job.payload).path))) {
            throw new Error('storage_delete_failed');
          }
          break;
        default:
          throw new Error('unknown_job_kind');
      }
      await db.rpc('jobs_complete', { p_id: job.id });
      summary.done += 1;
    } catch (error) {
      await db.rpc('jobs_fail', { p_id: job.id, p_error: jobErrorCode(error) });
      summary.failed += 1;
    }
  }
  return summary;
}
