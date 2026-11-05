import type { Metadata } from 'next';
import { requireVerifiedMember } from '@/server/auth/gate';

export const metadata: Metadata = { title: 'Messages' };

/** Verified members only: guests go to /sign-in, unverified members to /welcome (D-34). */
export default async function Page() {
  await requireVerifiedMember('/messages', 'messages');
  return <h1>Messages</h1>;
}
