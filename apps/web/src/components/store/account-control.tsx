'use client';

import { ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useId, useMemo, useRef, useState } from 'react';
import { signOut } from '@/app/actions/account';
import { useViewer } from '@/components/auth/viewer-context';
import { Avatar } from '@/components/ui/avatar';
import { authHref } from '@/lib/next-path';
import { moveFocusWithArrows, useDismiss } from '@/lib/use-dismiss';
import styles from './header.module.css';

const MEMBER_LINKS = [
  { href: '/messages', label: 'Messages' },
  { href: '/settings', label: 'Settings' },
] as const;

/**
 * Account control. Guests: "Sign in" with Sign in / Create account, both returning here.
 * Members (Brief 03C.2): an avatar menu headed by their photo and name (truncated; the full name
 * is in the accessible names) with View profile, then Messages, Settings, Admin for staff and
 * Sign out. Unverified members also get "Finish setting up".
 */
export function AccountControl() {
  const viewer = useViewer();
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

  const member = viewer.status !== 'guest';

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
        {member ? (
          <>
            <Avatar name={viewer.displayName} src={viewer.avatarUrl} size="sm" />
            <span className="visually-hidden">
              {viewer.displayName === null
                ? 'Account menu'
                : `Account menu for ${viewer.displayName}`}
            </span>
          </>
        ) : (
          'Sign in'
        )}
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
        {member ? (
          <>
            {viewer.displayName === null ? null : (
              <div className={styles.memberCard}>
                <Avatar name={viewer.displayName} src={viewer.avatarUrl} size="md" />
                <div className={styles.memberText}>
                  <p className={styles.memberName} title={viewer.displayName}>
                    {viewer.displayName}
                  </p>
                  {viewer.handle === null ? null : (
                    <p className={styles.memberHandle}>@{viewer.handle}</p>
                  )}
                </div>
              </div>
            )}
            <ul className={styles.popoverList}>
              {viewer.handle === null || viewer.status !== 'verified' ? null : (
                <li>
                  <Link
                    href={`/u/${viewer.handle}`}
                    className={styles.popoverPrimary}
                    aria-label={
                      viewer.displayName === null
                        ? 'View profile'
                        : `View profile: ${viewer.displayName}`
                    }
                    onClick={() => {
                      setOpen(false);
                    }}
                  >
                    View profile
                  </Link>
                </li>
              )}
              {viewer.status === 'unverified' ? (
                <li>
                  <Link
                    href="/welcome"
                    className={styles.popoverPrimary}
                    onClick={() => {
                      setOpen(false);
                    }}
                  >
                    Finish setting up
                  </Link>
                </li>
              ) : null}
              {MEMBER_LINKS.map(({ href, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className={styles.popoverLink}
                    onClick={() => {
                      setOpen(false);
                    }}
                  >
                    {label}
                  </Link>
                </li>
              ))}
              {viewer.isStaff ? (
                <li>
                  <Link
                    href="/admin"
                    className={styles.popoverLink}
                    onClick={() => {
                      setOpen(false);
                    }}
                  >
                    Admin
                  </Link>
                </li>
              ) : null}
              <li>
                <form action={signOut}>
                  <button type="submit" className={styles.popoverLink}>
                    Sign out
                  </button>
                </form>
              </li>
            </ul>
          </>
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  );
}
