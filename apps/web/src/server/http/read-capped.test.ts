import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const { readCapped } = await import('./read-capped');

const MAX = 1024;

describe('readCapped', () => {
  it('reads at most the cap, whatever Content-Length says', async () => {
    const lying = new Request('http://x/', {
      method: 'POST',
      body: new Blob([new Uint8Array(MAX + 1)]).stream(),
      // @ts-expect-error -- Node needs duplex for a streamed body
      duplex: 'half',
    });
    expect(await readCapped(lying, MAX)).toBeNull();
    const small = new Request('http://x/', { method: 'POST', body: 'abc' });
    expect(await readCapped(small, MAX)).toEqual(new TextEncoder().encode('abc'));
  });

  it('refuses a declared oversize body without reading it', async () => {
    const body = new ReadableStream({
      pull() {
        throw new Error('the body was read');
      },
    });
    const declared = new Request('http://x/', {
      method: 'POST',
      body,
      headers: { 'content-length': String(MAX + 1) },
      // @ts-expect-error -- Node needs duplex for a streamed body
      duplex: 'half',
    });
    expect(await readCapped(declared, MAX)).toBeNull();
  });
});
