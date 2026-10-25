import type { Taxonomy } from '@hucxter/contracts';
import type { ReactNode } from 'react';
import { CategoryBar } from './category-bar';
import { SiteFooter } from './site-footer';
import { SiteHeader } from './site-header';
import styles from './layout.module.css';

/** Storefront frame for every page: header, category bar, main content, footer (ADR-0009). */
export function StoreShell({
  taxonomy,
  location,
  locationLabel,
  children,
}: {
  taxonomy: Taxonomy;
  location: ReactNode;
  locationLabel: string | null;
  children: ReactNode;
}) {
  return (
    <>
      <a href="#main" className={styles.skipLink}>
        Skip to content
      </a>
      <aside className={styles.desktopNotice} aria-label="Screen size">
        <p>Hucxter works best on a desktop browser.</p>
      </aside>
      <SiteHeader location={location} />
      <CategoryBar taxonomy={taxonomy} />
      <main id="main" tabIndex={-1} className={styles.main}>
        {children}
      </main>
      <SiteFooter taxonomy={taxonomy} locationLabel={locationLabel} />
    </>
  );
}
