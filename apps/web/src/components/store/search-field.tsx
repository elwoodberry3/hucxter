'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import styles from './header.module.css';

/** The header search input; on /search it shows the current query. */
export function SearchField() {
  const pathname = usePathname();
  const query = useSearchParams().get('q') ?? '';
  const value = pathname === '/search' ? query.slice(0, 100) : '';
  return (
    <input
      key={value}
      id="site-search"
      name="q"
      type="search"
      placeholder="Search Hucxter"
      autoComplete="off"
      maxLength={100}
      defaultValue={value}
      className={styles.searchInput}
    />
  );
}
