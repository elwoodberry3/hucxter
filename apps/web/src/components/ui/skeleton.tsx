import { cx } from '@/lib/cx';
import styles from './states.module.css';

/** Placeholder for content whose layout is known. Static under reduced motion. */
export function Skeleton({
  variant = 'block',
  className,
}: {
  variant?: 'block' | 'text' | 'card';
  className?: string;
}) {
  return <span className={cx(styles.skeleton, styles[variant], className)} aria-hidden="true" />;
}
