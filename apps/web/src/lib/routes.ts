/** Product pages hide the tab bar on phones so price and the primary action fit (ADR-0011). */
export function isProductPath(pathname: string): boolean {
  return /^\/l\/[^/]+\/?$/.test(pathname) || pathname === '/dev/templates/listing';
}
