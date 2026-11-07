'use client';

import { BIO_MAX, DISPLAY_NAME_MAX, HANDLE_MAX } from '@hucxter/contracts';
import { useRouter } from 'next/navigation';
import { useId, useRef, useState, useTransition } from 'react';
import { updateProfile } from '@/app/actions/account';
import type { ProfileField } from '@/app/actions/account';
import styles from '@/components/auth/auth.module.css';
import { Avatar } from '@/components/ui/avatar';
import { CharCounter } from '@/components/ui/char-counter';
import { useToast } from '@/components/ui/toast';
import { cx } from '@/lib/cx';
import settings from './settings.module.css';
import { useHandleCheck } from './use-handle-check';

const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const PHOTO_ERROR = 'Choose a JPEG, PNG or WebP photo up to 5 MB.';

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Settings → Edit profile (Brief 03C.2 §4.4): photo (Change / Remove, when photos are on),
 * display name (2–25), @handle (availability as you type, at most one change per 30 days), bio
 * (0–150, plain text) and home ZIP. The server checks everything again.
 */
export function EditProfileForm({
  displayName,
  handle,
  bio,
  homeZip,
  avatarUrl,
  avatarUploads,
  handleChangeableAt,
}: {
  displayName: string;
  handle: string;
  bio: string;
  homeZip: string;
  avatarUrl: string | null;
  avatarUploads: boolean;
  handleChangeableAt: string | null;
}) {
  const router = useRouter();
  const [name, setName] = useState(displayName);
  const [handleValue, setHandleValue] = useState(handle);
  const [bioValue, setBioValue] = useState(bio);
  const [zip, setZip] = useState(homeZip);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<{ text: string; field?: ProfileField } | null>(null);
  const [pending, startTransition] = useTransition();
  const ids = {
    name: useId(),
    nameCount: useId(),
    handle: useId(),
    handleNote: useId(),
    bio: useId(),
    bioCount: useId(),
    zip: useId(),
    error: useId(),
  };
  const note = useHandleCheck(handleValue, handle);

  const fieldError = (field: ProfileField) => (error?.field === field ? error.text : null);
  const describedBy = (...parts: (string | false | null | undefined)[]) =>
    parts.filter(Boolean).join(' ') || undefined;
  const handleLocked = handleChangeableAt !== null;

  return (
    <div className={settings.pane}>
      {avatarUploads ? <PhotoControl name={displayName} avatarUrl={avatarUrl} /> : null}
      <form
        className={cx(styles.form, settings.card)}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          setMessage(null);
          startTransition(async () => {
            const result = await updateProfile({
              displayName: name,
              handle: handleValue,
              bio: bioValue,
              zip,
            });
            if (result.status === 'saved') {
              setMessage('Saved.');
              router.refresh();
            } else {
              setError({ text: result.message, ...(result.field ? { field: result.field } : {}) });
            }
          });
        }}
      >
        <div className={settings.fieldRow}>
          <label htmlFor={ids.name} className={styles.label}>
            Display name
          </label>
          <CharCounter id={ids.nameCount} value={name} max={DISPLAY_NAME_MAX} />
        </div>
        <input
          id={ids.name}
          className={styles.input}
          type="text"
          autoComplete="nickname"
          maxLength={DISPLAY_NAME_MAX}
          value={name}
          aria-invalid={fieldError('displayName') === null ? undefined : true}
          aria-describedby={describedBy(ids.nameCount, fieldError('displayName') && ids.error)}
          onChange={(event) => {
            setName(event.target.value);
          }}
        />

        <label htmlFor={ids.handle} className={styles.label}>
          Handle
        </label>
        <div className={settings.handleField}>
          <span className={settings.handlePrefix} aria-hidden="true">
            @
          </span>
          <input
            id={ids.handle}
            className={styles.input}
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={HANDLE_MAX + 1}
            value={handleValue}
            aria-invalid={note?.tone === 'bad' || fieldError('handle') !== null ? true : undefined}
            aria-describedby={describedBy(ids.handleNote, fieldError('handle') && ids.error)}
            onChange={(event) => {
              setHandleValue(event.target.value.replace(/^@/, '').toLowerCase());
            }}
          />
        </div>
        <p
          id={ids.handleNote}
          className={settings.status}
          data-tone={note?.tone ?? 'neutral'}
          aria-live="polite"
        >
          {note?.text ??
            (handleLocked
              ? `You can change your handle again on ${formatDay(handleChangeableAt)}.`
              : 'You can change your handle once every 30 days.')}
        </p>

        <div className={settings.fieldRow}>
          <label htmlFor={ids.bio} className={styles.label}>
            Bio <span className={settings.status}>(optional)</span>
          </label>
          <CharCounter id={ids.bioCount} value={bioValue} max={BIO_MAX} />
        </div>
        <textarea
          id={ids.bio}
          className={cx(styles.input, settings.textarea)}
          rows={3}
          maxLength={BIO_MAX}
          value={bioValue}
          aria-invalid={fieldError('bio') === null ? undefined : true}
          aria-describedby={describedBy(ids.bioCount, fieldError('bio') && ids.error)}
          onChange={(event) => {
            setBioValue(event.target.value);
          }}
        />

        <label htmlFor={ids.zip} className={styles.label}>
          Home ZIP
        </label>
        <input
          id={ids.zip}
          className={styles.input}
          type="text"
          inputMode="numeric"
          autoComplete="postal-code"
          pattern="[0-9]*"
          maxLength={5}
          value={zip}
          aria-invalid={fieldError('zip') === null ? undefined : true}
          aria-describedby={describedBy(fieldError('zip') && ids.error)}
          onChange={(event) => {
            setZip(event.target.value.replace(/\D/g, '').slice(0, 5));
          }}
        />
        <p className={settings.status} data-tone="neutral">
          Only you see your home ZIP. Buyers see listing areas, never your ZIP.
        </p>

        <button type="submit" className={styles.primary} disabled={pending}>
          {pending ? 'Saving…' : 'Save profile'}
        </button>
        <p role="status" className={styles.message}>
          {message}
        </p>
        <p id={ids.error} role="alert" className={styles.error}>
          {error?.text}
        </p>
      </form>
    </div>
  );
}

