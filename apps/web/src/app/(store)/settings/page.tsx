import type { Metadata } from 'next';
import { requireMember } from '@/lib/auth-gate';

export const metadata: Metadata = { title: 'Settings' };

/** Members only: guests are redirected to /sign-in?next=/settings. */
export default async function Page() {
  await requireMember('/settings', 'settings');
  return <h1>Settings</h1>;
}
