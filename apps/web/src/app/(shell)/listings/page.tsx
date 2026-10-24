import type { Metadata } from 'next';
import { PagePlaceholder } from '@/components/page-placeholder';

export const metadata: Metadata = { title: 'My Listings' };

export default function Page() {
  return (
    <PagePlaceholder title="My Listings">Items you are selling will appear here.</PagePlaceholder>
  );
}
