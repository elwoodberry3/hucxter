import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const handleMuxWebhook = vi.fn();
vi.mock('@/server/media/webhook', () => ({ MAX_WEBHOOK_BYTES: 64 * 1024, handleMuxWebhook }));
const { POST } = await import('./route');

function streamed(body: ReadableStream, headers: Record<string, string> = {}): Request {
  return new Request('http://x/api/webhooks/mux', {
    method: 'POST',
    body,
    headers,
    // @ts-expect-error -- Node needs duplex for a streamed body
    duplex: 'half',
  });
}

describe('Mux webhook route (Brief 03C.1b H4)', () => {
  it('refuses a large Content-Length before reading the body', async () => {
    const untouched = new ReadableStream({
      pull() {
        throw new Error('the body was read');
      },
    });
    const response = await POST(streamed(untouched, { 'content-length': String(64 * 1024 + 1) }));
    expect(response.status).toBe(413);
    expect(handleMuxWebhook).not.toHaveBeenCalled();
  });

  it('stops reading a chunked body past 64 KB', async () => {
    const response = await POST(streamed(new Blob([new Uint8Array(64 * 1024 + 1)]).stream()));
    expect(response.status).toBe(413);
    expect(handleMuxWebhook).not.toHaveBeenCalled();
  });

  it('passes a small body and the signature on', async () => {
    handleMuxWebhook.mockResolvedValueOnce({ status: 200, outcome: 'ready' });
    const response = await POST(
      new Request('http://x/api/webhooks/mux', {
        method: 'POST',
        body: '{"id":"1"}',
        headers: { 'mux-signature': 't=1,v1=abc' },
      }),
    );
    expect(response.status).toBe(200);
    expect(handleMuxWebhook).toHaveBeenCalledWith('{"id":"1"}', 't=1,v1=abc');
  });
});
