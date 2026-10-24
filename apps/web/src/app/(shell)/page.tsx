import type { Metadata } from 'next';
import { PagePlaceholder } from '@/components/page-placeholder';

export const metadata: Metadata = { title: { absolute: 'Hucxter' } };

export default function Page() {
  return <PagePlaceholder title="Feed">Local listings near you will appear here.</PagePlaceholder>;
}
