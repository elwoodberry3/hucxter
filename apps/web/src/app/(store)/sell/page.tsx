import { CONDITION_LABELS } from '@hucxter/contracts';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { SellFlow } from '@/components/sell/sell-flow';
import type { SellDraft } from '@/components/sell/sell-flow';
import { mediaConfig } from '@/lib/env';
import { getTaxonomy } from '@/lib/taxonomy';
import { requireVerifiedMember } from '@/server/auth/gate';
import { loadOwnListing } from '@/server/listings/owner';
import { sessionClient } from '@/server/supabase-server';

export const metadata: Metadata = { title: 'Sell', robots: { index: false } };

/** Verified members only: guests go to /sign-in, unverified members to /welcome (D-34). */
export default async function Page({ searchParams }: PageProps<'/sell'>) {
  const params = await searchParams;
  const draftId = typeof params.draft === 'string' ? params.draft : undefined;
  const step = typeof params.step === 'string' ? params.step : undefined;
  const next =
    draftId === undefined
      ? '/sell'
      : `/sell?draft=${encodeURIComponent(draftId)}&step=${encodeURIComponent(step ?? 'video')}`;
  const member = await requireVerifiedMember(next, 'sell');

  let draft: SellDraft | null = null;
  if (draftId !== undefined) {
    const own = await loadOwnListing(await sessionClient(), draftId);
    // Someone else's draft, a deleted one, or a published one: start over / manage it instead.
    if (own === null) redirect('/sell');
    if (own.status !== 'draft') redirect(`/l/${own.id}`);
    draft = {
      listingId: own.id,
      media: own.media?.status ?? null,
      publishWhenReady: own.publishWhenReady,
      areaLabel:
        own.areaLabel === null ? null : `${own.areaLabel}, ${own.state ?? ''}`.replace(/, $/, ''),
      details: {
        title: own.title ?? '',
        departmentSlug: own.departmentSlug ?? '',
        categorySlug: own.categorySlug ?? '',
        condition: own.condition !== null && own.condition in CONDITION_LABELS ? own.condition : '',
        free: own.priceCents === 0,
        price: own.priceCents === null || own.priceCents === 0 ? '' : String(own.priceCents / 100),
        attributes: own.attributes,
        description: own.description,
        pickupZip: own.pickupZip ?? member.homeZip ?? '',
      },
    };
  }

  const { departments } = await getTaxonomy();
  const { maxBytes, maxSeconds } = mediaConfig();
  return (
    <SellFlow
      draft={draft}
      departments={departments}
      homeZip={member.homeZip ?? ''}
      limits={{ maxBytes, maxSeconds }}
    />
  );
}