/** Change / Remove photo. Files go straight to the upload route; the server re-encodes them. */
function PhotoControl({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();
  const errorId = useId();

  const send = async (method: 'POST' | 'DELETE', file?: File) => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/profile/avatar', {
        method,
        ...(file === undefined ? {} : { body: file, headers: { 'Content-Type': file.type } }),
      });
      if (response.ok) {
        toast(method === 'POST' ? 'Photo updated' : 'Photo removed');
        router.refresh();
      } else {
        const body: unknown = await response.json().catch(() => null);
        const text =
          typeof body === 'object' &&
          body !== null &&
          'error' in body &&
          typeof body.error === 'string'
            ? body.error
            : 'We couldn’t change your photo. Try again.';
        setError(text);
      }
    } catch {
      setError('We couldn’t change your photo. Check your connection and try again.');
    } finally {
      setBusy(false);
      if (input.current !== null) input.current.value = '';
    }
  };

  return (
    <section className={settings.card} aria-labelledby={`${inputId}-title`}>
      <h3 id={`${inputId}-title`} className={settings.cardTitle}>
        Profile photo
      </h3>
      <div className={settings.photoRow}>
        <Avatar name={name} src={avatarUrl} size="lg" />
        <div className={settings.photoButtons}>
          <input
            ref={input}
            id={inputId}
            className={settings.fileInput}
            type="file"
            accept={PHOTO_TYPES.join(',')}
            aria-describedby={errorId}
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file === undefined) return;
              if (!PHOTO_TYPES.includes(file.type) || file.size > PHOTO_MAX_BYTES) {
                setError(PHOTO_ERROR);
                event.target.value = '';
                return;
              }
              void send('POST', file);
            }}
          />
          <label htmlFor={inputId} className={styles.secondaryButton} aria-disabled={busy}>
            {busy ? 'Saving…' : avatarUrl === null ? 'Add photo' : 'Change photo'}
          </label>
          {avatarUrl === null ? null : (
            <button
              type="button"
              className={styles.secondaryButton}
              disabled={busy}
              onClick={() => {
                void send('DELETE');
              }}
            >
              Remove photo
            </button>
          )}
        </div>
      </div>
      <p id={errorId} role="alert" className={styles.error}>
        {error}
      </p>
      <p className={settings.status} data-tone="neutral">
        JPEG, PNG or WebP, up to 5 MB. We remove location and camera details from every photo.
      </p>
    </section>
  );
}
