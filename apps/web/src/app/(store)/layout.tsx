import { DEFAULT_RADIUS_MI } from '@hucxter/contracts';
import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { LaunchNotice } from '@/components/store/launch-notice';
import { LocationChip } from '@/components/store/location-chip';
import { StaleSessionCleanup } from '@/components/store/stale-session-cleanup';
import { StoreShell } from '@/components/store/store-shell';
import { authConfig } from '@/lib/env';
import { LAUNCH_NOTICE_COOKIE, launchNoticeFor } from '@/lib/service-areas';
import { getTaxonomy } from '@/lib/taxonomy';
import { getViewerSummary } from '@/lib/viewer';
import { getViewerLocation, locationText } from '@/lib/viewer-location';
import { sessionIsStale } from '@/server/supabase-server';

export default async function StoreLayout({ children }: { children: ReactNode }) {
  const [taxonomy, location, cookieStore, viewer] = await Promise.all([
    getTaxonomy(),
    getViewerLocation(),
    cookies(),
    getViewerSummary(),
  ]);
  const dismissed = cookieStore.get(LAUNCH_NOTICE_COOKIE)?.value === 'dismissed';
  const launchNotice = dismissed ? null : await launchNoticeFor(location?.zip ?? null);
  const { captcha } = authConfig();
  return (
    <StoreShell
      taxonomy={taxonomy}
      location={<LocationChip location={location} defaultRadiusMi={DEFAULT_RADIUS_MI} />}
      locationLabel={locationText(location)}
      notice={launchNotice === null ? undefined : <LaunchNotice message={launchNotice} />}
      captchaSiteKey={captcha.provider === 'turnstile' ? captcha.siteKey : null}
      viewer={viewer}
    >
      {children}
      {sessionIsStale() ? <StaleSessionCleanup /> : null}
    </StoreShell>
  );
}
