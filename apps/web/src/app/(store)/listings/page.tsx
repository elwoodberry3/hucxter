import { redirect } from 'next/navigation';
import { requireOwnProfilePath } from '@/server/profile/own';

// The old My Listings tabs, as the owner view of the profile (Brief 03C.2: /listings folds in).
const FILTERS: Record<string, string> = {
  drafts: 'filter=drafts',
  processing: 'filter=drafts',
  live: 'filter=live',
  review: 'filter=review',
  sold: 'tab=sold',
};

/** /listings → the owner view of the viewer's profile, keeping the tab and the deleted notice. */
export default async function Page({ searchParams }: PageProps<'/listings'>) {
  const params = await searchParams;
  const tab = typeof params.tab === 'string' ? params.tab : undefined;
  const path = await requireOwnProfilePath(
    tab === undefined ? '/listings' : `/listings?tab=${tab}`,
    'listings',
  );
  const query = [
    tab === undefined ? undefined : FILTERS[tab],
    params.deleted === '1' ? 'deleted=1' : undefined,
  ].filter((part) => part !== undefined);
  redirect(query.length === 0 ? path : `${path}?${query.join('&')}`);
}
