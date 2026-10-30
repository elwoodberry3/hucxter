'use client';

import { ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useId, useMemo, useRef, useState } from 'react';
import { authHref } from '@/lib/next-path';
import { moveFocusWithArrows, useDismiss } from '@/lib/use-dismiss';
import styles from './header.module.css';

/**
 * Guest account control: "Sign in" with a menu offering Sign in and Create account, both returning
 * here afterwards. The member avatar menu arrives with accounts in Brief 03.
 */
export function AccountControl() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const here = query === '' ? pathname : `${pathname}?${query}`;

  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const refs = useMemo(() => [triggerRef, panelRef], []);
  const menuId = useId();

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);
  useDismiss(open, close, refs);

  return (
    <div className={styles.popoverAnchor}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.signInButton}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => {
          setOpen((value) => !value);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && !open) {
            event.preventDefault();
            setOpen(true);
            requestAnimationFrame(() => panelRef.current?.querySelector('a')?.focus());
          }
        }}
      >
        Sign in
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      <div
        ref={panelRef}
        id={menuId}
        className={styles.popover}
        hidden={!open}
        onKeyDown={(event) => {
          moveFocusWithArrows(event, panelRef.current);
        }}
      >
        <p className={styles.popoverNote}>Sign in to message sellers, save items, and sell.</p>
        <ul className={styles.popoverList}>
          <li>
            <Link
              href={authHref(here)}
              className={styles.popoverPrimary}
              onClick={() => {
                setOpen(false);
              }}
            >
              Sign in
            </Link>
          </li>
          <li>
            <Link
              href={authHref(here, '/sign-up')}
              className={styles.popoverLink}
              onClick={() => {
                setOpen(false);
              }}
            >
              Create account
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );
}
