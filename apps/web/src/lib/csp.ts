/**
 * Content-Security-Policy for HTML responses. Third-party origins (Mux, Supabase, the bot
 * challenge) are added by the brief that introduces each one.
 */
export function contentSecurityPolicy({
  nonce,
  isDev,
  upgradeInsecure,
}: {
  nonce: string;
  isDev: boolean;
  upgradeInsecure: boolean;
}): string {
  const directives = [
    "default-src 'self'",
    // React's dev tooling needs eval; production never gets it.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    // The dev error overlay injects inline styles; browsers ignore 'unsafe-inline' next to a nonce.
    isDev ? "style-src 'self' 'unsafe-inline'" : `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "manifest-src 'self'",
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
