'use client';

import { CircleUser, Compass, House, Inbox, SquarePlus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useViewer } from '@/components/auth/viewer-context';
import { authHref } from '@/lib/next-path';
import { isProductPath } from '@/lib/routes';
import styles from './tab-bar.module.css';

interface Tab {
  label: string;
  href: string;
  icon: LucideIcon;
  match: (pathname: string) => boolean;
}

function isEditable(element: Element | null): boolean {
  if (!(element instanceof HTMLElement)) return false;
  if (element.isContentEditable || element instanceof HTMLTextAreaElement) return true;
  return (
    element instanceof HTMLInputElement &&
    !['button', 'checkbox', 'radio', 'submit', 'reset', 'range', 'color', 'file'].includes(
      element.type,
    )
  );
}

/**
 * Phone bottom tab bar (ADR-0011): Home · Discover · Sell · Inbox · Account. Hidden at desktop widths
 * by CSS, hidden on product pages (the sticky action bar takes its place), and hidden while a text
 * field has focus so it never covers the on-screen keyboard.
 */
/** About the on-screen keyboard's closing animation. */
const SHOW_AFTER_BLUR_MS = 300;

export function TabBar() {
  const pathname = usePathname();
  const query = useSearchParams().toString();
  const here = query === '' ? pathname : `${pathname}?${query}`;
  const [typing, setTyping] = useState(false);
  const viewer = useViewer();

  useEffect(() => {
    // Hide at once when a field gets focus; come back only after the keyboard has had time to
    // close. Showing it on blur straight away put the bar under a tap that was still landing
    // (tapping "Continue" just after typing hit the bar instead).
    let timer: number | undefined;
    const update = () => {
      window.clearTimeout(timer);
      if (isEditable(document.activeElement)) {
        setTyping(true);
        return;
      }
      timer = window.setTimeout(() => {
        setTyping(isEditable(document.activeElement));
      }, SHOW_AFTER_BLUR_MS);
    };
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', update);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', update);
    };
  }, []);

  if (isProductPath(pathname)) return null;

  const tabs: Tab[] = [
    {
      label: 'Home',
      href: '/',
      icon: House,
      match: (p) => p === '/' || p.startsWith('/c/') || p === '/search',
    },
    { label: 'Discover', href: '/discover', icon: Compass, match: (p) => p === '/discover' },
    { label: 'Sell', href: '/sell', icon: SquarePlus, match: (p) => p === '/sell' },
    { label: 'Inbox', href: '/messages', icon: Inbox, match: (p) => p === '/messages' },
    {
      label: 'Account',
      // Members: their profile (/profile redirects; unverified members go on to /welcome).
      href:
        viewer.status !== 'guest'
          ? viewer.handle === null
            ? '/profile'
            : `/u/${viewer.handle}`
          : pathname === '/sign-in' || pathname === '/sign-up'
            ? '/sign-in'
            : authHref(here),
      icon: CircleUser,
      match: (p) =>
        ['/sign-in', '/sign-up', '/profile', '/welcome'].includes(p) ||
        p === '/settings' ||
        p.startsWith('/settings/') ||
        (viewer.handle !== null && p === `/u/${viewer.handle}`),
    },
  ];

  return (
    <nav aria-label="Main" className={styles.bar} data-hidden={typing ? 'true' : undefined}>
      <ul className={styles.list}>
        {tabs.map(({ label, href, icon: Icon, match }) => (
          <li key={label}>
            <Link
              href={href}
              className={styles.tab}
              aria-current={match(pathname) ? 'page' : undefined}
            >
              <Icon size={22} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
