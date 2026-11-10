'use client';

import { useEffect } from 'react';

/**
 * Rendered when this page found the session invalid (Brief 03C.1b H5): the page already shows a
 * guest view; this asks the server once to clear the stale session cookies.
 */
export function StaleSessionCleanup() {
  useEffect(() => {
    void fetch('/api/session/stale', { method: 'POST', cache: 'no-store' }).catch(() => undefined);
  }, []);
  return null;
}
