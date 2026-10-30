import type { Metadata } from 'next';
import { requireMember } from '@/lib/auth-gate';

export const metadata: Metadata = { title: 'My Listings' };

/** Members only: guests are redirected to /sign-in?next=/listings. */
export default async function Page() {
  await requireMember('/listings', 'listings');
  return <h1>My Listings</h1>;
}
