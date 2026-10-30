import { MessageCircle, Plus, Search } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { AccountControl } from './account-control';
import { HxLogo } from './hx-logo';
import { SearchField } from './search-field';
import styles from './header.module.css';

/** Global header (storefront-ia §1): logo, location, the one search field, Sell, Messages, account. */
export function SiteHeader({ location }: { location: ReactNode }) {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <HxLogo />
        {location}
        <form role="search" action="/search" method="get" className={styles.search}>
          <label htmlFor="site-search" className="visually-hidden">
            Search Hucxter
          </label>
          <SearchField />
          <button type="submit" className={styles.searchButton} aria-label="Search">
            <Search size={18} aria-hidden="true" />
          </button>
        </form>
        <nav aria-label="Account" className={styles.actions}>
          <Link href="/sell" className={styles.sellButton}>
            <Plus size={18} aria-hidden="true" />
            Sell
          </Link>
          <Link
            href="/messages"
            className={styles.iconButton}
            aria-label="Messages"
            title="Messages"
          >
            <MessageCircle size={22} aria-hidden="true" />
          </Link>
          <AccountControl />
        </nav>
      </div>
    </header>
  );
}
