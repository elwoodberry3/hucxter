'use client';

import { useCallback, useSyncExternalStore } from 'react';

/** Phone/tablet layout: below the single content breakpoint (ADR-0011). Keep in sync with CSS. */
export const COMPACT_QUERY = '(width < 64rem)';

/**
 * Subscribes to a media query. `serverValue` is used for SSR and hydration, so pick the value whose
 * markup CSS already handles for first paint.
 */
export function useMediaQuery(query: string, serverValue = false): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => {
        list.removeEventListener('change', onChange);
      };
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}
