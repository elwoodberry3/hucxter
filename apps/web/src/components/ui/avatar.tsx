import { CircleUser } from 'lucide-react';
import { cx } from '@/lib/cx';
import styles from './avatar.module.css';

export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

const ICON_PX: Record<AvatarSize, number> = { sm: 18, md: 24, lg: 32, xl: 40 };

/** Up to two initials from a display name ("Sam Rivera" → "SR"); empty when there's no name. */
export function initials(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((part) => Array.from(part)[0]?.toUpperCase() ?? '')
    .join('');
}

/**
 * A member's profile photo, or their initials when there's no photo (or photos are off). Always
 * decorative: the name sits next to it, so screen readers don't hear it twice.
 */
export function Avatar({
  name,
  src,
  size = 'md',
}: {
  name: string | null | undefined;
  src: string | null | undefined;
  size?: AvatarSize;
}) {
  const className = cx(styles.avatar, styles[size]);
  if (src !== null && src !== undefined && src !== '') {
    // eslint-disable-next-line @next/next/no-img-element -- next/image adds inline styles the CSP blocks
    return <img className={className} src={src} alt="" aria-hidden="true" decoding="async" />;
  }
  const letters = initials(name);
  return (
    <span className={className} aria-hidden="true" data-avatar="initials">
      {letters === '' ? <CircleUser size={ICON_PX[size]} /> : letters}
    </span>
  );
}
