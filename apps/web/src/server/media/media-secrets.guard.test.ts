import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Brief 03C.1 §3.3: Mux credentials are read only in server/media/mux.ts, CRON_SECRET only in
 * server/jobs/cron-auth.ts, and the Mux server SDK never reaches a client bundle.
 */
const SRC = fileURLToPath(new URL('../..', import.meta.url));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

const files = sourceFiles(SRC).map((path) => ({
  rel: relative(SRC, path).split(sep).join('/'),
  text: readFileSync(path, 'utf8'),
}));

const readers = (pattern: RegExp) =>
  files.filter(({ text }) => pattern.test(text)).map((f) => f.rel);

describe('media secret isolation', () => {
  it('only server/media/mux.ts reads Mux credentials', () => {
    expect(
      readers(/MUX_(TOKEN_ID|TOKEN_SECRET|WEBHOOK_SECRET|SIGNING_KEY_ID|SIGNING_PRIVATE_KEY)/),
    ).toEqual(['server/media/mux.ts']);
  });

  it('only server/jobs/cron-auth.ts reads CRON_SECRET', () => {
    expect(readers(/CRON_SECRET/)).toEqual(['server/jobs/cron-auth.ts']);
  });

  it('the Mux server SDK is imported only by server-only media code', () => {
    const importers = files.filter(({ text }) => /from ['"]@mux\/ts['"]/.test(text));
    expect(importers.map((f) => f.rel)).toEqual(['server/media/mux.ts']);
    for (const file of files.filter((f) => f.rel.startsWith('server/media/'))) {
      expect(file.text, file.rel).toMatch(/^import 'server-only';/);
    }
  });

  it('no NEXT_PUBLIC_ variable carries a media secret', () => {
    expect(readers(/NEXT_PUBLIC_(MUX|CRON)/)).toEqual([]);
  });
});
