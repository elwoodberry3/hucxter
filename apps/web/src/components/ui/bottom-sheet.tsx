'use client';

import { X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import type { ReactNode, SyntheticEvent } from 'react';
import { createPortal } from 'react-dom';
import { cx } from '@/lib/cx';
import { isSheetEntry, sheetNavigationTarget, withSheetMarker } from '@/lib/sheet-history';
import styles from './bottom-sheet.module.css';

export type SheetSize = 'peek' | 'expanded' | 'full';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const DRAG_CLOSE_PX = 96;
const DRAG_RESIZE_PX = 48;

const subscribeNothing = () => () => undefined;

/**
 * Bottom sheet (mobile standard Layer C, ADR-0011). Modal: focus is trapped, the rest of the page is
 * inert, and page scroll is locked. Closes with the close button, Esc, or the browser Back button
 * (opening pushes one history entry). Links and GET forms inside the sheet pop that entry before
 * navigating, so Back never returns to a ghost "open" state. Focus returns to the opener.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  footer,
  size: initialSize = 'expanded',
  expandable = false,
  onNavigate,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: SheetSize;
  /** Peek/expanded toggle with a drag handle and an equivalent button. */
  expandable?: boolean;
  /** Called with the destination before a link/form inside the sheet navigates. */
  onNavigate?: (href: string, kind: 'link' | 'form') => void;
  className?: string;
}) {
  const router = useRouter();
  const id = useId();
  const titleId = `${id}-title`;
  const sheetRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const afterPopRef = useRef<(() => void) | null>(null);
  const onCloseRef = useRef(onClose);
  const [size, setSize] = useState<SheetSize>(initialSize);
  // True only on the client (portals need document.body).
  const mounted = useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
  const dragStart = useRef<number | null>(null);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  /** Close, then optionally run `then` (e.g. navigate) once our history entry is gone. */
  const requestClose = useCallback(
    (then?: () => void) => {
      if (isSheetEntry(window.history.state, id)) {
        afterPopRef.current = then ?? null;
        window.history.back();
      } else {
        onCloseRef.current();
        then?.();
      }
    },
    [id],
  );

  // Open: remember the opener, push our history entry, lock scroll, make the page inert.
  useEffect(() => {
    if (!open || !mounted) return;
    openerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    window.history.pushState(withSheetMarker(window.history.state, id), '');

    const onPopState = () => {
      if (isSheetEntry(window.history.state, id)) return;
      onCloseRef.current();
      const then = afterPopRef.current;
      afterPopRef.current = null;
      then?.();
    };
    window.addEventListener('popstate', onPopState);

    const root = document.documentElement;
    root.dataset.sheetOpen = 'true';
    const portal = sheetRef.current?.closest('[data-sheet-portal]');
    const inerted = Array.from(document.body.children).filter(
      (element) => element !== portal && !element.hasAttribute('inert'),
    );
    for (const element of inerted) element.setAttribute('inert', '');

    return () => {
      window.removeEventListener('popstate', onPopState);
      delete root.dataset.sheetOpen;
      for (const element of inerted) element.removeAttribute('inert');
      // Unmounted without going through requestClose (e.g. parent closed it): drop our entry.
      if (isSheetEntry(window.history.state, id)) window.history.back();
      const opener = openerRef.current;
      if (opener?.isConnected) opener.focus();
    };
  }, [open, id, mounted]);

  // Initial focus inside the sheet.
  useEffect(() => {
    if (!open || !mounted) return;
    const sheet = sheetRef.current;
    const first =
      sheet?.querySelector<HTMLElement>('[data-autofocus]') ??
      sheet?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? sheet)?.focus();
  }, [open, mounted]);

  if (!open || !mounted) return null;

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      requestClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusables = Array.from(sheetRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (first === undefined || last === undefined) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  // Capture phase: runs before next/link and next/form handlers inside the sheet.
  const interceptNavigation = (event: SyntheticEvent) => {
    const native = event.nativeEvent as MouseEvent | SubmitEvent;
    const href = sheetNavigationTarget(
      {
        target: event.target,
        type: event.type,
        button: 'button' in native ? native.button : 0,
        metaKey: 'metaKey' in native && native.metaKey,
        ctrlKey: 'ctrlKey' in native && native.ctrlKey,
        shiftKey: 'shiftKey' in native && native.shiftKey,
        altKey: 'altKey' in native && native.altKey,
        defaultPrevented: event.defaultPrevented,
      },
      window.location.origin,
    );
    if (href === null) return;
    event.preventDefault();
    event.stopPropagation();
    onNavigate?.(href, event.type === 'submit' ? 'form' : 'link');
    requestClose(() => {
      router.push(href);
    });
  };

  // Drag offset goes through CSSOM (a custom property), never an inline style attribute.
  const setDrag = (px: number) => {
    sheetRef.current?.style.setProperty('--hx-sheet-drag', `${String(px)}px`);
    if (sheetRef.current !== null) sheetRef.current.dataset.dragging = px > 0 ? 'true' : 'false';
  };
  const onDragStart = (event: React.PointerEvent) => {
    dragStart.current = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onDragMove = (event: React.PointerEvent) => {
    if (dragStart.current === null) return;
    setDrag(Math.max(0, event.clientY - dragStart.current));
  };
  const onDragEnd = (event: React.PointerEvent) => {
    if (dragStart.current === null) return;
    const delta = event.clientY - dragStart.current;
    dragStart.current = null;
    setDrag(0);
    if (delta > DRAG_CLOSE_PX && size !== 'expanded') requestClose();
    else if (delta > DRAG_RESIZE_PX && size === 'expanded' && expandable) setSize('peek');
    else if (delta > DRAG_CLOSE_PX) requestClose();
    else if (delta < -DRAG_RESIZE_PX && expandable) setSize('expanded');
  };

  return createPortal(
    <div data-sheet-portal className={styles.portal}>
      <div
        className={styles.backdrop}
        aria-hidden="true"
        onClick={() => {
          requestClose();
        }}
      />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        data-size={size}
        className={cx(styles.sheet, className)}
        onKeyDown={onKeyDown}
        onClickCapture={interceptNavigation}
        onSubmitCapture={interceptNavigation}
      >
        <div
          className={styles.handleArea}
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
        >
          <span className={styles.handle} aria-hidden="true" />
        </div>
        <div className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          {expandable ? (
            <button
              type="button"
              className={styles.textButton}
              aria-expanded={size === 'expanded'}
              onClick={() => {
                setSize((value) => (value === 'expanded' ? 'peek' : 'expanded'));
              }}
            >
              {size === 'expanded' ? 'Collapse' : 'Expand'}
            </button>
          ) : null}
          <button
            type="button"
            className={styles.close}
            aria-label="Close"
            onClick={() => {
              requestClose();
            }}
          >
            <X size={22} aria-hidden="true" />
          </button>
        </div>
        <div className={styles.body}>{children}</div>
        {footer === undefined ? null : <div className={styles.footer}>{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
