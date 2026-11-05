import type { Metadata } from 'next';
import { signOut, signOutEverywhere } from '@/app/actions/account';
import { DeleteAccountForm, PhoneChange, ProfileForm } from '@/components/account/settings-forms';
import styles from '@/components/auth/auth.module.css';
import { authConfig } from '@/lib/env';
import { listMySessions } from '@/server/account/sessions';
import { requireVerifiedMember } from '@/server/auth/gate';

export const metadata: Metadata = { title: 'Settings' };

const DATE = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/Los_Angeles',
});

/** Verified members only: guests go to /sign-in, unverified members to /welcome (D-34). */
export default async function Page({ searchParams }: PageProps<'/settings'>) {
  const member = await requireVerifiedMember('/settings', 'settings');
  const { updated } = await searchParams;
  const [sessions, { captcha }] = [await listMySessions(), authConfig()];

  return (
    <div className={styles.settings}>
      <h1 className={styles.title}>Settings</h1>

      <section className={styles.section} aria-labelledby="profile-title">
        <h2 id="profile-title" className={styles.sectionTitle}>
          Profile
        </h2>
        <ProfileForm displayName={member.displayName ?? ''} homeZip={member.homeZip ?? ''} />
      </section>

      <section className={styles.section} aria-labelledby="phone-title">
        <h2 id="phone-title" className={styles.sectionTitle}>
          Phone
        </h2>
        <p className={styles.hint}>
          {updated === 'phone'
            ? 'Your new number is verified.'
            : 'Your phone number is verified. It’s never shown to other members.'}
        </p>
        <PhoneChange captchaSiteKey={captcha.provider === 'turnstile' ? captcha.siteKey : null} />
      </section>

      <section className={styles.section} aria-labelledby="sessions-title">
        <h2 id="sessions-title" className={styles.sectionTitle}>
          Where you’re signed in
        </h2>
        <ul className={styles.sessions}>
          {sessions.map((session) => (
            <li key={session.id}>
              <span>
                {session.device}
                {session.isCurrent ? ' · This device' : ''}
              </span>
              <span className={styles.hint}>
                Signed in{' '}
                <time dateTime={session.createdAt}>{DATE.format(new Date(session.createdAt))}</time>
              </span>
            </li>
          ))}
        </ul>
        <div className={styles.buttons}>
          <form action={signOut}>
            <button type="submit" className={styles.secondaryButton}>
              Sign out
            </button>
          </form>
          <form action={signOutEverywhere}>
            <button type="submit" className={styles.secondaryButton}>
              Sign out everywhere
            </button>
          </form>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="delete-title">
        <h2 id="delete-title" className={styles.sectionTitle}>
          Delete account
        </h2>
        <p className={styles.hint}>
          This deletes your profile and signs you out everywhere. It can’t be undone.
        </p>
        <DeleteAccountForm />
      </section>
    </div>
  );
}
