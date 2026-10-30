import 'server-only';
import { ListingDetail } from '@hucxter/contracts';
import type { ListingStatus } from '@hucxter/contracts';

/**
 * DEMO FIXTURE for /dev/templates/listing only (local/QA; the route 404s in production).
 * Made-up data, labeled "Demo" wherever it renders. Never used by any real page or query.
 */
export function demoListing(status: ListingStatus = 'available'): ListingDetail {
  return ListingDetail.parse({
    id: '00000000-0000-4000-8000-00000000d3e0',
    title: 'Demo: Mid-century walnut desk',
    price_cents: 12500,
    condition: 'good',
    status,
    distance_bucket: '1–5 mi',
    area_label: 'Celina',
    posted_at: '2026-10-24T15:00:00Z',
    poster_url: '/demo/listing-poster.svg',
    category_slug: 'furniture',
    department_slug: 'home',
    is_demo: true,
    description:
      'This is demo text for the listing template. A real seller’s description appears here, after they review and confirm it.',
    attributes: { material: 'Wood', color: 'Brown', room: 'Office', has_dimensions: true },
    seller: {
      display_name: 'Demo Seller',
      member_since: '2026-10-01',
      verified: { phone: true, email: true },
    },
  });
}
