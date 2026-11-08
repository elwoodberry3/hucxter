import { BadgeCheck, Pencil } from 'lucide-react';
import Link from 'next/link';
import { ReportButton } from '@/components/listing/report-button';
import { ShareButton } from '@/components/listing/share-button';
import { Avatar } from '@/components/ui/avatar';
import type { Profile } from '@/server/profile/load';
import styles from './profile.module.css';

function formatJoined(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Profile header (Brief 03C.2 §4.2): photo or initials, name, @handle, bio and verified facts. Real
 * counts only, and a zero sold count is hidden. Never the home ZIP or area.
 */
export function ProfileHeader({ profile, verified }: { profile: Profile; verified: boolean }) {
  return (
    <header className={styles.header}>
      <span className={styles.avatar}>
        <Avatar name={profile.displayName} src={profile.avatarUrl} size="xl" />
      </span>
      <div className={styles.identity}>
        <h1 className={styles.name}>{profile.displayName}</h1>
        <p className={styles.handle}>@{profile.handle}</p>
      </div>
      {profile.bio === '' ? null : <p className={styles.bio}>{profile.bio}</p>}
      <ul className={styles.facts}>
        {profile.phoneVerified ? (
          <li className={styles.verified}>
            <BadgeCheck size={16} aria-hidden="true" /> Phone verified
          </li>
        ) : null}
        <li>Joined {formatJoined(profile.joinedMonth)}</li>
      </ul>
      <p className={styles.counts}>
        {profile.listedCount} listed
        {profile.soldCount === 0 ? null : <> · {profile.soldCount} sold</>}
      </p>
      <div className={styles.headerActions}>
        {profile.isOwner ? (
          <Link href="/settings/profile" className={styles.button}>
            <Pencil size={16} aria-hidden="true" /> Edit profile
          </Link>
        ) : (
          <>
            <ShareButton className={styles.button} label="Share profile" />
            <ReportButton
              target={{ kind: 'profile', handle: profile.handle }}
              verified={verified}
              className={styles.button}
              label="Report profile"
            />
          </>
        )}
      </div>
    </header>
  );
}
