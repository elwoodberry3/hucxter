import type { Metadata } from 'next';
import { requireMember } from '@/lib/auth-gate';

export const metadata: Metadata = { title: 'Profile' };

/** Members only: guests are redirected to /sign-in?next=/profile. */
export default async function Page() {
  await requireMember('/profile', 'profile');
  return <h1>Profile</h1>;
}
