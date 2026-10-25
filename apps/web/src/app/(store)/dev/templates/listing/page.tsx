import { ListingStatus, filtersFor, listingAttributesSchema } from '@hucxter/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ListingTemplate } from '@/components/listing/listing-template';
import styles from '@/components/listing/template.module.css';
import { assertDevRoutesEnabled } from '@/lib/dev-gate';
import { demoListing } from '@/lib/dev/demo-listing';
import { findDepartment, getTaxonomy } from '@/lib/taxonomy';

export const metadata: Metadata = { title: 'Demo listing template' };

/** Product page template with a labeled demo fixture. Local/QA only (404 in production). */
export default async function DemoListingTemplatePage({
  searchParams,
}: PageProps<'/dev/templates/listing'>) {
  assertDevRoutesEnabled();
  const { status: rawStatus } = await searchParams;
  const status = ListingStatus.catch('available').parse(rawStatus);
  const listing = demoListing(status);
  const department = findDepartment(await getTaxonomy(), listing.department_slug);
  if (department === undefined) notFound();
  const filters = filtersFor(department, listing.category_slug);
  // The fixture must satisfy its category's attribute schema, like a real listing would.
  listingAttributesSchema(filters).parse(listing.attributes);

  return (
    <>
      <div className={styles.demoBanner} role="note" aria-label="Demo">
        <strong>Demo listing.</strong>
        <span>
          Template preview with made-up data. Not for sale, and never shown in production.
        </span>
        <span>
          Status:{' '}
          {ListingStatus.options.map((option, index) => (
            <span key={option}>
              {index > 0 ? ' · ' : ''}
              <Link
                href={`/dev/templates/listing?status=${option}`}
                aria-current={option === status ? 'page' : undefined}
              >
                {option}
              </Link>
            </span>
          ))}
        </span>
      </div>
      <ListingTemplate listing={listing} department={department} filters={filters} />
    </>
  );
}
