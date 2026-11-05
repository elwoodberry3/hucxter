import { DEFAULT_RADIUS_MI } from '@hucxter/contracts';
import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { LaunchNotice } from '@/components/store/launch-notice';
import { LocationChip } from '@/components/store/location-chip';
import { StoreShell } from '@/components/store/store-shell';
import { LAUNCH_NOTICE_COOKIE, launchNoticeFor } from '@/lib/service-areas';
import { getTaxonomy } from '@/lib/taxonomy';
import { getViewerLocation, locationText } from '@/lib/viewer-location';

export default async function StoreLayout({ children }: { children: ReactNode }) {
  const [taxonomy, location, cookieStore] = await Promise.all([
    getTaxonomy(),
    getViewerLocation(),
    cookies(),
  ]);
  const dismissed = cookieStore.get(LAUNCH_NOTICE_COOKIE)?.value === 'dismissed';
  const launchNotice = dismissed ? null : await launchNoticeFor(location?.zip ?? null);
  return (
    <StoreShell
      taxonomy={taxonomy}
      location={<LocationChip location={location} defaultRadiusMi={DEFAULT_RADIUS_MI} />}
      locationLabel={locationText(location)}
      notice={launchNotice === null ? undefined : <LaunchNotice message={launchNotice} />}
    >
      {children}
    </StoreShell>
  );
}
