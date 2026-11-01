import type { Taxonomy } from '@hucxter/contracts';
import type { ReactNode } from 'react';
import { SignInSheetProvider } from '@/components/auth/sign-in-sheet';
import { TabBar } from '@/components/ui/tab-bar';
import { ToastProvider } from '@/components/ui/toast';
import { CategoryBar } from './category-bar';
import { HideOnProduct } from './hide-on-product';
import { SiteFooter } from './site-footer';
import { SiteHeader } from './site-header';
import styles from './layout.module.css';

/**
 * Storefront frame for every page: header, category bar, main content, footer (ADR-0009), plus the
 * phone tab bar (ADR-0011).
 */
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
    <ToastProvider>
      <SignInSheetProvider>
        <a href="#main" className={styles.skipLink}>
          Skip to content
        </a>
        <SiteHeader location={location} />
        <HideOnProduct>
          <CategoryBar taxonomy={taxonomy} />
        </HideOnProduct>
        <main id="main" tabIndex={-1} className={styles.main}>
          {children}
        </main>
        <SiteFooter taxonomy={taxonomy} locationLabel={locationLabel} />
        <TabBar />
      </SignInSheetProvider>
    </ToastProvider>
  );
}
