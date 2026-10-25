import type { Metadata } from 'next';
import { requireMember } from '@/lib/auth-gate';

export const metadata: Metadata = { title: 'Saved' };

/** Members only: guests are redirected to /sign-in?next=/saved. */
export default async function Page() {
  await requireMember('/saved', 'saved');
  return <h1>Saved</h1>;
}
