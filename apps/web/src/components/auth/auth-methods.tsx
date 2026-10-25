'use client';

import type { SignInMethod } from '@hucxter/contracts';
import { Mail } from 'lucide-react';
import { useId, useState } from 'react';
import { track } from '@/lib/analytics';
import styles from './auth.module.css';

const METHODS: { method: SignInMethod; label: string }[] = [
  { method: 'email', label: 'Continue with email' },
  { method: 'facebook', label: 'Continue with Facebook' },
  { method: 'tiktok', label: 'Continue with TikTok' },
];

/**
 * Sign-in methods (ADR-0010). UI only in Brief 02: no provider is connected yet, so each button
 * explains that sign-in opens in the next release instead of pretending to work.
 */
export function AuthMethods() {
  const [message, setMessage] = useState('');
  const availabilityId = useId();
  return (
    <div className={styles.methods}>
      {METHODS.map(({ method, label }) => (
        <button
          key={method}
          type="button"
          className={styles.method}
          aria-describedby={availabilityId}
          onClick={() => {
            track({ name: 'sign_in_started', method });
            setMessage(
              `${label.replace('Continue with ', 'Signing in with ')} is available in the next release.`,
            );
          }}
        >
          {method === 'email' ? <Mail size={18} aria-hidden="true" /> : null}
          {label}
        </button>
      ))}
      <p id={availabilityId} className={styles.availability}>
        Available in the next release. Hucxter accounts are opening soon.
      </p>
      <p role="status" className={styles.message}>
        {message}
      </p>
    </div>
  );
}
