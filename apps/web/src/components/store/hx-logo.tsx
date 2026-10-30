import Link from 'next/link';
import styles from './header.module.css';

/** Hx mark + wordmark, linking home (the Feed). */
export function HxLogo() {
  return (
    <Link href="/" className={styles.logo}>
      {/* Plain <img>: next/image adds an inline style attribute that the strict CSP blocks. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon-192.png" alt="" width={32} height={32} className={styles.mark} />
      <span>Hucxter</span>
    </Link>
  );
}
