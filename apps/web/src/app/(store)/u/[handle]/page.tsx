import type { Metadata } from 'next';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';
import { ProfileHeader } from '@/components/profile/profile-header';
import { ProfileTileView } from '@/components/profile/profile-tile';
import styles from '@/components/profile/profile.module.css';
import { UrlSelect } from '@/components/profile/url-select';
import { EmptyState } from '@/components/ui/empty-state';
import {
  OWNER_FILTERS,
  PROFILE_SORTS,
  PROFILE_TABS,
  decodeProfileCursor,
  loadProfile,
  loadProfileListings,
  loadSavedListings,
} from '@/server/profile/load';
import type { OwnerFilter, ProfileSort, ProfileTab, TilePage } from '@/server/profile/load';
import { getViewer } from '@/lib/viewer';
import { savedAmong } from '@/server/saves';
import { sessionClient } from '@/server/supabase-server';

const TAB_LABELS: Record<ProfileTab, string> = {
  listings: 'Listings',
  sold: 'Sold',
  saved: 'Saved',
};

const FILTER_LABELS: Record<OwnerFilter, string> = {
  all: 'All',
  live: 'Live',
  pending: 'Pending',
  drafts: 'Drafts',
  review: 'In review',
};

const SORT_LABELS: Record<ProfileSort, string> = {
  newest: 'Newest',
  oldest: 'Oldest',
  price_asc: 'Price: low to high',
  price_desc: 'Price: high to low',
};

const getProfile = cache(async (handle: string) => loadProfile(await sessionClient(), handle));

function pick<T extends string>(options: readonly T[], value: unknown, fallback: T): T {
  return options.find((option) => option === value) ?? fallback;
}

interface ViewState {
  tab: ProfileTab;
  filter: OwnerFilter;
  sort: ProfileSort;
}

function href(handle: string, state: ViewState, after?: string): string {
  const params = new URLSearchParams();
  if (state.tab !== 'listings') params.set('tab', state.tab);
  if (state.tab === 'listings' && state.filter !== 'all') params.set('filter', state.filter);
  if (state.sort !== 'newest') params.set('sort', state.sort);
  if (after !== undefined) params.set('after', after);
  const search = params.toString();
  return search === '' ? `/u/${handle}` : `/u/${handle}?${search}`;
}

export async function generateMetadata({ params }: PageProps<'/u/[handle]'>): Promise<Metadata> {
  const { handle } = await params;
  const profile = await getProfile(decodeURIComponent(handle));
  if (profile === null) return { title: 'Profile not found', robots: { index: false } };
  return { title: `${profile.displayName} (@${profile.handle})`, robots: { index: false } };
}

/**
 * Profile (Brief 03C.2 §4.2). Everyone sees Listings (available and pending) and Sold. The owner
 * also gets filter chips for every stage, view counts, and Saved: this replaces /listings.
 */
