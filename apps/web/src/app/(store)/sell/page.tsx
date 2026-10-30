import type { Metadata } from 'next';
import { requireMember } from '@/lib/auth-gate';

export const metadata: Metadata = { title: 'Sell' };

/** Members only: guests are redirected to /sign-in?next=/sell. */
export default async function Page() {
  await requireMember('/sell', 'sell');
  return <h1>Sell</h1>;
}
