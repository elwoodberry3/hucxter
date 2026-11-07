import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { EditListing } from '@/components/listings/edit-listing';
import styles from '@/components/listings/listings.module.css';
import { getTaxonomy } from '@/lib/taxonomy';
import { requireVerifiedMember } from '@/server/auth/gate';
import { loadOwnListing, ownDetailsValues } from '@/server/listings/owner';
import { sessionClient } from '@/server/supabase-server';

export const metadata: Metadata = { title: 'Edit listing', robots: { index: false } };

/**
 * Edit a published listing (Brief 03C.1 §3.6). Owner only: anyone else, or a removed listing, is
 * 404. Drafts continue in /sell; sold listings can't be edited.
 */
export default async function Page({ params }: PageProps<'/listings/[id]/edit'>) {
  const { id } = await params;
  const member = await requireVerifiedMember(
    `/listings/${encodeURIComponent(id)}/edit`,
    'listings',
  );
  const own = await loadOwnListing(await sessionClient(), id);
  if (own === null || own.removed) notFound();
  if (own.status === 'draft') redirect(`/sell?draft=${own.id}&step=details`);
  if (own.status === 'sold') redirect(`/l/${own.id}`);
  const { departments } = await getTaxonomy();

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.heading}>Edit listing</h1>
        <Link href={`/l/${own.id}`} className={styles.button}>
          Cancel
        </Link>
      </div>
      <EditListing
        listingId={own.id}
        departments={departments}
        initial={ownDetailsValues(own, member.homeZip)}
      />
    </div>
  );
}
