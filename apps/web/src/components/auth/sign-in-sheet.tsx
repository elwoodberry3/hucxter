'use client';

import type { GatedAction } from '@hucxter/contracts';
import { X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { track } from '@/lib/analytics';
import { useToast } from '@/components/ui/toast';
import { authHref, welcomeHref } from '@/lib/next-path';
import { AuthMethods } from './auth-methods';
import { useViewer } from './viewer-context';
import styles from './auth.module.css';

interface SheetRequest {
  action: GatedAction;
  /** "Sign in to message this seller" */
  prompt: string;
}

const SheetContext = createContext<((request: SheetRequest) => void) | null>(null);

/**
 * One modal sign-in sheet per page (storefront-ia §5 guest view). Gated actions open it; it
 * offers Continue with Google and Continue with email (D-34) and returns here (`next`) after
 * sign-in and onboarding. Native <dialog>: focus is trapped, Esc closes, and focus returns to the
 * opener.
 */
export function SignInSheetProvider({
  captchaSiteKey,
  children,
}: {
  captchaSiteKey: string | null;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const [request, setRequest] = useState<SheetRequest | null>(null);
  // Remounts the methods on every open so a half-finished email step doesn't linger.
  const [openCount, setOpenCount] = useState(0);
  const pathname = usePathname();
  const query = useSearchParams().toString();
  const here = query === '' ? pathname : `${pathname}?${query}`;
  const viewer = useViewer();
  const router = useRouter();
  const toast = useToast();

  const openSheet = useCallback(
    (next: SheetRequest) => {
      openerRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setRequest(next);
      setOpenCount((count) => count + 1);
      track({
        name: 'sign_in_prompted',
        action: next.action,
        surface: pathname === '/discover' ? 'discover' : 'listing',
      });
      dialogRef.current?.showModal();
    },
    [pathname],
  );

  const open = useCallback(
    (next: SheetRequest) => {
      // Members never see the sheet: unverified ones finish onboarding first, and verified ones
      // are told the action isn't built yet (Brief 03: messaging/saving arrive later).
      if (viewer.status === 'unverified') {
        router.push(welcomeHref(here));
        return;
      }
      if (viewer.status === 'verified') {
        toast('This arrives in the next QA build.');
        return;
      }
      openSheet(next);
    },
    [viewer.status, router, here, toast, openSheet],
  );

  const close = () => {
    dialogRef.current?.close();
  };

  const value = useMemo(() => open, [open]);

  return (
    <SheetContext.Provider value={value}>
      {children}
      <dialog
        ref={dialogRef}
        className={styles.sheet}
        aria-labelledby="sign-in-sheet-title"
        onClose={() => {
          openerRef.current?.focus();
        }}
        onClick={(event) => {
          // Clicking the backdrop (the dialog element itself) closes the sheet.
          if (event.target === event.currentTarget) close();
        }}
      >
        <div className={styles.sheetBody}>
          <button type="button" className={styles.close} aria-label="Close" onClick={close}>
            <X size={20} aria-hidden="true" />
          </button>
          <h2 id="sign-in-sheet-title" className={styles.title}>
            {request?.prompt ?? 'Sign in to continue'}
          </h2>
          <p className={styles.lede}>You’ll come back to this page after you sign in.</p>
          <AuthMethods key={openCount} next={here} captchaSiteKey={captchaSiteKey} />
          <p className={styles.switch}>
            New here?{' '}
            <Link href={authHref(here, '/sign-up')} onClick={close}>
              Create an account
            </Link>
            {' · '}
            <Link href={authHref(here)} onClick={close}>
              Go to the sign-in page
            </Link>
          </p>
        </div>
      </dialog>
    </SheetContext.Provider>
  );
}

export function useSignInSheet(): (request: SheetRequest) => void {
  const open = useContext(SheetContext);
  if (open === null) throw new Error('useSignInSheet must be used inside SignInSheetProvider');
  return open;
}
