/**
 * Content-Security-Policy for HTML responses. Third-party origins (Mux, the bot challenge) are
 * added only when the feature that needs them is configured.
 */
export function contentSecurityPolicy({
  nonce,
  isDev,
  upgradeInsecure,
  turnstile = false,
  mux = false,
}: {
  nonce: string;
  isDev: boolean;
  upgradeInsecure: boolean;
  /** Cloudflare Turnstile (CAPTCHA_PROVIDER=turnstile): its script and challenge iframe only. */
  turnstile?: boolean;
  /**
   * Mux video (VIDEO_PROVIDER=mux), per https://www.mux.com/docs/core/content-security-policy:
   * playback and thumbnails from *.mux.com (several CDN hosts), direct uploads to
   * storage.googleapis.com, and blob: media and workers for HLS. No litix.io: the player runs with
   * Mux Data tracking off.
   */
  mux?: boolean;
}): string {
  const challenge = turnstile ? ' https://challenges.cloudflare.com' : '';
  const muxConnect = mux ? ' https://*.mux.com https://storage.googleapis.com' : '';
  const directives = [
    "default-src 'self'",
    // React's dev tooling needs eval; production never gets it.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${challenge}${isDev ? " 'unsafe-eval'" : ''}`,
    // The dev error overlay injects inline styles; browsers ignore 'unsafe-inline' next to a nonce.
    isDev ? "style-src 'self' 'unsafe-inline'" : `style-src 'self' 'nonce-${nonce}'`,
    `img-src 'self' data: blob:${mux ? ' https://image.mux.com' : ''}`,
    ...(mux ? ["media-src 'self' blob: https://*.mux.com", "worker-src 'self' blob:"] : []),
    "font-src 'self'",
    `connect-src 'self'${muxConnect}`,
    "manifest-src 'self'",
    ...(turnstile ? [`frame-src${challenge}`] : []),
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ];
  if (upgradeInsecure) directives.push('upgrade-insecure-requests');
  return directives.join('; ');
}

export function createNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}
