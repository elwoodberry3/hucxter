'use client';

import { ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useId, useMemo, useRef, useState } from 'react';
import { moveFocusWithArrows, useDismiss } from '@/lib/use-dismiss';
import type { NavDepartment } from './category-bar';
import styles from './category-bar.module.css';

/** "More" disclosure listing the departments that aren't in the bar. */
export function MoreMenu({ departments }: { departments: NavDepartment[] }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const refs = useMemo(() => [triggerRef, panelRef], []);
  const id = useId();
  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);
  useDismiss(open, close, refs);

  return (
    <div className={styles.moreAnchor}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.link}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          setOpen((value) => !value);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && !open) {
            event.preventDefault();
            setOpen(true);
            requestAnimationFrame(() => panelRef.current?.querySelector('a')?.focus());
          }
        }}
      >
        More
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      <div
        ref={panelRef}
        id={id}
        className={styles.morePanel}
        hidden={!open}
        onKeyDown={(event) => {
          moveFocusWithArrows(event, panelRef.current);
        }}
      >
        <ul className={styles.moreList}>
          {departments.map((department) => (
            <li key={department.slug}>
              <Link
                href={`/c/${department.slug}`}
                className={styles.moreLink}
                onClick={() => {
                  setOpen(false);
                }}
              >
                {department.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
