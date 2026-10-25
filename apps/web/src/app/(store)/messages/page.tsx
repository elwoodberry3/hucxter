import type { Metadata } from 'next';
import { requireMember } from '@/lib/auth-gate';

export const metadata: Metadata = { title: 'Messages' };

/** Members only: guests are redirected to /sign-in?next=/messages. */
export default async function Page() {
  await requireMember('/messages', 'messages');
  return <h1>Messages</h1>;
}
