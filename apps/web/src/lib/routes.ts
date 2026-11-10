/** Product pages hide the tab bar on phones so price and the primary action fit (ADR-0011). */
export function isProductPath(pathname: string): boolean {
  return /^\/l\/[^/]+\/?$/.test(pathname);
}

/** The Discover feed: full height, so no footer, and no category bar on phones (3D). */
export function isFeedPath(pathname: string): boolean {
  return /^\/discover\/?$/.test(pathname);
}

/**
 * Pages that load Mux Player, whose shadow-DOM styles need 'unsafe-inline' (Founder decisions
 * 2026-11-06 for listing pages and 2026-11-09 for Discover). Used only by the CSP in proxy.ts.
 */
export function needsInlineStyles(pathname: string): boolean {
  return isProductPath(pathname) || isFeedPath(pathname);
}
