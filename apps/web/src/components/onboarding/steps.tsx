'use client';

import { useId, useRef, useState, useTransition } from 'react';
import {
  attestAge,
  saveDisplayName,
  saveHomeZip,
  sendPhoneCode,
  verifyPhoneCode,
} from '@/app/actions/onboarding';
import type { StepResult } from '@/app/actions/onboarding';
import { Turnstile } from '@/components/auth/turnstile';
import type { TurnstileHandle } from '@/components/auth/turnstile';
import { cx } from '@/lib/cx';
import styles from '@/components/auth/auth.module.css';

/** Shared pending + error handling for a step whose action redirects on success. */
function useStep() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const run = (action: () => Promise<StepResult>, onSent?: () => void) => {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.status === 'sent') onSent?.();
      else setError(result.message);
    });
  };
  return { error, pending, run };
}

function StepError({ id, error }: { id: string; error: string | null }) {
  return (
    <p id={id} role="alert" className={styles.error}>
      {error}
    </p>
  );
}

/**
 * Phone: US mobile number → SMS code (Supabase updateUser({ phone }) + verifyOtp phone_change).
 * Used in onboarding and, with `context: 'settings'`, to change the number.
 */
export function PhoneStep({
  next,
  captchaSiteKey,
  context = 'welcome',
}: {
  next: string | null;
  captchaSiteKey: string | null;
  context?: 'welcome' | 'settings';
}) {
  const [phase, setPhase] = useState<'number' | 'code'>('number');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstile = useRef<TurnstileHandle>(null);
  const { error, pending, run } = useStep();
  const phoneId = useId();
  const codeId = useId();
  const errorId = useId();
  const describedBy = error === null ? undefined : errorId;

  if (phase === 'code') {
    // Distinct keys: otherwise React reuses the "Use a different number" button as the number
    // form's submit button, and the same click submits it (sending an extra code).
    return (
      <form
        key="code"
        className={styles.form}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          run(() =>
            verifyPhoneCode({ code }, context === 'settings' ? { context } : { context, next }),
          );
        }}
      >
        <p role="status" className={styles.message}>
          We texted a 6-digit code to your number.
        </p>
        <label htmlFor={codeId} className={styles.label}>
          Code from the text
        </label>
        <input
          id={codeId}
          className={cx(styles.input, styles.code)}
          type="text"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={6}
          autoFocus
          value={code}
          aria-invalid={error === null ? undefined : true}
          aria-describedby={describedBy}
          onChange={(event) => {
            setCode(event.target.value.replace(/\D/g, '').slice(0, 6));
          }}
        />
        <button type="submit" className={styles.primary} disabled={pending || code.length !== 6}>
          {pending ? 'Checking…' : 'Verify'}
        </button>
        <button
          type="button"
          className={styles.textButton}
          onClick={() => {
            setCode('');
            setPhase('number');
          }}
        >
          Use a different number or send a new code
        </button>
        <StepError id={errorId} error={error} />
      </form>
    );
  }

  return (
    <form
      key="number"
      className={styles.form}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        run(
          () => sendPhoneCode({ phone, captchaToken: captchaToken ?? undefined }),
          () => {
            setPhase('code');
          },
        );
        turnstile.current?.reset();
      }}
    >
      <label htmlFor={phoneId} className={styles.label}>
        Mobile number
      </label>
      <p className={styles.hint} id={`${phoneId}-hint`}>
        US numbers only. We’ll text you a code. Your number is never shown to other people.
      </p>
      <input
        id={phoneId}
        className={styles.input}
        type="tel"
        name="phone"
        autoComplete="tel"
        inputMode="tel"
        placeholder="(503) 555-0123"
        value={phone}
        aria-invalid={error === null ? undefined : true}
        aria-describedby={cx(`${phoneId}-hint`, describedBy)}
        onChange={(event) => {
          setPhone(event.target.value);
        }}
      />
      {captchaSiteKey === null ? null : (
        <Turnstile ref={turnstile} siteKey={captchaSiteKey} onToken={setCaptchaToken} />
      )}
      <button
        type="submit"
        className={styles.primary}
        disabled={
          pending || phone.trim() === '' || (captchaSiteKey !== null && captchaToken === null)
        }
      >
        {pending ? 'Sending…' : 'Text me a code'}
      </button>
      <StepError id={errorId} error={error} />
    </form>
  );
}

