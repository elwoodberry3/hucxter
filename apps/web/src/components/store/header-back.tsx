'use client';

import { ArrowLeft } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { isProductPath } from '@/lib/routes';
import styles from './header.module.css';

/** Phone product pages: a Back button in the header replaces the tab bar (ADR-0011). */
export function HeaderBack() {
  const pathname = usePathname();
  const router = useRouter();
  if (!isProductPath(pathname)) return null;
  return (
    <button
      type="button"
      className={styles.backButton}
      aria-label="Back"
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push('/');
      }}
    >
      <ArrowLeft size={22} aria-hidden="true" />
    </button>
  );
}
