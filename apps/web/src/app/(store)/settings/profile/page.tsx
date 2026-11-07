import type { Metadata } from 'next';
import { ProfilePane } from '@/components/account/panes';
import { SettingsShell } from '@/components/account/settings-shell';
import { requireVerifiedMember } from '@/server/auth/gate';

export const metadata: Metadata = { title: 'Edit profile', robots: { index: false } };

/** Settings → Edit profile: photo, display name, @handle, bio, home ZIP. */
export default async function Page() {
  const member = await requireVerifiedMember('/settings/profile', 'settings');
  return (
    <SettingsShell current="profile" title="Edit profile">
      <ProfilePane member={member} />
    </SettingsShell>
  );
}
