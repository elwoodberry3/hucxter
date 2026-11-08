import type { Metadata } from 'next';
import { ProfilePane } from '@/components/account/panes';
import { SettingsShell } from '@/components/account/settings-shell';
import { requireVerifiedMember } from '@/server/auth/gate';

export const metadata: Metadata = { title: 'Settings', robots: { index: false } };

/**
 * Settings index (Brief 03C.2 §4.4). Phones: the list of panes. Desktop: the nav beside Edit
 * profile. Verified members only: guests go to /sign-in, unverified members to /welcome (D-34).
 */
export default async function Page() {
  const member = await requireVerifiedMember('/settings', 'settings');
  return (
    <SettingsShell current="index" title="Edit profile">
      <ProfilePane member={member} />
    </SettingsShell>
  );
}
