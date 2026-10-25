import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { assertDevRoutesEnabled } from '@/lib/dev-gate';

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** /dev/* exists only in local and QA. In production every route below 404s. */
export default function DevLayout({ children }: { children: ReactNode }) {
  assertDevRoutesEnabled();
  return children;
}
