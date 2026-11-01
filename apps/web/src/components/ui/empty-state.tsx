import type { ReactNode } from 'react';
import styles from './states.module.css';

/** Designed empty state: art, a plain title, one honest sentence, and next steps. */
export function EmptyState({
  art,
  title,
  body,
  actions,
  headingLevel = 3,
}: {
  art?: ReactNode;
  title: string;
  body: string;
  actions?: ReactNode;
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <div className={styles.empty}>
      {art === undefined ? null : <div className={styles.art}>{art}</div>}
      <Heading className={styles.title}>{title}</Heading>
      <p className={styles.body}>{body}</p>
      {actions === undefined ? null : <div className={styles.actions}>{actions}</div>}
    </div>
  );
}
