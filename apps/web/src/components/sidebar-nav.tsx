'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_ITEMS } from './nav-items';
import styles from './shell.module.css';

export function SidebarNav() {
  const pathname = usePathname();
  return (
    <ul className={styles.navList}>
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const current = href === '/' ? pathname === '/' : pathname.startsWith(href);
        return (
          <li key={href}>
            <Link
              href={href}
              className={styles.navLink}
              aria-current={current ? 'page' : undefined}
              title={label}
            >
              <Icon size={20} aria-hidden="true" />
              <span className={styles.navLabel}>{label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
