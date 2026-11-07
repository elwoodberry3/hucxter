'use client';

import { useEffect } from 'react';

/** Counts one view per viewer per day (server-side dedupe); runs only in a real browser. */
export function ViewBeacon({ listingId }: { listingId: string }) {
  useEffect(() => {
    void fetch(`/api/listings/${listingId}/view`, { method: 'POST', keepalive: true }).catch(
      () => undefined,
    );
  }, [listingId]);
  return null;
}
