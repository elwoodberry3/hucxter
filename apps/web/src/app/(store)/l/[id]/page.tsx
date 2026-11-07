import { filtersFor } from '@hucxter/contracts';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';
import { ListingTemplate } from '@/components/listing/listing-template';
import type { PlayerSource } from '@/components/video/listing-player';
import { serverConfig } from '@/lib/env';
import { findDepartment, getTaxonomy } from '@/lib/taxonomy';
import { getViewerLocation } from '@/lib/viewer-location';
import { loadMemberForDisplay } from '@/server/auth/member';
import { loadListingView, loadOwnerViewCount, loadPriceDrop } from '@/server/listings/public';
import { playbackSource } from '@/server/media/playback';
import { savedAmong } from '@/server/saves';
import { sessionClient } from '@/server/supabase-server';

export const dynamic = 'force-dynamic';

const loadView = cache(async (id: string) => {
  const location = await getViewerLocation();
  return loadListingView(await sessionClient(), id, location?.zip ?? null);
});

function excerpt(text: string, max = 160): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Metadata: title, a plain description excerpt, canonical URL. The Open Graph image is the Hx
 * default: a signed poster would put a playback token in a long-lived crawler URL (§3.4).
 */
export async function generateMetadata({ params }: PageProps<'/l/[id]'>): Promise<Metadata> {
  const view = await loadView((await params).id);
  if (view?.kind !== 'listing' || view.inReview) return { title: 'Listing not found' };
  const { listing } = view;
  const url = new URL(`/l/${listing.id}`, serverConfig().appOrigin).toString();
  const description =
    listing.description === ''
      ? `${listing.title} in ${listing.area_label}, ${listing.state}.`
      : excerpt(listing.description);
  return {
    title: listing.title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      url,
      title: listing.title,
      description,
      images: [{ url: '/icon-512.png', width: 512, height: 512, alt: 'Hucxter' }],
    },
    ...(view.isOwner ? { robots: { index: false } } : {}),
  };
}

async function player(mediaId: string | null): Promise<PlayerSource | null> {
  if (mediaId === null) return null;
  try {
    return await playbackSource(mediaId);
  } catch {
    // The video provider being down (or unconfigured) must not take the page with it.
    console.error('playback_unavailable');
    return null;
  }
}

/**
 * Listing page (Brief 03C.1 §3.4). Not found, deleted, removed, a draft or in review for anyone
 * but the owner: 404. Sold listings stay visible. The owner sees their controls and view count.
 */
export default async function ListingPage({ params }: PageProps<'/l/[id]'>) {
  const view = await loadView((await params).id);
  if (view === null) notFound();
  if (view.kind === 'draft') redirect(`/sell?draft=${view.id}&step=review`);
  if (view.inReview && !view.isOwner) notFound();
  const { listing } = view;
  const department = findDepartment(await getTaxonomy(), listing.department_slug);
  if (department === undefined) notFound();

  const db = await sessionClient();
  const [source, drop, member, views] = await Promise.all([
    view.mediaReady ? player(view.mediaId) : Promise.resolve(null),
    loadPriceDrop(db, listing.id),
    loadMemberForDisplay(),
    view.isOwner ? loadOwnerViewCount(db, listing.id) : Promise.resolve(null),
  ]);

  const saved =
    member === null || view.isOwner ? false : (await savedAmong(db, [listing.id])).has(listing.id);

  return (
    <ListingTemplate
      listing={listing}
      saved={saved}
      department={department}
      filters={filtersFor(department, listing.category_slug)}
      player={source}
      drop={drop}
      owner={view.isOwner ? { views, inReview: view.inReview } : null}
      verified={member?.verified === true}
    />
  );
}
