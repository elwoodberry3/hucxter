'use client';

import type { GatedAction } from '@hucxter/contracts';
import type { ReactNode } from 'react';
import { useSignInSheet } from '@/components/auth/sign-in-sheet';

/** An action that needs an account. For guests it opens the sign-in sheet. */
export function GatedActionButton({
  action,
  prompt,
  children,
  className,
  label,
}: {
  action: GatedAction;
  prompt: string;
  children: ReactNode;
  className?: string | undefined;
  /** Accessible name for icon-only buttons. */
  label?: string | undefined;
}) {
  const openSheet = useSignInSheet();
  return (
    <button
      type="button"
      className={className}
      aria-haspopup="dialog"
      aria-label={label}
      onClick={() => {
        openSheet({ action, prompt });
      }}
    >
      {children}
    </button>
  );
}
