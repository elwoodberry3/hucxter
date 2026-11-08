'use client';

import { DISPLAY_NAME_MAX, HANDLE_MAX } from '@hucxter/contracts';
import { useRouter } from 'next/navigation';
import { useId, useState, useTransition } from 'react';
import { completeProfileReset } from '@/app/actions/profile';
import styles from '@/components/auth/auth.module.css';
import settings from '@/components/account/settings.module.css';
import { useHandleCheck } from '@/components/account/use-handle-check';
import { CharCounter } from '@/components/ui/char-counter';
import { cx } from '@/lib/cx';

/**
 * After staff required a new name and handle (Brief 03C.2 moderation): the member chooses both
 * before anything else. Starts empty; the placeholder name and generated handle aren't offered.
 */
export function ResetStep({ next }: { next: string | null }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [handleValue, setHandleValue] = useState('');
  const [error, setError] = useState<{ text: string; field?: 'displayName' | 'handle' } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();
  const nameId = useId();
  const handleId = useId();
  const errorId = useId();
  const checked = useHandleCheck(handleValue, null);
  // Nothing typed yet: show the format hint, not an error.
  const note = handleValue.trim() === '' ? null : checked;
  const invalid = (field: 'displayName' | 'handle') =>
    error !== null && (error.field === undefined || error.field === field) ? true : undefined;

  return (
    <form
      className={styles.form}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await completeProfileReset({ displayName: name, handle: handleValue });
          if (result.status === 'saved') {
            router.replace(next ?? '/');
            router.refresh();
          } else {
            setError({ text: result.message, ...(result.field ? { field: result.field } : {}) });
          }
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
        autoComplete="nickname"
        maxLength={DISPLAY_NAME_MAX}
        value={name}
        aria-invalid={invalid('displayName')}
        aria-describedby={cx(`${nameId}-count`, invalid('displayName') && errorId)}
        onChange={(event) => {
          setName(event.target.value);
        }}
      />
      <CharCounter id={`${nameId}-count`} value={name} max={DISPLAY_NAME_MAX} />

      <label htmlFor={handleId} className={styles.label}>
        Handle
      </label>
      <div className={settings.handleField}>
        <span className={settings.handlePrefix} aria-hidden="true">
          @
        </span>
        <input
          id={handleId}
          className={styles.input}
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={HANDLE_MAX + 1}
          value={handleValue}
          aria-invalid={note?.tone === 'bad' || invalid('handle') ? true : undefined}
          aria-describedby={cx(`${handleId}-note`, invalid('handle') && errorId)}
          onChange={(event) => {
            setHandleValue(event.target.value.replace(/^@/, '').toLowerCase());
          }}
        />
      </div>
      <p
        id={`${handleId}-note`}
        className={settings.status}
        data-tone={note?.tone ?? 'neutral'}
        aria-live="polite"
      >
        {note?.text ?? '3–24 letters, numbers, dots or underscores.'}
      </p>

      <button
        type="submit"
        className={styles.primary}
        disabled={pending || name.trim().length < 2 || handleValue.trim() === ''}
      >
        {pending ? 'Saving…' : 'Save and continue'}
      </button>
      <p id={errorId} role="alert" className={styles.error}>
        {error?.text}
      </p>
    </form>
  );
}
