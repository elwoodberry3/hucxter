import { DEFAULT_RADIUS_MI } from '@hucxter/contracts';
import type { ReactNode } from 'react';
import { LocationChip } from '@/components/store/location-chip';
import { StoreShell } from '@/components/store/store-shell';
import { getTaxonomy } from '@/lib/taxonomy';
import { getViewerLocation, locationText } from '@/lib/viewer-location';

export default async function StoreLayout({ children }: { children: ReactNode }) {
  const [taxonomy, location] = await Promise.all([getTaxonomy(), getViewerLocation()]);
  return (
    <StoreShell
      taxonomy={taxonomy}
      location={<LocationChip location={location} defaultRadiusMi={DEFAULT_RADIUS_MI} />}
      locationLabel={locationText(location)}
    >
      {children}
    </StoreShell>
  );
}
