import type { Metadata } from 'next';
import { PagePlaceholder } from '@/components/page-placeholder';

export const metadata: Metadata = { title: 'Saved' };

export default function Page() {
  return <PagePlaceholder title="Saved">Items you save will appear here.</PagePlaceholder>;
}
