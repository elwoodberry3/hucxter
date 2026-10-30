import {
  Baby,
  Bike,
  Briefcase,
  Flower2,
  Gift,
  Guitar,
  Hammer,
  Laptop,
  Package,
  Palette,
  PawPrint,
  Shirt,
  Sofa,
  Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cx } from '@/lib/cx';
import styles from './art.module.css';

/**
 * Placeholder department art (D-28): an icon on a soft tinted tile, keyed by `categories.hero_key`.
 * This maps art to data keys; it is not a navigation list. Unknown keys get a neutral tile.
 */
const ART: Record<string, { icon: LucideIcon; tone: 1 | 2 | 3 | 4 | 5 | 6 }> = {
  electronics: { icon: Laptop, tone: 4 },
  home: { icon: Sofa, tone: 3 },
  'garden-outdoor': { icon: Flower2, tone: 2 },
  fashion: { icon: Shirt, tone: 5 },
  'baby-kids': { icon: Baby, tone: 6 },
  'sports-outdoors': { icon: Bike, tone: 2 },
  tools: { icon: Hammer, tone: 3 },
  hobbies: { icon: Palette, tone: 5 },
  music: { icon: Guitar, tone: 1 },
  'auto-parts': { icon: Wrench, tone: 4 },
  'pet-supplies': { icon: PawPrint, tone: 6 },
  office: { icon: Briefcase, tone: 1 },
  free: { icon: Gift, tone: 2 },
  misc: { icon: Package, tone: 3 },
};

export function artTone(heroKey: string): string {
  return styles[`tone${String(ART[heroKey]?.tone ?? 1)}`] ?? '';
}

export function CategoryArt({
  heroKey,
  size = 'card',
}: {
  heroKey: string;
  size?: 'card' | 'banner' | 'chip';
}) {
  const art = ART[heroKey] ?? { icon: Package, tone: 1 };
  const Icon = art.icon;
  const iconSize = size === 'banner' ? 96 : size === 'chip' ? 20 : 48;
  return (
    <span className={cx(styles.art, styles[size], artTone(heroKey))} aria-hidden="true">
      <span className={styles.blob} />
      <Icon size={iconSize} strokeWidth={1.5} className={styles.icon} />
    </span>
  );
}
