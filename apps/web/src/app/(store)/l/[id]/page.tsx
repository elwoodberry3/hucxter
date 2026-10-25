import { notFound } from 'next/navigation';

/**
 * Listing page. There is no listings table until Brief 04, so every id is "not found". The layout
 * lives in components/listing/listing-template.tsx (preview: /dev/templates/listing, non-production).
 */
export default function ListingPage(): never {
  notFound();
}
