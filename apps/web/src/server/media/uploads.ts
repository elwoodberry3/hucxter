import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { adminDb } from '@/server/admin-db';
import { videoProvider } from './provider';

const BeginResult = z.union([
  z.object({ media_id: z.uuid() }),
  z.object({ retry_after: z.number().int().positive() }),
]);

export type BeginUploadResult =
  { status: 'ok'; mediaId: string; uploadUrl: string } | { status: 'limited'; retryAfter: number };

/**
 * Starts a direct upload for the member's own draft (hucxter-video-pipeline). Ownership, the
 * draft-only rule and the uploads-per-hour limit are checked by media_begin_upload running as
 * the member (RLS session); only then is a Mux upload created. The upload id is stored with the
 * service role because members can't write media rows. Our server never receives the file.
 */
export async function beginUpload(
  session: SupabaseClient,
  listingId: string,
): Promise<BeginUploadResult> {
  const result = await session.rpc('media_begin_upload', { p_listing_id: listingId });
  if (result.error !== null) throw new Error(`media_begin_upload:${result.error.code}`);
  const begun = BeginResult.parse(result.data);
  if ('retry_after' in begun) return { status: 'limited', retryAfter: begun.retry_after };
  const provider = await videoProvider();
  const upload = await provider.createUpload(begun.media_id);
  const stored = await adminDb().rpc('media_upload_created', {
    p_media_id: begun.media_id,
    p_upload_id: upload.uploadId,
  });
  if (stored.error !== null) throw new Error(`media_upload_created:${stored.error.code}`);
  return { status: 'ok', mediaId: begun.media_id, uploadUrl: upload.url };
}
