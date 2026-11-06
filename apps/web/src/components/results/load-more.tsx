'use client';

import type { ListingCard } from '@hucxter/contracts';
import { useEffect, useRef, useState, useTransition } from 'react';
import { moreListings } from '@/app/actions/discovery';
import { ListingCardView } from '@/components/listing/listing-card';
import styles from './results.module.css';

/**
 * "Load more" (keyset). Without JavaScript it's a link to the next page; with it, the next page is
 * appended in place and focus moves to the first new card.
 */
function pageHref(action: string, search: string, after: string): string {
  const params = new URLSearchParams(search);
  params.set('after', after);
  return `${action}?${params.toString()}`;
}

export function LoadMore({
  action,
  cursor,
  search,
  departmentSlug,
  subcategorySlug,
}: {
  /** The results page path (/c/…, /search). */
  action: string;
  cursor: string;
  search: string;
  departmentSlug?: string | undefined;
  subcategorySlug?: string | undefined;
}) {
  const [items, setItems] = useState<ListingCard[]>([]);
  const [next, setNext] = useState<string | null>(cursor);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  // Index of the first card from the latest page, until focus has moved to it.
  const focusIndex = useRef<number | null>(null);
  const list = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (focusIndex.current === null) return;
    list.current?.querySelectorAll<HTMLAnchorElement>('a')[focusIndex.current]?.focus();
    focusIndex.current = null;
  }, [items]);

  const load = (after: string) => {
    startTransition(async () => {
      try {
        const page = await moreListings({ departmentSlug, subcategorySlug, search, after });
        if (page.items.length > 0) focusIndex.current = items.length;
        setItems((current) => [...current, ...page.items]);
        setNext(page.nextCursor);
        setFailed(false);
      } catch {
        setFailed(true);
      }
    });
  };

  return (
    <>
      {items.length === 0 ? null : (
        <ul ref={list} className={styles.grid} aria-label="More listings">
          {items.map((listing) => (
            <li key={listing.id}>
              <ListingCardView listing={listing} href={`/l/${listing.id}`} />
            </li>
          ))}
        </ul>
      )}
      {next === null ? null : (
        <div className={styles.loadMore}>
          <a
            href={pageHref(action, search, next)}
            className={styles.secondaryButton}
            aria-disabled={pending}
            onClick={(event) => {
              event.preventDefault();
              if (!pending) load(next);
            }}
          >
            {pending ? 'Loading…' : 'Load more'}
          </a>
          {failed ? (
            <p role="alert" className={styles.loadMoreError}>
              Couldn’t load more listings. Try again.
            </p>
          ) : null}
        </div>
      )}
    </>
  );
}
