'use client';

import { activeFilterKeys } from '@hucxter/contracts';
import { SlidersHorizontal } from 'lucide-react';
import Link from 'next/link';
import { useId, useRef, useState } from 'react';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { FilterFields, clearFiltersHref, trackFilterSubmit } from './filter-panel';
import type { FilterProps } from './filter-panel';
import styles from './results.module.css';

/**
 * Phone filters (ADR-0011): a "Filters" button opens a bottom sheet with the same fields as the
 * desktop panel. Apply submits a GET form, so filter state stays in the URL. Hidden at 64rem+.
 */
export function FilterDrawer(props: FilterProps) {
  const { action, query, surface } = props;
  const [open, setOpen] = useState(false);
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const count = activeFilterKeys(query).filter((key) => key !== 'distance').length;

  return (
    <div className={styles.drawerAnchor}>
      <button
        type="button"
        className={styles.filtersButton}
        aria-haspopup="dialog"
        onClick={() => {
          setOpen(true);
        }}
      >
        <SlidersHorizontal size={18} aria-hidden="true" />
        Filters{count > 0 ? ` (${String(count)})` : ''}
      </button>
      <BottomSheet
        open={open}
        title="Filters"
        onClose={() => {
          setOpen(false);
        }}
        onNavigate={(_href, kind) => {
          if (kind === 'form' && formRef.current !== null)
            trackFilterSubmit(formRef.current, surface);
        }}
        footer={
          <>
            <Link href={clearFiltersHref(action, query)} className={styles.drawerClear}>
              Clear
            </Link>
            <button type="submit" form={formId} className={styles.drawerApply}>
              Apply
            </button>
          </>
        }
      >
        <form ref={formRef} id={formId} action={action} method="get" className={styles.form}>
          <FilterFields {...props} idPrefix={`drawer${formId.replace(/[^a-z0-9]/gi, '')}`} />
        </form>
      </BottomSheet>
    </div>
  );
}
