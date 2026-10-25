import { BookOpen, ShieldCheck, Video } from 'lucide-react';
import Link from 'next/link';
import type { HousePromo } from '@/lib/house-content';
import styles from './home.module.css';

const ICONS = { safety: ShieldCheck, how: BookOpen, sell: Video } as const;

/** House promos: safety, how it works, selling guide. */
export function PromoStrip({ promos }: { promos: readonly HousePromo[] }) {
  return (
    <section aria-labelledby="promo-strip" className={styles.section}>
      <h2 id="promo-strip" className="visually-hidden">
        Tips from Hucxter
      </h2>
      <ul className={styles.promoStrip}>
        {promos.map((promo) => {
          const Icon = ICONS[promo.icon];
          return (
            <li key={promo.id} className={styles.promoCard}>
              <span className={styles.promoIcon} aria-hidden="true">
                <Icon size={24} />
              </span>
              <div>
                <h3 className={styles.promoTitle}>{promo.title}</h3>
                <p className={styles.promoBody}>{promo.body}</p>
                <Link href={promo.href} className={styles.promoLink}>
                  {promo.linkLabel}
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
