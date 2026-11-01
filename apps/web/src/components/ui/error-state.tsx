'use client';

import { RotateCcw, TriangleAlert } from 'lucide-react';
import styles from './states.module.css';

/** Error with a retry. Says what happened in plain words; never exposes internals. */
export function ErrorState({
  title = 'Something went wrong',
  body = 'We couldn’t load this page. Check your connection and try again.',
  onRetry,
}: {
  title?: string;
  body?: string;
  onRetry?: () => void;
}) {
  return (
    <div className={styles.empty} role="alert">
      <span className={styles.icon} aria-hidden="true">
        <TriangleAlert size={28} />
      </span>
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.body}>{body}</p>
      {onRetry === undefined ? null : (
        <div className={styles.actions}>
          <button type="button" className={styles.button} onClick={onRetry}>
            <RotateCcw size={16} aria-hidden="true" />
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
