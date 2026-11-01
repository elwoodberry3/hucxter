import { Compass, MessageCircle, Plus, Search } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { AccountControl } from './account-control';
import { HeaderBack } from './header-back';
import { HxLogo } from './hx-logo';
import { MobileSearch } from './mobile-search';
import { SearchField } from './search-field';
import styles from './header.module.css';

/**
 * Global header (storefront-ia §1). Desktop: logo, location, the one search field, Discover, Sell,
 * Messages, account. Phones (ADR-0011): compact — logo, location, a search button; the tab bar
 * holds the rest. Product pages on phones get a Back button.
 */
export function SiteHeader({ location }: { location: ReactNode }) {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <HeaderBack />
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
        <MobileSearch />
        <nav aria-label="Account" className={styles.actions}>
          <Link href="/discover" className={styles.textButton}>
            <Compass size={20} aria-hidden="true" />
            Discover
          </Link>
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