/** "I'm 18 or older." */
export function AgeStep({ next }: { next: string | null }) {
  const [checked, setChecked] = useState(false);
  const { error, pending, run } = useStep();
  const errorId = useId();
  return (
    <form
      className={styles.form}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        run(() => attestAge({ confirmed: checked }, next));
      }}
    >
      <label className={styles.check}>
        <input
          type="checkbox"
          name="confirmed"
          checked={checked}
          aria-describedby={error === null ? undefined : errorId}
          onChange={(event) => {
            setChecked(event.target.checked);
          }}
        />
        I’m 18 or older.
      </label>
      <button type="submit" className={styles.primary} disabled={pending || !checked}>
        {pending ? 'Saving…' : 'Continue'}
      </button>
      <StepError id={errorId} error={error} />
    </form>
  );
}

/** "What's your home ZIP?" Prefilled from the location chip; any valid US ZIP. */
export function ZipStep({ next, initialZip }: { next: string | null; initialZip: string }) {
  const [zip, setZip] = useState(initialZip);
  const { error, pending, run } = useStep();
  const zipId = useId();
  const errorId = useId();
  return (
    <form
      className={styles.form}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        run(() => saveHomeZip({ zip }, next));
      }}
    >
      <label htmlFor={zipId} className={styles.label}>
        What’s your home ZIP?
      </label>
      <p className={styles.hint} id={`${zipId}-hint`}>
        We use it to show items near you. You can browse anywhere with the location button.
      </p>
      <input
        id={zipId}
        className={styles.input}
        type="text"
        name="zip"
        inputMode="numeric"
        autoComplete="postal-code"
        pattern="[0-9]*"
        maxLength={5}
        value={zip}
        aria-invalid={error === null ? undefined : true}
        aria-describedby={cx(`${zipId}-hint`, error === null ? undefined : errorId)}
        onChange={(event) => {
          setZip(event.target.value.replace(/\D/g, '').slice(0, 5));
        }}
      />
      <button type="submit" className={styles.primary} disabled={pending || zip.length !== 5}>
        {pending ? 'Saving…' : 'Continue'}
      </button>
      <StepError id={errorId} error={error} />
    </form>
  );
}

/** Display name: first name or nickname. */
export function NameStep({ next, initialName }: { next: string | null; initialName: string }) {
  const [name, setName] = useState(initialName);
  const { error, pending, run } = useStep();
  const nameId = useId();
  const errorId = useId();
  return (
    <form
      className={styles.form}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        run(() => saveDisplayName({ displayName: name }, next));
      }}
    >
      <label htmlFor={nameId} className={styles.label}>
        What should people call you?
      </label>
      <p className={styles.hint} id={`${nameId}-hint`}>
        Your first name or a nickname, 2–40 characters. No links, emails, or phone numbers.
      </p>
      <input
        id={nameId}
        className={styles.input}
        type="text"
        name="displayName"
        autoComplete="given-name"
        maxLength={40}
        value={name}
        aria-invalid={error === null ? undefined : true}
        aria-describedby={cx(`${nameId}-hint`, error === null ? undefined : errorId)}
        onChange={(event) => {
          setName(event.target.value);
        }}
      />
      <button type="submit" className={styles.primary} disabled={pending || name.trim().length < 2}>
        {pending ? 'Saving…' : 'Finish'}
      </button>
      <StepError id={errorId} error={error} />
    </form>
  );
}
