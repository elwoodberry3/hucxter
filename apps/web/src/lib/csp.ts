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
  inlineStyles = false,
  avatarOrigin = null,
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
  /**
   * Listing pages and Discover only (Founder decisions 2026-11-06 and 2026-11-09): Mux Player's
   * shadow-DOM <style> elements have no nonce support, so these pages allow inline styles. The style nonce is dropped there,
   * because browsers ignore 'unsafe-inline' next to a nonce. Scripts are unaffected.
   */
  inlineStyles?: boolean;
  /**
   * Profile photos (AVATAR_UPLOADS on): exactly the Supabase origin that serves the public
   * avatars bucket, for img-src only. Null when photos are off.
   */
  avatarOrigin?: string | null;
}): string {
  const challenge = turnstile ? ' https://challenges.cloudflare.com' : '';
  const muxConnect = mux ? ' https://*.mux.com https://storage.googleapis.com' : '';
  const directives = [
    "default-src 'self'",
    // React's dev tooling needs eval; production never gets it.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${challenge}${isDev ? " 'unsafe-eval'" : ''}`,
    // The dev error overlay injects inline styles; browsers ignore 'unsafe-inline' next to a nonce.
    isDev || inlineStyles
      ? "style-src 'self' 'unsafe-inline'"
      : `style-src 'self' 'nonce-${nonce}'`,
    `img-src 'self' data: blob:${mux ? ' https://image.mux.com' : ''}${avatarOrigin === null ? '' : ` ${avatarOrigin}`}`,
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
