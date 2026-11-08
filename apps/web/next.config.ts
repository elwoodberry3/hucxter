import type { NextConfig } from 'next';

// Static security headers for every response (hucxter-trust-safety § Web security baseline).
// The nonce-based Content-Security-Policy is per request, so it is set in src/proxy.ts.
const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    // geolocation=(self): "Use my current location" in the header (user-initiated, ZIP kept only).
    value: 'camera=(), microphone=(), geolocation=(self), payment=(), usb=(), browsing-topics=()',
  },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: ['@hucxter/contracts'],
  // Profile photos (3C.2): sharp is a native module, loaded at runtime rather than bundled, and
  // its Linux x64 binaries (Vercel functions, CI) are traced into the avatar route explicitly
  // (sharp#4567: libvips missing from Next 16 traces). scripts/check-sharp-trace.mjs checks it.
  serverExternalPackages: ['sharp'],
  outputFileTracingIncludes: {
    '/api/profile/avatar': [
      '../../node_modules/.pnpm/@img+sharp-linux-x64@*/node_modules/@img/sharp-linux-x64/**/*',
      '../../node_modules/.pnpm/@img+sharp-libvips-linux-x64@*/node_modules/@img/sharp-libvips-linux-x64/**/*',
    ],
  },
  headers() {
    return Promise.resolve([
      { source: '/:path*', headers: securityHeaders },
      // API responses are never documents; deny everything if one is ever rendered.
      {
        source: '/api/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: "default-src 'none'; frame-ancestors 'none'" },
        ],
      },
    ]);
  },
};

export default nextConfig;
