'use client';

import { ChevronRight, Menu } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { track } from '@/lib/analytics';
import { useDismiss } from '@/lib/use-dismiss';
import type { NavDepartment } from './category-bar';
import styles from './mega-menu.module.css';

const HOVER_DELAY_MS = 250;

/**
 * "All Categories" mega menu (storefront-ia §2). Departments are a vertical tab list; the panel
 * shows the active department's subcategories. Keyboard: ↑/↓/Home/End switch departments,
 * → enters the panel, ← returns, Tab is trapped while open, Esc closes and returns focus.
 * Opens on click; hovering the trigger opens it after a short delay (never hover-only).
 */
export function MegaMenu({ departments }: { departments: NavDepartment[] }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const hoverTimer = useRef<number | undefined>(undefined);
  const openedByHover = useRef(false);
  const refs = useMemo(() => [triggerRef, dialogRef], []);
  const id = useId();
  const dialogId = `${id}-dialog`;
  const panelId = `${id}-panel`;

  const close = useCallback((returnFocus: boolean) => {
    window.clearTimeout(hoverTimer.current);
    openedByHover.current = false;
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);
  useDismiss(open, close, refs);

  const show = useCallback((via: 'click' | 'hover' | 'keyboard') => {
    openedByHover.current = via === 'hover';
    setOpen(true);
    track({ name: 'mega_menu_opened', via });
  }, []);

  // Move focus into the menu when it opens by click or keyboard (not on hover).
  useEffect(() => {
    if (open && !openedByHover.current) tabRefs.current[active]?.focus();
    // Only when opening; switching departments manages focus itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(
    () => () => {
      window.clearTimeout(hoverTimer.current);
    },
    [],
  );

  const focusTab = (index: number) => {
    const count = departments.length;
    const next = (index + count) % count;
    setActive(next);
    tabRefs.current[next]?.focus();
  };

  const onTabKeyDown = (event: ReactKeyboardEvent, index: number) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        focusTab(index + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        focusTab(index - 1);
        break;
      case 'Home':
        event.preventDefault();
        focusTab(0);
        break;
      case 'End':
        event.preventDefault();
        focusTab(departments.length - 1);
        break;
      case 'ArrowRight':
        event.preventDefault();
        panelRef.current?.querySelector<HTMLElement>('a')?.focus();
        break;
    }
  };

  const onPanelKeyDown = (event: ReactKeyboardEvent) => {
    const links = Array.from(panelRef.current?.querySelectorAll<HTMLElement>('a') ?? []);
    const index = links.indexOf(document.activeElement as HTMLElement);
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      tabRefs.current[active]?.focus();
    } else if (event.key === 'ArrowDown' && index >= 0) {
      event.preventDefault();
      links[(index + 1) % links.length]?.focus();
    } else if (event.key === 'ArrowUp' && index >= 0) {
      event.preventDefault();
      links[(index - 1 + links.length) % links.length]?.focus();
    }
  };

  // Keep Tab inside the open menu.
  const onDialogKeyDown = (event: ReactKeyboardEvent) => {
    if (event.key !== 'Tab') return;
    const focusables = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([tabindex="-1"])') ??
        [],
    );
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

  const department = departments[active];

  return (
    <div
      className={styles.anchor}
      onMouseLeave={() => {
        window.clearTimeout(hoverTimer.current);
        if (open && openedByHover.current) {
          hoverTimer.current = window.setTimeout(() => {
            close(false);
          }, HOVER_DELAY_MS);
        }
      }}
      onMouseEnter={() => {
        window.clearTimeout(hoverTimer.current);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-controls={dialogId}
        aria-haspopup="dialog"
        onClick={(event) => {
          window.clearTimeout(hoverTimer.current);
          if (!open) {
            show(event.detail === 0 ? 'keyboard' : 'click');
          } else if (openedByHover.current) {
            // Clicking a hover-opened menu keeps it open and moves focus in.
            openedByHover.current = false;
            tabRefs.current[active]?.focus();
          } else {
            close(false);
          }
        }}
        onMouseEnter={() => {
          if (open) return;
          window.clearTimeout(hoverTimer.current);
          hoverTimer.current = window.setTimeout(() => {
            show('hover');
          }, HOVER_DELAY_MS);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && !open) {
            event.preventDefault();
            show('keyboard');
          }
        }}
      >
        <Menu size={18} aria-hidden="true" />
        All Categories
      </button>

      <div
        ref={dialogRef}
        id={dialogId}
        role="dialog"
        aria-modal="true"
        aria-label="All categories"
        className={styles.dialog}
        hidden={!open}
        onKeyDown={onDialogKeyDown}
      >
        <div
          role="tablist"
          aria-orientation="vertical"
          aria-label="Departments"
          className={styles.tabs}
        >
          {departments.map((item, index) => (
            <button
              key={item.slug}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              type="button"
              role="tab"
              id={`${id}-tab-${item.slug}`}
              aria-selected={index === active}
              aria-controls={panelId}
              tabIndex={index === active ? 0 : -1}
              className={styles.tab}
              onClick={() => {
                setActive(index);
              }}
              onMouseEnter={() => {
                setActive(index);
              }}
              onKeyDown={(event) => {
                onTabKeyDown(event, index);
              }}
            >
              <span>{item.name}</span>
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          ))}
        </div>

        {department === undefined ? null : (
          <div
            ref={panelRef}
            role="tabpanel"
            id={panelId}
            aria-labelledby={`${id}-tab-${department.slug}`}
            className={styles.panel}
            onKeyDown={onPanelKeyDown}
          >
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>{department.name}</h2>
              <Link
                href={`/c/${department.slug}`}
                className={styles.shopAll}
                onClick={() => {
                  close(false);
                }}
              >
                Shop all {department.name}
              </Link>
            </div>
            <ul className={styles.columns}>
              {department.subcategories.map((subcategory) => (
                <li key={subcategory.slug}>
                  <Link
                    href={`/c/${department.slug}/${subcategory.slug}`}
                    className={styles.subLink}
                    onClick={() => {
                      close(false);
                    }}
                  >
                    {subcategory.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
