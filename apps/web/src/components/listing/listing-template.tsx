import type { AttributeFilter, Department, ListingDetail } from '@hucxter/contracts';
import { CONDITION_LABELS, formatPrice } from '@hucxter/contracts';
import { BadgeCheck, Flag, Heart, MapPin, MessageCircle, Play, ShieldCheck } from 'lucide-react';
import { Breadcrumb, SubcategoryRow } from '@/components/results/results-layout';
import { GatedActionButton } from './gated-action';
import { ShareButton } from './share-button';
import { StatusBadge } from './status-badge';
import styles from './template.module.css';

function formatMemberSince(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function postedAgo(iso: string, now: Date = new Date()): string {
  const hours = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 3_600_000));
  if (hours < 1) return 'Posted just now';
  if (hours < 24) return `Posted ${String(hours)} h ago`;
  const days = Math.round(hours / 24);
  return `Posted ${String(days)} ${days === 1 ? 'day' : 'days'} ago`;
}

/**
 * Product page template (storefront-ia §5): vertical video left, detail column right. Used by
 * /dev/templates/listing now and by /l/[id] once listings exist (Brief 04).
 */
export function ListingTemplate({
  listing,
  department,
  filters,
}: {
  listing: ListingDetail;
  department: Department;
  filters: AttributeFilter[];
}) {
  const subcategory = department.subcategories.find((sub) => sub.slug === listing.category_slug);
  const attributeRows = filters.flatMap((filter) => {
    const value = listing.attributes[filter.key];
    if (value === undefined) return [];
    const shown =
      typeof value === 'boolean'
        ? value
          ? 'Yes'
          : 'No'
        : `${String(value)}${filter.type === 'enum' && filter.unit !== undefined ? ` ${filter.unit}` : ''}`;
    return [{ label: filter.label, value: shown }];
  });

  const primary =
    listing.status === 'sold'
      ? null
      : listing.status === 'pending'
        ? 'Let me know if it falls through'
        : 'Is this still available?';

  return (
    <>
      <Breadcrumb
        items={[
          { label: 'Feed', href: '/' },
          { label: department.name, href: `/c/${department.slug}` },
          ...(subcategory === undefined
            ? []
            : [{ label: subcategory.name, href: `/c/${department.slug}/${subcategory.slug}` }]),
          { label: listing.title },
        ]}
      />
      <SubcategoryRow department={department} activeSlug={subcategory?.slug} />

      <article className={styles.layout} aria-labelledby="listing-title">
        <div className={styles.videoColumn}>
          <div className={styles.video}>
            {/* Mux Player arrives in Brief 05; the poster stands in for the 9:16 video. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={listing.poster_url} alt="" className={styles.poster} />
            {listing.is_demo ? <span className={styles.demoTag}>Demo</span> : null}
            <span className={styles.playHint}>
              <Play size={20} aria-hidden="true" />
              Video plays here
            </span>
          </div>
        </div>

        <div className={styles.details}>
          <div className={styles.titleBlock}>
            <StatusBadge status={listing.status} />
            <h1 id="listing-title" className={styles.title}>
              {listing.title}
            </h1>
            <p className={styles.price}>{formatPrice(listing.price_cents)}</p>
            <p className={styles.meta}>
              {CONDITION_LABELS[listing.condition]} · {listing.distance_bucket} ·{' '}
              {listing.area_label} · {postedAgo(listing.posted_at)}
            </p>
          </div>

          <div className={styles.actions}>
            {primary === null ? (
              <p className={styles.soldNote}>
                This item has sold. The seller isn’t taking new messages.
              </p>
            ) : (
              <GatedActionButton
                action="availability"
                prompt="Sign in to message this seller"
                className={styles.primary}
              >
                <MessageCircle size={18} aria-hidden="true" />
                {primary}
              </GatedActionButton>
            )}
            <div className={styles.secondaryRow}>
              <GatedActionButton
                action="save"
                prompt="Sign in to save items"
                className={styles.secondary}
              >
                <Heart size={18} aria-hidden="true" />
                Save
              </GatedActionButton>
              <ShareButton className={styles.secondary} />
              <GatedActionButton
                action="report"
                prompt="Sign in to report a listing"
                className={styles.secondary}
              >
                <Flag size={18} aria-hidden="true" />
                Report
              </GatedActionButton>
            </div>
          </div>

          {attributeRows.length === 0 ? null : (
            <section aria-labelledby="details-heading" className={styles.panel}>
              <h2 id="details-heading" className={styles.panelTitle}>
                Details
              </h2>
              <dl className={styles.attributes}>
                {attributeRows.map((row) => (
                  <div key={row.label} className={styles.attributeRow}>
                    <dt>{row.label}</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          <section aria-labelledby="description-heading" className={styles.panel}>
            <h2 id="description-heading" className={styles.panelTitle}>
              Description
            </h2>
            <p className={styles.description}>{listing.description}</p>
          </section>

          <section aria-labelledby="seller-heading" className={styles.panel}>
            <h2 id="seller-heading" className={styles.panelTitle}>
              Seller
            </h2>
            <p className={styles.sellerName}>{listing.seller.display_name}</p>
            <p className={styles.metaSmall}>
              Member since {formatMemberSince(listing.seller.member_since)}
            </p>
            <ul className={styles.badges}>
              {listing.seller.verified.phone ? (
                <li>
                  <BadgeCheck size={16} aria-hidden="true" /> Phone verified
                </li>
              ) : null}
              {listing.seller.verified.email ? (
                <li>
                  <BadgeCheck size={16} aria-hidden="true" /> Email verified
                </li>
              ) : null}
            </ul>
          </section>

          <section aria-labelledby="meet-heading" className={styles.panel}>
            <h2 id="meet-heading" className={styles.panelTitle}>
              <ShieldCheck size={18} aria-hidden="true" /> Meet safely
            </h2>
            <p className={styles.metaSmall}>
              <MapPin size={14} aria-hidden="true" /> Meet near {listing.area_label} in a public
              place. Hucxter never shares anyone’s address.
            </p>
            <ul className={styles.tips}>
              <li>
                Pick a busy public spot, like a police station exchange zone or a store entrance.
              </li>
              <li>Meet in daylight and bring a friend if you can.</li>
              <li>Check the item before you pay. Never pay ahead or send gift cards.</li>
            </ul>
          </section>
        </div>
      </article>

      <section aria-labelledby="more-seller" className={styles.rail}>
        <h2 id="more-seller" className={styles.railTitle}>
          More from this seller
        </h2>
        <p className={styles.railEmpty}>No other listings from this seller yet.</p>
      </section>
      <section aria-labelledby="similar" className={styles.rail}>
        <h2 id="similar" className={styles.railTitle}>
          Similar near {listing.area_label}
        </h2>
        <p className={styles.railEmpty}>No similar listings nearby yet.</p>
      </section>
    </>
  );
}
