import type { Metadata } from 'next';
import Link from 'next/link';
import { DiscoverFeed } from '@/components/discover/discover-feed';
import styles from '@/components/discover/discover.module.css';
import { WidenRadiusButton } from '@/components/discover/widen-radius';
import homeStyles from '@/components/home/home.module.css';
import { EmptyState } from '@/components/ui/empty-state';
import { getViewerLocation } from '@/lib/viewer-location';
import { discoverPage } from '@/server/discover';

export const metadata: Metadata = { title: 'Discover' };

/**
 * Discover (Brief 03 Milestone 3D): the vertical video feed of live listings within the viewer's
 * radius, newest first. `?l=<id>` starts at that item when it is in the viewer's feed.
 */
export default async function DiscoverPage({ searchParams }: PageProps<'/discover'>) {
  const raw = (await searchParams).l;
  const startAt = Array.isArray(raw) ? raw[0] : raw;
  const location = await getViewerLocation();
  const page = await discoverPage(
    { zip: location?.zip ?? null, radiusMi: location?.radiusMi },
    { startAt },
  );

  if (page.items.length === 0) {
    const area = location?.areaLabel ?? 'you';
    return (
      <div className={styles.empty}>
        <h1 className="visually-hidden">Discover</h1>
        <EmptyState
          headingLevel={2}
          title={`No videos near ${area} yet.`}
          body="When people nearby post an item, its video shows up here."
          actions={
            <>
              <Link href="/sell" className={homeStyles.primaryButton}>
                Sell something
              </Link>
              {location === null ? null : (
                <WidenRadiusButton
                  zip={location.zip}
                  radiusMi={location.radiusMi}
                  className={`${homeStyles.secondaryButton ?? ''} ${styles.widen ?? ''}`}
                />
              )}
            </>
          }
        />
      </div>
    );
  }

  return (
    <>
      <h1 className="visually-hidden">Discover</h1>
      <DiscoverFeed
        // A new start item (shared link, Back to newest) starts a fresh feed.
        key={page.startId ?? 'newest'}
        items={page.items}
        nextCursor={page.nextCursor}
        startMissingId={page.startMissing ? (startAt ?? null) : null}
        startedMidway={page.startedMidway}
      />
    </>
  );
}
