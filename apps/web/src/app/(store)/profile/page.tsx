import { redirect } from 'next/navigation';
import { OWNER_FILTERS, PROFILE_TABS } from '@/server/profile/load';
import { requireOwnProfilePath } from '@/server/profile/own';

/** /profile → the viewer's own /u/[handle] (Brief 03C.2 §4.1), keeping a known tab or filter. */
export default async function Page({ searchParams }: PageProps<'/profile'>) {
  const params = await searchParams;
  const query = new URLSearchParams();
  const tab = PROFILE_TABS.find((t) => t === params.tab);
  const filter = OWNER_FILTERS.find((f) => f === params.filter);
  if (tab !== undefined && tab !== 'listings') query.set('tab', tab);
  if (filter !== undefined && filter !== 'all') query.set('filter', filter);
  const path = await requireOwnProfilePath('/profile', 'profile');
  const search = query.toString();
  redirect(search === '' ? path : `${path}?${search}`);
}
