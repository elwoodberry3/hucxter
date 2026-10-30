import type { Department } from '@hucxter/contracts';
import Link from 'next/link';
import { CategoryArt } from '@/components/art/category-art';
import styles from './home.module.css';

/** "Shop by category": every department, from the taxonomy data. */
export function CategoryGrid({ departments }: { departments: Department[] }) {
  return (
    <section aria-labelledby="shop-by-category" className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 id="shop-by-category" className={styles.sectionTitle}>
          Shop by category
        </h2>
      </div>
      <ul className={styles.categoryGrid}>
        {departments.map((department) => (
          <li key={department.slug}>
            <Link href={`/c/${department.slug}`} className={styles.categoryCard}>
              <CategoryArt heroKey={department.heroKey} />
              <span className={styles.categoryName}>{department.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
