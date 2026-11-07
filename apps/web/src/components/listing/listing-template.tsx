import type { AttributeFilter, Department, ListingDetail, PriceDrop } from '@hucxter/contracts';
import { CONDITION_LABELS, formatPrice } from '@hucxter/contracts';
import { BadgeCheck, MapPin, MessageCircle, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { Breadcrumb, SubcategoryRow } from '@/components/results/results-layout';
import { Avatar } from '@/components/ui/avatar';
import { ListingPlayer } from '@/components/video/listing-player';
import type { PlayerSource } from '@/components/video/listing-player';
import { cx } from '@/lib/cx';
import { ListingDescription } from './description';
import { OwnerControls } from './owner-panel';
import { ReportButton } from './report-button';
import { SaveButton } from './save-button';
import { ShareButton } from './share-button';
import { StatusBadge } from './status-badge';
import styles from './template.module.css';
import { ViewBeacon } from './view-beacon';

function formatJoined(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** "just now", "3 hours ago", "2 days ago", "5 weeks ago" … (from published_at). */
export function listedAgo(iso: string, now: Date = new Date()): string {
  const minutes = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60_000));
  const plural = (n: number, unit: string) => `${String(n)} ${unit}${n === 1 ? '' : 's'} ago`;
  if (minutes < 1) return 'just now';
  if (minutes < 60) return plural(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (hours < 24) return plural(hours, 'hour');
  const days = Math.round(hours / 24);
  if (days < 14) return plural(days, 'day');
  if (days < 60) return plural(Math.round(days / 7), 'week');
  return plural(Math.round(days / 30), 'month');
}

export interface OwnerView {
  views: number | null;
  inReview: boolean;
}

/**
 * Listing page (Brief 03C.1 §3.4). Desktop: dark video stage with the action rail (Share,
 * Report, Save) + detail column. Phones: video on top, details below, sticky action bar.
 * No counts, ratings or chat box; the message action is disabled until messaging ships.
 */
export function ListingTemplate({
  listing,
  department,
  filters,
  player,
  drop,
  owner,
  verified,
  saved = false,
}: {
  listing: ListingDetail;
  department: Department;
  filters: AttributeFilter[];
  player: PlayerSource | null;
  drop: PriceDrop | null;
  owner: OwnerView | null;
  /** A verified member (may report); guests and unverified members get the gated action. */
  verified: boolean;
  /** The viewer saved this listing. */
  saved?: boolean;
}) {
  const subcategory = department.subcategories.find((sub) => sub.slug === listing.category_slug);
  const attributeRows = [
    { label: 'Condition', value: CONDITION_LABELS[listing.condition] },
    ...filters.flatMap((filter) => {
      const value = listing.attributes[filter.key];
      if (value === undefined) return [];
      const shown =
        typeof value === 'boolean'
          ? value
            ? 'Yes'
            : 'No'
          : `${String(value)}${filter.type === 'enum' && filter.unit !== undefined ? ` ${filter.unit}` : ''}`;
      return [{ label: filter.label, value: shown }];
    }),
  ];
  const sold = listing.status === 'sold';
  const isOwner = owner !== null;

  // Sold listings can't be saved (listing_save refuses them); the owner never sees Save.
  const canSave = !isOwner && !sold && !listing.is_demo;

  return (
    <>
      <div className={styles.compactHidden}>
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
      </div>

      {owner?.inReview === true ? (
        <p className={styles.reviewBanner} role="status">
          We’re reviewing this listing. Only you can see it until it’s approved.
        </p>
      ) : null}

      <article className={styles.layout} aria-labelledby="listing-title">
        <div className={styles.videoColumn}>
          <div className={styles.stage}>
            <div className={styles.video}>
              {player === null ? (
                <p className={styles.videoUnavailable}>This video isn’t available right now.</p>
              ) : (
                <ListingPlayer source={player} title={listing.title} />
              )}
            </div>
            <div className={styles.rail} aria-label="Listing actions" role="group">
              <ShareButton className={styles.secondary} labelClassName={styles.actionLabel} />
              {isOwner ? null : (
                <ReportButton
                  target={{ kind: 'listing', listingId: listing.id }}
                  verified={verified}
                  className={styles.secondary}
                  labelClassName={styles.actionLabel}
                />
              )}
              {canSave ? (
                <SaveButton
                  listingId={listing.id}
                  title={listing.title}
                  initialSaved={saved}
                  className={styles.secondary}
                  labelClassName={styles.actionLabel}
                />
              ) : null}
            </div>
          </div>
        </div>

        <div className={styles.details}>
          <div className={styles.titleBlock}>
            <h1 id="listing-title" className={styles.title}>
              {listing.title}
            </h1>
            <div className={styles.priceRow}>
              {drop === null ? (
                <p className={styles.price}>{formatPrice(listing.price_cents)}</p>
              ) : (
                <p className={styles.price}>
                  <span aria-hidden="true">{formatPrice(drop.nowCents)}</span>{' '}
                  <s className={styles.was} aria-hidden="true">
                    {formatPrice(drop.wasCents)}
                  </s>
                  <span className={styles.visuallyHidden}>
                    Was {formatPrice(drop.wasCents)}, now {formatPrice(drop.nowCents)}
                  </span>
                  <span className={styles.dropTag}>Price dropped</span>
                </p>
              )}
              <StatusBadge status={listing.status} />
            </div>
            <p className={styles.meta}>
              Listed {listedAgo(listing.posted_at)} in {listing.area_label}, {listing.state}
              {listing.distance_bucket === null ? '' : ` · ${listing.distance_bucket} away`}
            </p>
          </div>

          {isOwner ? (
            <OwnerControls listingId={listing.id} status={listing.status} views={owner.views} />
          ) : (
            <div className={styles.actions}>
              {sold ? (
                <p className={styles.soldNote}>This item has sold.</p>
              ) : (
                <>
                  <button
                    type="button"
                    className={styles.primary}
                    disabled
                    aria-describedby="messaging-soon"
                  >
                    <MessageCircle size={18} aria-hidden="true" />
                    Is this still available?
                  </button>
                  <p id="messaging-soon" className={styles.primaryNote}>
                    Messaging arrives in the next QA build
                  </p>
                </>
              )}
              {canSave ? (
                <SaveButton
                  listingId={listing.id}
                  title={listing.title}
                  initialSaved={saved}
                  className={cx(styles.secondary, styles.barOnly)}
                  labelClassName={styles.actionLabel}
                />
              ) : null}
              <ShareButton
                className={cx(styles.secondary, styles.barOnly)}
                labelClassName={styles.actionLabel}
              />
              <ReportButton
                target={{ kind: 'listing', listingId: listing.id }}
                verified={verified}
                className={cx(styles.secondary, styles.barOnly)}
                labelClassName={styles.actionLabel}
              />
            </div>
          )}

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

          <section aria-labelledby="seller-heading" className={styles.panel}>
            <h2 id="seller-heading" className={styles.panelTitle}>
              Seller
            </h2>
            <div className={styles.seller}>
              <Avatar name={listing.seller.display_name} src={listing.seller.avatar_url} />
              <div>
                {listing.seller.handle === null || listing.seller.handle === undefined ? (
                  <p className={styles.sellerName}>{listing.seller.display_name}</p>
                ) : (
                  <p className={styles.sellerName}>
                    <Link href={`/u/${listing.seller.handle}`} className={styles.sellerLink}>
                      {listing.seller.display_name}
                      <span className={styles.sellerHandle}>@{listing.seller.handle}</span>
                    </Link>
                  </p>
                )}
                <ul className={styles.sellerFacts}>
                  {listing.seller.phone_verified ? (
                    <li className={styles.verified}>
                      <BadgeCheck size={16} aria-hidden="true" /> Phone verified
                    </li>
                  ) : null}
                  <li>Joined {formatJoined(listing.seller.joined_month)}</li>
                  <li>
                    {listing.seller.items_sold} {listing.seller.items_sold === 1 ? 'item' : 'items'}{' '}
                    sold
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {listing.description === '' ? null : (
            <section aria-labelledby="description-heading" className={styles.panel}>
              <h2 id="description-heading" className={styles.panelTitle}>
                Description
              </h2>
              <ListingDescription text={listing.description} />
            </section>
          )}

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
      {isOwner ? null : <ViewBeacon listingId={listing.id} />}
    </>
  );
}
