import { Skeleton } from './skeleton';
import styles from './skeleton-layout.module.css';

/** Loading placeholder for category and search results (layout is known). */
export function ResultsSkeleton() {
  return (
    <div className={styles.page} aria-busy="true" aria-label="Loading results">
      <Skeleton variant="text" />
      <Skeleton variant="block" />
      <div className={styles.grid}>
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} variant="card" />
        ))}
      </div>
    </div>
  );
}
