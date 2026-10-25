import styles from './hero-art.module.css';

/** Placeholder hero illustrations (D-28): simple in-repo SVG scenes styled by tokens. */
export function HeroArt({ art }: { art: 'holiday' | 'sell' | 'safety' }) {
  return (
    <svg viewBox="0 0 480 300" className={styles.svg} aria-hidden="true" focusable="false">
      <rect width="480" height="300" rx="24" className={styles.sky} />
      <circle cx="390" cy="70" r="46" className={styles.sun} />
      <path d="M0 230 Q120 190 240 225 T480 215 V300 H0Z" className={styles.hill} />
      {art === 'holiday' ? (
        <g>
          <rect x="120" y="150" width="90" height="80" rx="10" className={styles.boxA} />
          <rect x="158" y="150" width="14" height="80" className={styles.ribbon} />
          <rect x="120" y="182" width="90" height="14" className={styles.ribbon} />
          <rect x="230" y="120" width="110" height="110" rx="12" className={styles.boxB} />
          <rect x="278" y="120" width="14" height="110" className={styles.ribbon} />
          <rect x="230" y="168" width="110" height="14" className={styles.ribbon} />
          <circle cx="90" cy="70" r="6" className={styles.spark} />
          <circle cx="200" cy="50" r="4" className={styles.spark} />
          <circle cx="330" cy="40" r="5" className={styles.spark} />
        </g>
      ) : art === 'sell' ? (
        <g>
          <rect x="150" y="60" width="120" height="200" rx="18" className={styles.phone} />
          <rect x="162" y="80" width="96" height="150" rx="8" className={styles.screen} />
          <path d="M198 135 L232 155 L198 175 Z" className={styles.play} />
          <rect x="300" y="150" width="80" height="80" rx="10" className={styles.boxA} />
          <path d="M300 170 h80" className={styles.line} />
        </g>
      ) : (
        <g>
          <path
            d="M240 60 L310 88 V150 C310 195 280 225 240 240 C200 225 170 195 170 150 V88 Z"
            className={styles.shield}
          />
          <path d="M210 150 L232 172 L274 128" className={styles.check} />
          <circle cx="110" cy="200" r="22" className={styles.boxA} />
          <circle cx="370" cy="200" r="22" className={styles.boxB} />
        </g>
      )}
    </svg>
  );
}
