'use client';

import { Search } from 'lucide-react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import styles from './header.module.css';

/** Phone search: a header button opens a full-screen sheet holding the search field. */
export function MobileSearch() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const query = useSearchParams().get('q') ?? '';
  return (
    <>
      <button
        type="button"
        className={styles.mobileSearchButton}
        aria-label="Search Hucxter"
        aria-haspopup="dialog"
        onClick={() => {
          setOpen(true);
        }}
      >
        <Search size={22} aria-hidden="true" />
      </button>
      <BottomSheet
        open={open}
        size="full"
        title="Search"
        onClose={() => {
          setOpen(false);
        }}
      >
        <form role="search" action="/search" method="get" className={styles.sheetSearch}>
          <label htmlFor="mobile-search" className="visually-hidden">
            Search Hucxter
          </label>
          <input
            id="mobile-search"
            name="q"
            type="search"
            enterKeyHint="search"
            placeholder="Search Hucxter"
            autoComplete="off"
            maxLength={100}
            defaultValue={pathname === '/search' ? query.slice(0, 100) : ''}
            className={styles.sheetSearchInput}
            data-autofocus
          />
          <button type="submit" className={styles.sheetSearchSubmit}>
            Search
          </button>
        </form>
      </BottomSheet>
    </>
  );
}
