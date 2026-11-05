import type { Metadata } from 'next';
import { requireVerifiedMember } from '@/server/auth/gate';

export const metadata: Metadata = { title: 'Saved' };

/** Verified members only: guests go to /sign-in, unverified members to /welcome (D-34). */
export default async function Page() {
  await requireVerifiedMember('/saved', 'saved');
  return <h1>Saved</h1>;
}
