import { signOut, signOutEverywhere } from '@/app/actions/account';
import styles from '@/components/auth/auth.module.css';
import { avatarUrl } from '@/lib/avatar';
import { authConfig, profileConfig } from '@/lib/env';
import { maskPhone } from '@/lib/phone-mask';
import { listMySessions } from '@/server/account/sessions';
import type { VerifiedMember } from '@/server/auth/gate';
import { loadOwnProfileSettings } from '@/server/profile/own';
import { sessionClient } from '@/server/supabase-server';
import { EditProfileForm } from './edit-profile-form';
import { DeleteAccountForm, PhoneChange } from './settings-forms';
import settings from './settings.module.css';

const DATE = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/Los_Angeles',
});

/** Settings → Edit profile. */
export async function ProfilePane({ member }: { member: VerifiedMember }) {
  const own = await loadOwnProfileSettings(await sessionClient());
  return (
    <EditProfileForm
      displayName={member.displayName ?? ''}
      handle={member.handle ?? ''}
      bio={own.bio}
      homeZip={member.homeZip ?? ''}
      avatarUrl={avatarUrl(member.avatarPath)}
      avatarUploads={profileConfig().avatarUploads}
      handleChangeableAt={own.handleChangeableAt}
    />
  );
}

/** Settings → Account: masked phone, where you're signed in, sign out, delete. */
export async function AccountPane({ updated }: { updated: string | undefined }) {
  const supabase = await sessionClient();
  const [sessions, { data }] = await Promise.all([listMySessions(), supabase.auth.getUser()]);
  const { captcha } = authConfig();
  const phone = maskPhone(data.user?.phone);
  return (
    <>
      <section className={settings.card} aria-labelledby="phone-title">
        <h3 id="phone-title" className={settings.cardTitle}>
          Phone
        </h3>
        {phone === null ? null : (
          <p className={settings.phone} aria-label={`Phone number ending ${phone.slice(-3)}`}>
            {phone}
          </p>
        )}
        <p className={styles.hint}>
          {updated === 'phone'
            ? 'Your new number is verified.'
            : 'Verified. It’s never shown to other members.'}
        </p>
        <PhoneChange captchaSiteKey={captcha.provider === 'turnstile' ? captcha.siteKey : null} />
      </section>

      <section className={settings.card} aria-labelledby="sessions-title">
        <h3 id="sessions-title" className={settings.cardTitle}>
          Where you’re signed in
        </h3>
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

      <section className={settings.card} aria-labelledby="delete-title">
        <h3 id="delete-title" className={settings.cardTitle}>
          Delete account
        </h3>
        <p className={styles.hint}>
          This deletes your profile and listings and signs you out everywhere. It can’t be undone.
        </p>
        <DeleteAccountForm />
      </section>
    </>
  );
}
