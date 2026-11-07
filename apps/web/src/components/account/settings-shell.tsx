import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import styles from './settings.module.css';

export type SettingsPane = 'index' | 'profile' | 'account';

const LINKS = [
  { pane: 'profile', href: '/settings/profile', label: 'Edit profile' },
  { pane: 'account', href: '/settings/account', label: 'Account' },
] as const;

/**
 * Settings (Brief 03C.2 §4.4). Desktop: a left nav (Edit profile, Account) beside the pane; /settings
 * shows Edit profile. Phones: /settings is the list, and each pane is its own page with a back
 * link, so every form exists once per page.
 */
export function SettingsShell({
  current,
  title,
  children,
}: {
  current: SettingsPane;
  /** The pane's heading. */
  title: string;
  children: ReactNode;
}) {
  const shown = current === 'index' ? 'profile' : current;
  // One h1 per page: "Settings" on the index, the pane's title on a pane page.
  const SettingsHeading = current === 'index' ? 'h1' : 'p';
  const PaneHeading = current === 'index' ? 'h2' : 'h1';
  return (
    <div className={styles.shell} data-pane={current}>
      <div className={styles.navColumn}>
        <SettingsHeading className={styles.heading}>Settings</SettingsHeading>
        <nav aria-label="Settings" className={styles.nav}>
          <ul>
            {LINKS.map((link) => (
              <li key={link.pane}>
                <Link
                  href={link.href}
                  className={styles.navLink}
                  aria-current={link.pane === shown ? 'page' : undefined}
                >
                  <span>{link.label}</span>
                  <ChevronRight size={18} aria-hidden="true" className={styles.navChevron} />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <section className={styles.pane} aria-labelledby="settings-pane-title">
        <Link href="/settings" className={styles.back}>
          <ChevronLeft size={18} aria-hidden="true" /> Settings
        </Link>
        <PaneHeading id="settings-pane-title" className={styles.paneTitle}>
          {title}
        </PaneHeading>
        {children}
      </section>
    </div>
  );
}
