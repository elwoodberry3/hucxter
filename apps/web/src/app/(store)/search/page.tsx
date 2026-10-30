import { DEFAULT_RADIUS_MI, parseListingQuery } from '@hucxter/contracts';
import type { Metadata } from 'next';
import { Breadcrumb, ResultsLayout } from '@/components/results/results-layout';
import styles from '@/components/results/results.module.css';
import { searchListings } from '@/lib/listings';
import { getViewerLocation } from '@/lib/viewer-location';

export const metadata: Metadata = { title: 'Search' };

/** Search results: same layout and empty state as category pages; the query is echoed as text. */
export default async function SearchPage({ searchParams }: PageProps<'/search'>) {
  const query = parseListingQuery(await searchParams);
  const location = await getViewerLocation();
  const page = await searchListings({ query, zip: location?.zip ?? null, limit: 24 });
  const near = location === null ? 'near you' : `near ${location.areaLabel}`;
  const title = query.q === undefined ? 'All listings' : `Results for “${query.q}”`;

  return (
    <>
      <Breadcrumb items={[{ label: 'Feed', href: '/' }, { label: 'Search' }]} />
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.heroEyebrow}>Search</p>
          <h1 className={styles.heroTitle}>{title}</h1>
        </div>
      </header>
      <ResultsLayout
        action="/search"
        query={query}
        filters={[]}
        freeOnly={false}
        viewerRadiusMi={location?.radiusMi ?? DEFAULT_RADIUS_MI}
        surface="search"
        listings={page.items}
        areaLabel={location?.areaLabel ?? null}
        empty={{
          title:
            query.q === undefined
              ? `Nothing listed ${near} yet`
              : `No results for “${query.q}” ${near} yet`,
          sellLabel: 'Sell an item',
          heroKey: 'misc',
        }}
      />
    </>
  );
}
