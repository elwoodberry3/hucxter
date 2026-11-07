'use client';

import { DISPLAY_NAME_MAX } from '@hucxter/contracts';
import { useId, useState, useTransition } from 'react';
import { deleteAccount, updateProfile } from '@/app/actions/account';
import { PhoneStep } from '@/components/onboarding/steps';
import { cx } from '@/lib/cx';
import styles from '@/components/auth/auth.module.css';

/** Settings → Profile: display name and home ZIP. */
export function ProfileForm({ displayName, homeZip }: { displayName: string; homeZip: string }) {
  const [name, setName] = useState(displayName);
  const [zip, setZip] = useState(homeZip);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const nameId = useId();
  const zipId = useId();
  const errorId = useId();
  return (
    <form
      className={styles.form}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        setMessage(null);
        startTransition(async () => {
          const result = await updateProfile({ displayName: name, zip });
          if (result.status === 'saved') setMessage('Saved.');
          else setError(result.message);
        });
      }}
    >
      <label htmlFor={nameId} className={styles.label}>
        Display name
      </label>
      <input
        id={nameId}
        className={styles.input}
        type="text"
        autoComplete="given-name"
        maxLength={DISPLAY_NAME_MAX}
        value={name}
        aria-describedby={error === null ? undefined : errorId}
        onChange={(event) => {
          setName(event.target.value);
        }}
      />
      <label htmlFor={zipId} className={styles.label}>
        Home ZIP
      </label>
      <input
        id={zipId}
        className={styles.input}
        type="text"
        inputMode="numeric"
        autoComplete="postal-code"
        pattern="[0-9]*"
        maxLength={5}
        value={zip}
        aria-describedby={error === null ? undefined : errorId}
        onChange={(event) => {
          setZip(event.target.value.replace(/\D/g, '').slice(0, 5));
        }}
      />
      <button type="submit" className={styles.primary} disabled={pending}>
        {pending ? 'Saving…' : 'Save profile'}
      </button>
      <p role="status" className={styles.message}>
        {message}
      </p>
      <p id={errorId} role="alert" className={styles.error}>
        {error}
      </p>
    </form>
  );
}

/** Settings → Phone: changing the number needs a new SMS code. */
export function PhoneChange({ captchaSiteKey }: { captchaSiteKey: string | null }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        type="button"
        className={styles.secondaryButton}
        onClick={() => {
          setOpen(true);
        }}
      >
        Change phone number
      </button>
    );
  }
  return <PhoneStep next={null} captchaSiteKey={captchaSiteKey} context="settings" />;
}

/** Settings → Delete account: typed confirmation, then everything is revoked and deleted. */
export function DeleteAccountForm() {
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputId = useId();
  const errorId = useId();
  return (
    <form
      className={styles.form}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await deleteAccount({ confirm });
          if (result.status === 'error') setError(result.message);
        });
      }}
    >
      <label htmlFor={inputId} className={styles.label}>
        Type DELETE to confirm
      </label>
      <input
        id={inputId}
        className={styles.input}
        type="text"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        value={confirm}
        aria-describedby={error === null ? undefined : errorId}
        onChange={(event) => {
          setConfirm(event.target.value);
        }}
      />
      <button
        type="submit"
        className={cx(styles.primary, styles.destructive)}
        disabled={pending || confirm !== 'DELETE'}
      >
        {pending ? 'Deleting…' : 'Delete my account'}
      </button>
      <p id={errorId} role="alert" className={styles.error}>
        {error}
      </p>
    </form>
  );
}
