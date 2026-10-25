import { Clock } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import styles from '@/components/home/home.module.css';
import { infoPage } from '@/lib/info-pages';

export async function generateMetadata({ params }: PageProps<'/[page]'>): Promise<Metadata> {
  const page = infoPage((await params).page);
  return { title: page?.title ?? 'Not found' };
}

/**
 * "Coming soon" for footer pages that don't exist yet, served at their final URLs so links never
 * 404. Only slugs in lib/info-pages.ts render; anything else is a real 404.
 */
export default async function ComingSoonPage({ params }: PageProps<'/[page]'>) {
  const page = infoPage((await params).page);
  if (page === undefined) notFound();
  return (
    <section className={styles.comingSoon} aria-labelledby="coming-soon-title">
      <span className={styles.comingSoonIcon} aria-hidden="true">
        <Clock size={32} />
      </span>
      <p className={styles.heroEyebrow}>Coming soon</p>
      <h1 id="coming-soon-title" className={styles.sectionTitle}>
        {page.title}
      </h1>
      <p className={styles.promoSlotBody}>{page.summary}</p>
      <p className={styles.promoSlotBody}>This page isn’t ready yet. Check back soon.</p>
      <div className={styles.buttonRow}>
        <Link href="/" className={styles.primaryButton}>
          Back to the Feed
        </Link>
        <Link href="/#shop-by-category" className={styles.secondaryButton}>
          Browse categories
        </Link>
      </div>
    </section>
  );
}
