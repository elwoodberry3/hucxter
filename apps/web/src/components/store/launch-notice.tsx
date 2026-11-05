'use client';

import { Info, X } from 'lucide-react';
import { useState, useTransition } from 'react';
import { dismissLaunchNotice } from '@/app/actions/launch-notice';
import styles from './launch-notice.module.css';

/** Non-blocking, dismissible note shown when the viewer's ZIP is outside every launch area. */
export function LaunchNotice({ message }: { message: string }) {
  const [hidden, setHidden] = useState(false);
  const [, startTransition] = useTransition();
  if (hidden) return null;
  return (
    <aside className={styles.notice} aria-label="Launch area">
      <div className={styles.inner}>
        <Info size={18} aria-hidden="true" className={styles.icon} />
        <p className={styles.text}>{message}</p>
        <button
          type="button"
          className={styles.dismiss}
          aria-label="Dismiss launch area notice"
          onClick={() => {
            setHidden(true);
            startTransition(async () => {
              await dismissLaunchNotice();
            });
          }}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}
