import styles from './shell.module.css';

export function PagePlaceholder({ title, children }: { title: string; children: string }) {
  return (
    <section className={styles.placeholder} aria-labelledby="page-title">
      <h1 id="page-title" className={styles.pageTitle}>
        {title}
      </h1>
      <p className={styles.pageBody}>{children}</p>
    </section>
  );
}
