import { REPORT_REASON_LABELS, formatPrice } from '@hucxter/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ModerationActions } from '@/components/admin/moderation-actions';
import { ProfileModeration } from '@/components/admin/profile-moderation';
import styles from '@/components/admin/admin.module.css';
import { listedAgo } from '@/components/listing/listing-template';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { loadOpenReports, loadReviewListings } from '@/server/admin/queue';
import { requireStaff } from '@/server/auth/gate';

export const metadata: Metadata = { title: 'Admin', robots: { index: false } };
export const dynamic = 'force-dynamic';

/**
 * Moderation queue (Brief 03C.1 §3.6). 404 for everyone but verified staff, checked on every
 * request. Listings held for review, then open reports (oldest first). Reporters are never shown.
 */
export default async function AdminPage() {
  await requireStaff();
  const [held, reports] = await Promise.all([loadReviewListings(), loadOpenReports()]);

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Moderation</h1>

      <section aria-labelledby="held-heading" className={styles.section}>
        <h2 id="held-heading" className={styles.sectionTitle}>
          Held for review
        </h2>
        {held.length === 0 ? (
          <EmptyState
            title="Nothing held"
            body="Listings the prohibited-item check holds wait here."
          />
        ) : (
          <ul className={styles.list}>
            {held.map((listing) => (
              <li key={listing.id} className={styles.item}>
                <span className={styles.thumb}>
                  {listing.poster === null ? null : (
                    // eslint-disable-next-line @next/next/no-img-element -- short-lived signed poster
                    <img src={listing.poster} alt="" className={styles.thumbImage} />
                  )}
                </span>
                <div className={styles.body}>
                  <h3 className={styles.title}>{listing.title}</h3>
                  <p className={styles.meta}>
                    {listing.priceCents === null ? 'No price' : formatPrice(listing.priceCents)} ·{' '}
                    {listing.sellerName}
                    {listing.publishedAt === null ? '' : ` · ${listedAgo(listing.publishedAt)}`}
                  </p>
                  {listing.matches.length === 0 ? null : (
                    <p className={styles.flag}>Matched: {listing.matches.join(', ')}</p>
                  )}
                  {listing.description === '' ? null : (
                    <p className={styles.description}>{listing.description}</p>
                  )}
                </div>
                <ModerationActions listingId={listing.id} listingTitle={listing.title} canApprove />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="reports-heading" className={styles.section}>
        <h2 id="reports-heading" className={styles.sectionTitle}>
          Open reports
        </h2>
        {reports.length === 0 ? (
          <EmptyState title="No open reports" body="Reports from members wait here." />
        ) : (
          <ul className={styles.list}>
            {reports.map((report) =>
              report.targetType === 'profile' ? (
                <li key={report.id} className={styles.item}>
                  <div className={styles.body}>
                    <h3 className={styles.title}>{REPORT_REASON_LABELS[report.reason]}</h3>
                    <p className={styles.meta}>
                      Profile reported {listedAgo(report.createdAt)}
                      {report.profile === null ? ' · Account deleted' : ''}
                    </p>
                    {report.note === null ? null : (
                      <p className={styles.description}>“{report.note}”</p>
                    )}
                    {report.profile === null ? null : (
                      <div className={styles.profileTarget}>
                        <Avatar
                          name={report.profile.displayName}
                          src={report.profile.avatarUrl}
                          size="md"
                        />
                        <div className={styles.body}>
                          <p className={styles.title}>{report.profile.displayName}</p>
                          {report.profile.handle === null ? null : (
                            <p className={styles.meta}>
                              <Link href={`/u/${report.profile.handle}`}>
                                @{report.profile.handle}
                              </Link>
                            </p>
                          )}
                          {report.profile.resetPending ? (
                            <p className={styles.flag}>Waiting for a new name and handle</p>
                          ) : null}
                          {report.profile.bio === '' ? null : (
                            <p className={styles.description}>{report.profile.bio}</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  {report.profile === null ? (
                    <ModerationActions reportId={report.id} />
                  ) : (
                    <ProfileModeration
                      reportId={report.id}
                      displayName={report.profile.displayName}
                      hasPhoto={report.profile.avatarUrl !== null}
                      hasBio={report.profile.bio !== ''}
                      resetPending={report.profile.resetPending}
                    />
                  )}
                </li>
              ) : (
                <li key={report.id} className={styles.item}>
                  <div className={styles.body}>
                    <h3 className={styles.title}>{REPORT_REASON_LABELS[report.reason]}</h3>
                    <p className={styles.meta}>
                      Reported {listedAgo(report.createdAt)} ·{' '}
                      {report.listing === null ? (
                        'Listing deleted'
                      ) : report.listing.removed ? (
                        `${report.listing.title} (removed)`
                      ) : (
                        <Link href={`/l/${report.targetId}`}>{report.listing.title}</Link>
                      )}
                    </p>
                    {report.note === null ? null : (
                      <p className={styles.description}>“{report.note}”</p>
                    )}
                  </div>
                  <ModerationActions
                    reportId={report.id}
                    listingId={
                      report.listing !== null && !report.listing.removed
                        ? report.targetId
                        : undefined
                    }
                    listingTitle={report.listing?.title}
                  />
                </li>
              ),
            )}
          </ul>
        )}
      </section>
    </div>
  );
}
