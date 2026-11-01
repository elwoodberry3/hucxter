import { Compass } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import styles from '@/components/home/home.module.css';

export const metadata: Metadata = { title: 'Discover' };

/** Placeholder until the vertical video feed ships (Brief 03, Milestone 3D). */
export default function DiscoverPage() {
  return (
    <section className={styles.comingSoon} aria-labelledby="discover-title">
      <span className={styles.comingSoonIcon} aria-hidden="true">
        <Compass size={32} />
      </span>
      <p className={styles.heroEyebrow}>Coming in the next QA build</p>
      <h1 id="discover-title" className={styles.sectionTitle}>
        Discover
      </h1>
      <p className={styles.promoSlotBody}>
        A full-screen feed of listing videos from people near you. Until then, browse by category.
      </p>
      <div className={styles.buttonRow}>
        <Link href="/#shop-by-category" className={styles.primaryButton}>
          Browse categories
        </Link>
        <Link href="/search" className={styles.secondaryButton}>
          Search
        </Link>
      </div>
    </section>
  );
}
