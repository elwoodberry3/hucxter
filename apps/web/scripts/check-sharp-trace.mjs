// CI check (Brief 03C.2, sharp#4567): after `next build`, the avatar route's file trace must list
// sharp and the libvips binary for this machine's platform (linux-x64 in CI, as on Vercel).
// Usage from apps/web: `node scripts/check-sharp-trace.mjs` (exit 1 when anything is missing).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const trace = fileURLToPath(
  new URL('../.next/server/app/api/profile/avatar/route.js.nft.json', import.meta.url),
);
const platform = `${process.platform}-${process.arch}`;
const files = JSON.parse(readFileSync(trace, 'utf8')).files;
const has = (pattern) => files.some((file) => pattern.test(file));
const checks = {
  sharp: has(/node_modules\/sharp\/dist\/index\.cjs$/),
  // The native addon (sharp-<platform>-<version>.node) and the libvips shared library it loads.
  [`@img/sharp-${platform}`]: has(
    new RegExp(`@img/sharp-${platform}/lib/sharp-${platform}[^/]*\\.node$`),
  ),
  [`@img/sharp-libvips-${platform}`]: has(
    new RegExp(`@img/sharp-libvips-${platform}/lib/libvips-cpp`),
  ),
};
console.log(JSON.stringify({ trace: 'api/profile/avatar', platform, files: files.length, checks }));
if (Object.values(checks).includes(false)) {
  console.error('The avatar route trace is missing sharp files (see sharp#4567).');
  process.exit(1);
}
