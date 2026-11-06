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
export function TabBar() {
  const pathname = usePathname();
  const query = useSearchParams().toString();
  const here = query === '' ? pathname : `${pathname}?${query}`;
  const [typing, setTyping] = useState(false);
  const viewer = useViewer();

  useEffect(() => {
    const update = () => {
      setTyping(isEditable(document.activeElement));
    };
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', update);
    return () => {
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
      // Members: Settings (unverified members are sent on to /welcome by its gate).
      href:
        viewer.status !== 'guest'
          ? '/settings'
          : pathname === '/sign-in' || pathname === '/sign-up'
            ? '/sign-in'
            : authHref(here),
      icon: CircleUser,
      match: (p) => ['/sign-in', '/sign-up', '/profile', '/settings', '/welcome'].includes(p),
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
