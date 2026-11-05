import type { Metadata } from 'next';
import { requireVerifiedMember } from '@/server/auth/gate';

export const metadata: Metadata = { title: 'Settings' };

/** Verified members only: guests go to /sign-in, unverified members to /welcome (D-34). */
export default async function Page() {
  await requireVerifiedMember('/settings', 'settings');
  return <h1>Settings</h1>;
}
