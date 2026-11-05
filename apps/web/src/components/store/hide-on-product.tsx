'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { isProductPath } from '@/lib/routes';
import styles from './layout.module.css';

/** Hides its children on phone-width product pages (desktop is unaffected). */
export function HideOnProduct({ children }: { children: ReactNode }) {
  const product = isProductPath(usePathname());
  return <div className={product ? styles.hideOnCompact : undefined}>{children}</div>;
}
