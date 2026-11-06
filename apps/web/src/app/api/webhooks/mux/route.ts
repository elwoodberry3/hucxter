import { handleMuxWebhook } from '@/server/media/webhook';

export const dynamic = 'force-dynamic';

// Mux → us. Signed (mux-signature), so no Origin check; the body is read raw for verification.
export async function POST(request: Request): Promise<Response> {
  const result = await handleMuxWebhook(await request.text(), request.headers.get('mux-signature'));
  return Response.json(
    { outcome: result.outcome },
    {
      status: result.status,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
