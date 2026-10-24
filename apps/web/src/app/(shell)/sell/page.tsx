import type { Metadata } from 'next';
import { PagePlaceholder } from '@/components/page-placeholder';

export const metadata: Metadata = { title: 'Sell' };

export default function Page() {
  return (
    <PagePlaceholder title="Sell">
      Post a short video of an item to sell it locally.
    </PagePlaceholder>
  );
}
