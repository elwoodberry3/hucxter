import type { Taxonomy } from '@hucxter/contracts';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { HxLogo } from './hx-logo';
import styles from './footer.module.css';

function Column({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className={styles.column}>
      <h2 className={styles.heading}>{title}</h2>
      <ul className={styles.list}>{children}</ul>
    </div>
  );
}

function Item({ href, children }: { href: string; children: ReactNode }) {
  return (
    <li>
      <Link href={href} className={styles.link}>
        {children}
      </Link>
    </li>
  );
}

/** Big footer (storefront-ia §6). Pages that don't exist yet go to their "Coming soon" page. */
export function SiteFooter({
  taxonomy,
  locationLabel,
}: {
  taxonomy: Taxonomy;
  locationLabel: string | null;
}) {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <HxLogo />
          <p className={styles.tagline}>Buy and sell locally with short videos. Meet up nearby.</p>
        </div>
        <div className={styles.columns}>
          <Column title="Shop">
            {taxonomy.departments.map((department) => (
              <Item key={department.slug} href={`/c/${department.slug}`}>
                {department.name}
              </Item>
            ))}
          </Column>
          <Column title="Sell">
            <Item href="/how-selling-works">How selling works</Item>
            <Item href="/sell">Sell an item</Item>
            <Item href="/seller-safety">Seller safety</Item>
          </Column>
          <Column title="Safety & Help">
            <Item href="/meetup-tips">Meetup tips</Item>
            <Item href="/report-a-problem">Report a problem</Item>
            <Item href="/help">Help center</Item>
            <Item href="/contact">Contact</Item>
          </Column>
          <Column title="Company">
            <Item href="/about">About</Item>
            <Item href="/how-it-works">How Hucxter works</Item>
            <Item href="/careers">Careers</Item>
            <Item href="/press">Press</Item>
          </Column>
        </div>
      </div>
      <div className={styles.bottom}>
        <div className={styles.bottomInner}>
          <span>© {new Date().getFullYear()} Hucxter</span>
          <ul className={styles.legal}>
            <Item href="/terms">Terms</Item>
            <Item href="/privacy">Privacy</Item>
            <Item href="/prohibited-items">Prohibited items</Item>
          </ul>
          {locationLabel === null ? null : (
            <span className={styles.location}>Location: {locationLabel}</span>
          )}
        </div>
      </div>
    </footer>
  );
}
