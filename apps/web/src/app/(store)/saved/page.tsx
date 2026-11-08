import { redirect } from 'next/navigation';
import { requireOwnProfilePath } from '@/server/profile/own';

/** /saved → the Saved tab of the viewer's own profile (Brief 03C.2 §4.3). */
export default async function Page() {
  redirect(`${await requireOwnProfilePath('/saved', 'saved')}?tab=saved`);
}