export default async function Page({ params, searchParams }: PageProps<'/u/[handle]'>) {
  const { handle: rawHandle } = await params;
  const raw = decodeURIComponent(rawHandle);
  const query = await searchParams;
  const profile = await getProfile(raw);
  if (profile === null) notFound();
  if (raw !== profile.handle) redirect(`/u/${profile.handle}`);

  const owner = profile.isOwner;
  const tabs = owner ? PROFILE_TABS : PROFILE_TABS.filter((t) => t !== 'saved');
  const state: ViewState = {
    tab: pick(tabs, query.tab, 'listings'),
    filter: owner ? pick(OWNER_FILTERS, query.filter, 'all') : 'all',
    sort: pick(PROFILE_SORTS, query.sort, 'newest'),
  };
  const after = decodeProfileCursor(typeof query.after === 'string' ? query.after : undefined);

  const [db, viewer] = await Promise.all([sessionClient(), getViewer()]);
  let page: TilePage;
  if (state.tab === 'saved') {
    page = await loadSavedListings(db, { sort: state.sort, after });
  } else {
    page = await loadProfileListings(db, {
      handle: profile.handle,
      filter: state.tab === 'sold' ? 'sold' : owner ? state.filter : 'listings',
      sort: state.sort,
      after,
    });
  }

  // Save toggles: on the owner's Saved tab (to unsave), and on other members' live listings.
  const savedIds =
    state.tab === 'saved'
      ? new Set(page.items.map((tile) => tile.id))
      : owner || viewer.kind === 'guest'
        ? new Set<string>()
        : await savedAmong(
            db,
            page.items.map((tile) => tile.id),
          );
  const showSave = (status: string) => status !== 'sold' && (state.tab === 'saved' || !owner);
  const empty = emptyCopy(state, owner, after !== null);

  return (
    <div className={styles.page}>
      <ProfileHeader profile={profile} verified={viewer.kind === 'member' && viewer.verified} />
      <section className={styles.content} aria-labelledby="profile-tab-heading">
        {owner && query.deleted === '1' ? (
          <p role="status" className={styles.notice}>
            Listing deleted.
          </p>
        ) : null}
        <div className={styles.toolbar}>
          <nav aria-label="Profile sections" className={styles.tabs}>
            <ul>
              {tabs.map((t) => (
                <li key={t}>
                  <Link
                    href={href(profile.handle, { tab: t, filter: 'all', sort: state.sort })}
                    className={styles.tab}
                    aria-current={t === state.tab ? 'page' : undefined}
                  >
                    {TAB_LABELS[t]}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <UrlSelect
            label="Sort by"
            value={state.sort}
            className={styles.sort}
            options={PROFILE_SORTS.map((s) => ({
              value: s,
              label: SORT_LABELS[s],
              href: href(profile.handle, { ...state, sort: s }),
            }))}
          />
        </div>
        <h2 id="profile-tab-heading" className="visually-hidden">
          {TAB_LABELS[state.tab]}
          {owner && state.tab === 'listings' ? `: ${FILTER_LABELS[state.filter]}` : ''}
        </h2>
        {owner && state.tab === 'listings' ? (
          <nav aria-label="Listing status" className={styles.chips}>
            <ul>
              {OWNER_FILTERS.map((f) => (
                <li key={f}>
                  <Link
                    href={href(profile.handle, { ...state, filter: f })}
                    className={styles.chip}
                    aria-current={f === state.filter ? 'page' : undefined}
                  >
                    {FILTER_LABELS[f]}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
        {page.items.length === 0 ? (
          <EmptyState
            title={empty.title}
            body={empty.body}
            actions={
              owner && state.tab === 'listings' && state.filter === 'all' && after === null ? (
                <Link href="/sell" className={styles.primary}>
                  <Plus size={16} aria-hidden="true" /> Post your first item
                </Link>
              ) : undefined
            }
          />
        ) : (
          <ul className={styles.grid}>
            {page.items.map((tile) => (
              <li key={tile.id}>
                <ProfileTileView
                  tile={tile}
                  owner={owner && state.tab !== 'saved'}
                  saved={showSave(tile.status) ? savedIds.has(tile.id) : undefined}
                />
              </li>
            ))}
          </ul>
        )}
        {page.nextCursor === null ? null : (
          <div className={styles.more}>
            <Link href={href(profile.handle, state, page.nextCursor)} className={styles.button}>
              Load more
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}

function emptyCopy(
  state: ViewState,
  owner: boolean,
  paged: boolean,
): { title: string; body: string } {
  if (paged) return { title: 'No more items', body: 'That’s everything here.' };
  if (state.tab === 'saved') {
    return {
      title: 'Nothing saved yet',
      body: 'Tap Save on a listing to keep it here. Only you can see what you save.',
    };
  }
  if (state.tab === 'sold') {
    return owner
      ? { title: 'Nothing sold yet', body: 'Mark a listing sold and it moves here.' }
      : { title: 'Nothing sold yet', body: 'Items this member sells show here.' };
  }
  if (!owner) return { title: 'No items yet', body: 'This member has nothing listed right now.' };
  if (state.filter === 'all') {
    return { title: 'No items yet', body: 'Post a short video of something to sell nearby.' };
  }
  return {
    title: `Nothing in ${FILTER_LABELS[state.filter]}`,
    body: 'Listings at this stage show here.',
  };
}
