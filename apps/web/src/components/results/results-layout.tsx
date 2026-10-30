import type { AttributeFilter, ListingCard, ListingQuery, RadiusMi } from '@hucxter/contracts';
import { RADIUS_OPTIONS_MI, listingQueryParams } from '@hucxter/contracts';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { CategoryArt } from '@/components/art/category-art';
import { ListingCardView } from '@/components/listing/listing-card';
import { FilterPanel } from './filter-panel';
import { SortSelect } from './sort-select';
import styles from './results.module.css';

export interface EmptyStateCopy {
  title: string;
  sellLabel: string;
  heroKey: string;
}

/** Filter panel + results toolbar + grid, with a designed empty state (storefront-ia §4). */
export function ResultsLayout({
  action,
  query,
  filters,
  freeOnly,
  viewerRadiusMi,
  surface,
  listings,
  areaLabel,
  empty,
}: {
  action: string;
  query: ListingQuery;
  filters: AttributeFilter[];
  freeOnly: boolean;
  viewerRadiusMi: RadiusMi;
  surface: 'category' | 'search';
  listings: ListingCard[];
  areaLabel: string | null;
  empty: EmptyStateCopy;
}) {
  const radius = query.distanceMi ?? viewerRadiusMi;
  const wider = RADIUS_OPTIONS_MI.find((option) => option > radius);
  const near =
    areaLabel === null
      ? `within ${String(radius)} mi`
      : `within ${String(radius)} mi of ${areaLabel}`;
  const widerHref = (() => {
    if (wider === undefined) return null;
    const search = listingQueryParams({ ...query, distanceMi: wider }).toString();
    return `${action}?${search}`;
  })();

  return (
    <div className={styles.layout}>
      <FilterPanel
        action={action}
        query={query}
        filters={filters}
        freeOnly={freeOnly}
        defaultDistanceMi={viewerRadiusMi}
        surface={surface}
      />
      <section className={styles.results} aria-labelledby="results-heading">
        <div className={styles.toolbar}>
          <h2 id="results-heading" className={styles.resultCount}>
            {listings.length === 0
              ? `No listings ${near} yet`
              : `${String(listings.length)} ${listings.length === 1 ? 'listing' : 'listings'} ${near}`}
          </h2>
          <SortSelect action={action} query={query} className={styles.sort} />
        </div>
        {listings.length > 0 ? (
          <ul className={styles.grid}>
            {listings.map((listing) => (
              <li key={listing.id}>
                <ListingCardView listing={listing} href={`/l/${listing.id}`} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            copy={empty}
            widerHref={widerHref}
            widerLabel={wider === undefined ? null : `Widen to ${String(wider)} mi`}
          />
        )}
      </section>
    </div>
  );
}

function EmptyState({
  copy,
  widerHref,
  widerLabel,
}: {
  copy: EmptyStateCopy;
  widerHref: string | null;
  widerLabel: string | null;
}) {
  return (
    <div className={styles.empty}>
      <div className={styles.emptyArt}>
        <CategoryArt heroKey={copy.heroKey} size="banner" />
      </div>
      <h3 className={styles.emptyTitle}>{copy.title}</h3>
      <p className={styles.emptyBody}>
        Hucxter is new here, so listings are still arriving. Be the first to post, or look a little
        farther out.
      </p>
      <div className={styles.emptyActions}>
        <Link href="/sell" className={styles.primaryButton}>
          <Plus size={16} aria-hidden="true" />
          {copy.sellLabel}
        </Link>
        {widerHref === null || widerLabel === null ? null : (
          <Link href={widerHref} className={styles.secondaryButton}>
            {widerLabel}
          </Link>
        )}
        <Link href="/#shop-by-category" className={styles.secondaryButton}>
          Browse all categories
        </Link>
      </div>
    </div>
  );
}

export function Breadcrumb({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
      <ol>
        {items.map((item, index) => (
          <li key={item.label}>
            {item.href === undefined || index === items.length - 1 ? (
              <span aria-current="page">{item.label}</span>
            ) : (
              <Link href={item.href}>{item.label}</Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function SubcategoryRow({
  department,
  activeSlug,
}: {
  department: { slug: string; name: string; subcategories: { slug: string; name: string }[] };
  activeSlug: string | undefined;
}) {
  return (
    <nav aria-label={`${department.name} subcategories`} className={styles.chips}>
      <ul>
        <li>
          <Link
            href={`/c/${department.slug}`}
            className={styles.chip}
            aria-current={activeSlug === undefined ? 'page' : undefined}
          >
            All {department.name}
          </Link>
        </li>
        {department.subcategories.map((subcategory) => (
          <li key={subcategory.slug}>
            <Link
              href={`/c/${department.slug}/${subcategory.slug}`}
              className={styles.chip}
              aria-current={activeSlug === subcategory.slug ? 'page' : undefined}
            >
              {subcategory.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function CategoryHero({
  title,
  eyebrow,
  heroKey,
  notice,
}: {
  title: string;
  eyebrow: string | null;
  heroKey: string;
  notice: string | undefined;
}): ReactNode {
  return (
    <header className={styles.hero}>
      <div className={styles.heroCopy}>
        {eyebrow === null ? null : <p className={styles.heroEyebrow}>{eyebrow}</p>}
        <h1 className={styles.heroTitle}>{title}</h1>
        {notice === undefined ? null : <p className={styles.notice}>{notice}</p>}
      </div>
      <div className={styles.heroArt}>
        <CategoryArt heroKey={heroKey} size="banner" />
      </div>
    </header>
  );
}
