import type { Metadata } from 'next';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { OwnListingRow } from '@/components/listings/own-listing-row';
import styles from '@/components/listings/listings.module.css';
import { EmptyState } from '@/components/ui/empty-state';
import { requireVerifiedMember } from '@/server/auth/gate';
import { OWN_TABS, decodeOwnCursor, loadOwnListings } from '@/server/listings/owner';
import type { OwnTab } from '@/server/listings/owner';
import { sessionClient } from '@/server/supabase-server';

export const metadata: Metadata = { title: 'My Listings', robots: { index: false } };

const TAB_LABELS: Record<OwnTab, string> = {
  drafts: 'Drafts',
  processing: 'Processing',
  live: 'Live',
  review: 'In review',
  sold: 'Sold',
};

const EMPTY: Record<OwnTab, { title: string; body: string }> = {
  drafts: { title: 'No drafts', body: 'Listings you start and don’t publish wait here.' },
  processing: {
    title: 'Nothing processing',
    body: 'Videos you’ve uploaded show here while they’re being prepared.',
  },
  live: { title: 'Nothing live yet', body: 'Publish a listing and buyers nearby can find it.' },
  review: {
    title: 'Nothing in review',
    body: 'If a listing needs a check before it goes live, it waits here.',
  },
  sold: { title: 'Nothing sold yet', body: 'Mark a listing sold and it moves here.' },
};

const PAGE_SIZE = 20;

/** My Listings (Brief 03C.1 §3.6): verified members only (D-34). */
export default async function Page({ searchParams }: PageProps<'/listings'>) {
  const params = await searchParams;
  const tabParam = typeof params.tab === 'string' ? params.tab : undefined;
  const tab: OwnTab = OWN_TABS.find((t) => t === tabParam) ?? 'live';
  const next = tab === 'live' ? '/listings' : `/listings?tab=${tab}`;
  await requireVerifiedMember(next, 'listings');
  const before = decodeOwnCursor(typeof params.after === 'string' ? params.after : undefined);
  const page = await loadOwnListings(await sessionClient(), { tab, limit: PAGE_SIZE, before });
  const tabHref = (t: OwnTab) => (t === 'live' ? '/listings' : `/listings?tab=${t}`);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.heading}>My Listings</h1>
        <Link href="/sell" className={styles.primary}>
          <Plus size={16} aria-hidden="true" /> Sell an item
        </Link>
      </div>
      {params.deleted === '1' ? (
        <p role="status" className={styles.notice}>
          Listing deleted.
        </p>
      ) : null}
      <nav aria-label="Listing status" className={styles.tabs}>
        <ul>
          {OWN_TABS.map((t) => (
            <li key={t}>
              <Link
                href={tabHref(t)}
                className={styles.tab}
                aria-current={t === tab ? 'page' : undefined}
              >
                {TAB_LABELS[t]}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <section aria-labelledby="tab-heading">
        <h2 id="tab-heading" className="visually-hidden">
          {TAB_LABELS[tab]}
        </h2>
        {page.items.length === 0 ? (
          <EmptyState
            title={before === null ? EMPTY[tab].title : 'No more listings'}
            body={EMPTY[tab].body}
            actions={
              <Link href="/sell" className={styles.primary}>
                Sell an item
              </Link>
            }
          />
        ) : (
          <ul className={styles.list}>
            {page.items.map((listing) => (
              <OwnListingRow key={listing.id} listing={listing} tab={tab} />
            ))}
          </ul>
        )}
        {page.nextCursor === null ? null : (
          <div className={styles.more}>
            <Link
              href={`${tabHref(tab)}${tab === 'live' ? '?' : '&'}after=${page.nextCursor}`}
              className={styles.button}
            >
              Older listings
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
