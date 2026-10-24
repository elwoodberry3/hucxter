import { CircleUser, MessageCircle, Plus, Search } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { SidebarNav } from './sidebar-nav';
import styles from './shell.module.css';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <a href="#main" className={styles.skipLink}>
        Skip to content
      </a>
      <aside className={styles.desktopNotice} aria-label="Screen size">
        <p>Hucxter works best on a desktop browser.</p>
      </aside>
      <div className={styles.shell}>
        <nav className={styles.sidebar} aria-label="Primary">
          <Link href="/" className={styles.brand} title="Hucxter">
            {/* Plain <img>: next/image adds an inline style attribute that the strict CSP blocks. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon-192.png" alt="" width={28} height={28} className={styles.mark} />
            <span className={styles.navLabel}>Hucxter</span>
          </Link>
          <SidebarNav />
        </nav>
        <div className={styles.column}>
          <header className={styles.toolbar}>
            <form role="search" action="/search" method="get" className={styles.search}>
              <label htmlFor="toolbar-search" className="visually-hidden">
                Search listings
              </label>
              <Search size={16} aria-hidden="true" className={styles.searchIcon} />
              <input
                id="toolbar-search"
                name="q"
                type="search"
                placeholder="Search nearby"
                autoComplete="off"
                className={styles.searchInput}
              />
            </form>
            <div className={styles.toolbarActions}>
              <Link href="/sell" className={styles.primaryButton}>
                <Plus size={16} aria-hidden="true" />
                Sell
              </Link>
              <Link
                href="/messages"
                className={styles.iconButton}
                aria-label="Messages"
                title="Messages"
              >
                <MessageCircle size={20} aria-hidden="true" />
              </Link>
              <Link
                href="/profile"
                className={styles.iconButton}
                aria-label="Profile"
                title="Profile"
              >
                <CircleUser size={20} aria-hidden="true" />
              </Link>
            </div>
          </header>
          <main id="main" tabIndex={-1} className={styles.main}>
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
