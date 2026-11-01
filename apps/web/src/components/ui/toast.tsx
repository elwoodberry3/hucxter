'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import styles from './toast.module.css';

const ToastContext = createContext<((message: string) => void) | null>(null);
const DURATION_MS = 4000;

/**
 * Toasts: short, honest outcome messages ("Link copied"). Announced politely, positioned above the
 * tab bar and safe area, never covering controls (the region ignores pointer events).
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('');
  const timer = useRef<number | undefined>(undefined);
  const show = useCallback((next: string) => {
    window.clearTimeout(timer.current);
    setMessage(next);
    timer.current = window.setTimeout(() => {
      setMessage('');
    }, DURATION_MS);
  }, []);
  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
    },
    [],
  );
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className={styles.region} role="status" aria-live="polite">
        {message === '' ? null : <p className={styles.toast}>{message}</p>}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): (message: string) => void {
  const show = useContext(ToastContext);
  if (show === null) throw new Error('useToast must be used inside ToastProvider');
  return show;
}
