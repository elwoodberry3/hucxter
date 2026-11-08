import { readCapped } from '@/server/http/read-capped';
import { MAX_WEBHOOK_BYTES, handleMuxWebhook } from '@/server/media/webhook';

export const dynamic = 'force-dynamic';

// Mux → us. Signed (mux-signature), so no Origin check; the body is read raw for verification,
// and never past 64 KB: Content-Length is checked before reading, then the read itself is capped
// (Brief 03C.1b H4).
export async function POST(request: Request): Promise<Response> {
  const headers = { 'Cache-Control': 'no-store' };
  const body = await readCapped(request, MAX_WEBHOOK_BYTES);
  if (body === null) return Response.json({ outcome: 'too_large' }, { status: 413, headers });
  const result = await handleMuxWebhook(
    new TextDecoder().decode(body),
    request.headers.get('mux-signature'),
  );
  return Response.json({ outcome: result.outcome }, { status: result.status, headers });
}
