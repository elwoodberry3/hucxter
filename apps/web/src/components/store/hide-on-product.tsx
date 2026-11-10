'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { isFeedPath, isProductPath } from '@/lib/routes';
import styles from './layout.module.css';

/** Hides its children on phone-width product pages and the Discover feed (desktop is unaffected). */
export function HideOnProduct({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hidden = isProductPath(pathname) || isFeedPath(pathname);
  return <div className={hidden ? styles.hideOnCompact : undefined}>{children}</div>;
}

/** Hides its children on the Discover feed at every width (the feed fills the viewport). */
export function HideOnFeed({ children }: { children: ReactNode }) {
  return isFeedPath(usePathname()) ? null : children;
}
