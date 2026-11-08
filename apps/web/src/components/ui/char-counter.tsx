import styles from './char-counter.module.css';

/** "12/25" under a text field; announced politely as the value changes. */
export function CharCounter({ id, value, max }: { id: string; value: string; max: number }) {
  return (
    <span id={id} className={styles.counter} aria-live="polite">
      {value.length}/{max}
    </span>
  );
}
