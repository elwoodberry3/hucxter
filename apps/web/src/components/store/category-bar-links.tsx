'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { NavDepartment } from './category-bar';
import styles from './category-bar.module.css';

/** Top-level department links; the active department is underlined and marked aria-current. */
export function CategoryBarLinks({ departments }: { departments: NavDepartment[] }) {
  const pathname = usePathname();
  return (
    <ul className={styles.links}>
      {departments.map((department) => {
        const href = `/c/${department.slug}`;
        const exact = pathname === href;
        const within = pathname.startsWith(`${href}/`);
        return (
          <li key={department.slug}>
            <Link
              href={href}
              className={styles.link}
              aria-current={exact ? 'page' : within ? 'true' : undefined}
              data-active={exact || within ? 'true' : undefined}
            >
              {department.navLabel}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
