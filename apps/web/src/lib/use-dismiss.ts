'use client';

import { useEffect } from 'react';
import type { RefObject } from 'react';

/**
 * Closes a popover on Escape (returning focus to its trigger) or on a pointer press outside the
 * given elements (leaving focus where the user put it).
 */
export function useDismiss(
  open: boolean,
  close: (returnFocus: boolean) => void,
  refs: readonly RefObject<HTMLElement | null>[],
): void {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close(true);
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!refs.some((ref) => ref.current?.contains(target))) close(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open, close, refs]);
}

/** Moves focus between the focusable links/buttons in `container` with ↑/↓, Home and End. */
export function moveFocusWithArrows(
  event: React.KeyboardEvent,
  container: HTMLElement | null,
): void {
  if (container === null) return;
  const items = Array.from(
    container.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'),
  );
  if (items.length === 0) return;
  const index = items.indexOf(document.activeElement as HTMLElement);
  let next: number | null = null;
  if (event.key === 'ArrowDown') next = index < 0 ? 0 : (index + 1) % items.length;
  else if (event.key === 'ArrowUp') next = index <= 0 ? items.length - 1 : index - 1;
  else if (event.key === 'Home') next = 0;
  else if (event.key === 'End') next = items.length - 1;
  if (next === null) return;
  event.preventDefault();
  items[next]?.focus();
}
