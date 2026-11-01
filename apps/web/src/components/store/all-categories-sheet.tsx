'use client';

import { ChevronLeft, ChevronRight, LayoutGrid } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import type { NavDepartment } from './category-bar';
import styles from './category-bar.module.css';

/**
 * Phone "All categories" (ADR-0011): a full-screen sheet with department → subcategory drill-in.
 * Replaces the desktop mega menu below 64rem.
 */
export function AllCategoriesSheet({ departments }: { departments: NavDepartment[] }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const department = departments.find((item) => item.slug === selected);

  return (
    <>
      <button
        type="button"
        className={styles.allButton}
        aria-haspopup="dialog"
        onClick={() => {
          setSelected(null);
          setOpen(true);
        }}
      >
        <LayoutGrid size={18} aria-hidden="true" />
        All
      </button>
      <BottomSheet
        open={open}
        size="full"
        title={department === undefined ? 'All categories' : department.name}
        onClose={() => {
          setOpen(false);
        }}
      >
        {department === undefined ? (
          <ul className={styles.sheetList}>
            {departments.map((item) => (
              <li key={item.slug}>
                <button
                  type="button"
                  className={styles.sheetRow}
                  onClick={() => {
                    setSelected(item.slug);
                  }}
                >
                  <span>{item.name}</span>
                  <ChevronRight size={18} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className={styles.sheetDrill}>
            <button
              type="button"
              className={styles.sheetBack}
              data-autofocus
              onClick={() => {
                setSelected(null);
              }}
            >
              <ChevronLeft size={18} aria-hidden="true" />
              All departments
            </button>
            <ul className={styles.sheetList}>
              <li>
                <Link href={`/c/${department.slug}`} className={styles.sheetRowStrong}>
                  Shop all {department.name}
                </Link>
              </li>
              {department.subcategories.map((subcategory) => (
                <li key={subcategory.slug}>
                  <Link
                    href={`/c/${department.slug}/${subcategory.slug}`}
                    className={styles.sheetRow}
                  >
                    {subcategory.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </BottomSheet>
    </>
  );
}
