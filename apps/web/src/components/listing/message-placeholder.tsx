import { MessageCircle } from 'lucide-react';
import { useId } from 'react';
import { cx } from '@/lib/cx';
import styles from './template.module.css';

/** "Is this still available?", disabled until messaging ships (Brief 03 §2). */
export function MessagePlaceholder({ className }: { className?: string | undefined }) {
  const noteId = useId();
  return (
    <>
      <button
        type="button"
        className={cx(styles.primary, className)}
        disabled
        aria-describedby={noteId}
      >
        <MessageCircle size={18} aria-hidden="true" />
        Is this still available?
      </button>
      <p id={noteId} className={styles.primaryNote}>
        Messaging arrives in the next QA build
      </p>
    </>
  );
}
