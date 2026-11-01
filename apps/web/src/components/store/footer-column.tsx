'use client';

import { ChevronDown } from 'lucide-react';
import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { COMPACT_QUERY, useMediaQuery } from '@/lib/use-media-query';
import styles from './footer.module.css';

/**
 * Footer column: a heading and list on desktop; an accordion on phones (ADR-0011). Before
 * hydration, phone CSS already hides the list, so nothing jumps.
 */
export function FooterColumn({ title, children }: { title: string; children: ReactNode }) {
  const compact = useMediaQuery(COMPACT_QUERY, false);
  const [open, setOpen] = useState(false);
  const listId = useId();
  return (
    <div className={styles.column}>
      <h2 className={styles.heading}>
        {compact ? (
          <button
            type="button"
            className={styles.accordion}
            aria-expanded={open}
            aria-controls={listId}
            onClick={() => {
              setOpen((value) => !value);
            }}
          >
            {title}
            <ChevronDown size={18} aria-hidden="true" className={styles.chevron} />
          </button>
        ) : (
          title
        )}
      </h2>
      <ul id={listId} className={styles.list} data-open={open ? 'true' : undefined}>
        {children}
      </ul>
    </div>
  );
}
