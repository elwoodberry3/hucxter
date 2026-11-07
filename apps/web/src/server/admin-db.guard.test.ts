import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Brief §5: the service-role key is read only in src/server/admin-db.ts, and admin-db is imported
 * only by account deletion, audit, abuse-limit, media (webhooks, playback), jobs, admin and event code.
 */
const SRC = fileURLToPath(new URL('..', import.meta.url));
const KEY_OWNER = 'server/admin-db.ts';
const ALLOWED_IMPORTERS = [
  /^server\/account\//,
  /^server\/auth\/otp-limits\.ts$/,
  /^server\/media\//,
  /^server\/jobs\//,
  /^server\/admin\//,
  /^server\/events\.ts$/,
];

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

describe('service-role key isolation', () => {
  it('only server/admin-db.ts reads SUPABASE_SECRET_KEY', () => {
    const readers = files
      .filter(({ text }) => text.includes('SUPABASE_SECRET_KEY'))
      .map((f) => f.rel);
    expect(readers).toEqual([KEY_OWNER]);
  });

  it('admin-db is imported only by allowed server modules', () => {
    const importers = files
      .filter(({ text }) =>
        /from ['"](@\/server\/|\.\.?\/(\.\.\/)*)(server\/)?admin-db['"]/.test(text),
      )
      .map((f) => f.rel);
    expect(importers.length).toBeGreaterThan(0);
    for (const rel of importers) {
      expect(
        ALLOWED_IMPORTERS.some((pattern) => pattern.test(rel)),
        rel,
      ).toBe(true);
    }
  });

  it('admin-db is server-only and no client component imports server code', () => {
    expect(files.find((f) => f.rel === KEY_OWNER)?.text).toMatch(/^import 'server-only';/);
    const clientImportingServer = files.filter(
      ({ text }) => /^['"]use client['"]/.test(text) && /from ['"]@\/server\//.test(text),
    );
    expect(clientImportingServer.map((f) => f.rel)).toEqual([]);
  });
});
