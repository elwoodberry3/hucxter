import type { Metadata } from 'next';
import { AccountPane } from '@/components/account/panes';
import { SettingsShell } from '@/components/account/settings-shell';
import { requireVerifiedMember } from '@/server/auth/gate';

export const metadata: Metadata = { title: 'Account', robots: { index: false } };

/** Settings → Account: masked phone and Change number, sessions, sign out, delete. */
export default async function Page({ searchParams }: PageProps<'/settings/account'>) {
  await requireVerifiedMember('/settings/account', 'settings');
  const { updated } = await searchParams;
  return (
    <SettingsShell current="account" title="Account">
      <AccountPane updated={typeof updated === 'string' ? updated : undefined} />
    </SettingsShell>
  );
}
