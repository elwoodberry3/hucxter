'use client';

import { Mail } from 'lucide-react';
import { useId, useRef, useState, useTransition } from 'react';
import { sendEmailCode, verifyEmailCode } from '@/app/actions/auth';
import { track } from '@/lib/analytics';
import { cx } from '@/lib/cx';
import { safeNextPath } from '@/lib/next-path';
import { Turnstile } from './turnstile';
import type { TurnstileHandle } from './turnstile';
import styles from './auth.module.css';

type Step = 'choose' | 'email' | 'code' | 'closed';

const SENT_COPY = 'We sent a code if this address can sign in. Check your inbox.';

function googleHref(next: string | null): string {
  const safe = safeNextPath(next);
  return safe === null || safe === '/'
    ? '/auth/google'
    : `/auth/google?next=${encodeURIComponent(safe)}`;
}

/**
 * Sign-in methods (D-34, ADR-0010 as amended): Continue with Google, or Continue with email
 * (a 6-digit code, no password and no link). New and returning members use the same flow; after
 * the code, unverified members continue to /welcome and verified ones return to `next`.
 */
export function AuthMethods({
  next,
  captchaSiteKey,
  initialError,
}: {
  next: string | null;
  captchaSiteKey: string | null;
  initialError?: string | null;
}) {
  const [step, setStep] = useState<Step>('choose');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [status, setStatus] = useState('');
  const [pending, startTransition] = useTransition();
  const turnstile = useRef<TurnstileHandle>(null);
  const emailId = useId();
  const codeId = useId();
  const errorId = useId();
  const captchaMissing = captchaSiteKey !== null && captchaToken === null;

  const send = () => {
    setError(null);
    startTransition(async () => {
      const result = await sendEmailCode({ email, captchaToken: captchaToken ?? undefined });
      turnstile.current?.reset();
      if (result.status === 'sent') {
        setStatus(SENT_COPY);
        setCode('');
        setStep('code');
      } else if (result.status === 'closed_test') {
        setError(result.message);
        setStep('closed');
      } else {
        setError(result.message);
      }
    });
  };

  const verify = () => {
    setError(null);
    startTransition(async () => {
      const result = await verifyEmailCode({ email, code }, next);
      // Only errors return; success redirects.
      setError(result.message);
    });
  };

  if (step === 'closed') {
    return (
      <div className={styles.methods}>
        <p role="alert" className={styles.closed}>
          {error}
        </p>
      </div>
    );
  }

  return (
    <div className={styles.methods}>
      {step === 'choose' ? (
        <>
          <a
            href={googleHref(next)}
            className={styles.method}
            onClick={() => {
              track({ name: 'sign_in_started', method: 'google' });
            }}
          >
            <GoogleMark />
            Continue with Google
          </a>
          <button
            type="button"
            className={styles.method}
            onClick={() => {
              track({ name: 'sign_in_started', method: 'email' });
              setStep('email');
            }}
          >
            <Mail size={18} aria-hidden="true" />
            Continue with email
          </button>
        </>
      ) : null}

      {step === 'email' ? (
        <form
          className={styles.form}
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            send();
          }}
        >
          <label htmlFor={emailId} className={styles.label}>
            Email
          </label>
          <input
            id={emailId}
            className={styles.input}
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            required
            autoFocus
            value={email}
            aria-invalid={error === null ? undefined : true}
            aria-describedby={error === null ? undefined : errorId}
            onChange={(event) => {
              setEmail(event.target.value);
            }}
          />
          {captchaSiteKey === null ? null : (
            <Turnstile ref={turnstile} siteKey={captchaSiteKey} onToken={setCaptchaToken} />
          )}
          <button
            type="submit"
            className={styles.primary}
            disabled={pending || email.trim() === '' || captchaMissing}
          >
            {pending ? 'Sending…' : 'Send code'}
          </button>
          <button
            type="button"
            className={styles.textButton}
            onClick={() => {
              setError(null);
              setStep('choose');
            }}
          >
            Other ways to continue
          </button>
        </form>
      ) : null}

      {step === 'code' ? (
        <form
          className={styles.form}
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            verify();
          }}
        >
          <p role="status" className={styles.message}>
            {status}
          </p>
          <label htmlFor={codeId} className={styles.label}>
            6-digit code
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
            required
            autoFocus
            value={code}
            aria-invalid={error === null ? undefined : true}
            aria-describedby={error === null ? undefined : errorId}
            onChange={(event) => {
              setCode(event.target.value.replace(/\D/g, '').slice(0, 6));
            }}
          />
          <button type="submit" className={styles.primary} disabled={pending || code.length !== 6}>
            {pending ? 'Checking…' : 'Continue'}
          </button>
          <div className={styles.row}>
            <button
              type="button"
              className={styles.textButton}
              onClick={() => {
                setError(null);
                setStep('email');
              }}
            >
              Send a new code
            </button>
            <button
              type="button"
              className={styles.textButton}
              onClick={() => {
                setError(null);
                setEmail('');
                setStep('email');
              }}
            >
              Use a different email
            </button>
          </div>
        </form>
      ) : null}

      <p id={errorId} role="alert" className={styles.error}>
        {error}
      </p>
    </div>
  );
}

/** Google "G" mark (brand guidelines: the multicolor G on a neutral button). */
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path
        fill="#EA4335"
        d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9h12.4c-.5 2.9-2.2 5.3-4.6 7l7.5 5.8c4.4-4.1 6.8-10 6.8-17.2z"
      />
      <path
        fill="#FBBC05"
        d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.2 0-11.5-4.1-13.4-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z"
      />
    </svg>
  );
}
