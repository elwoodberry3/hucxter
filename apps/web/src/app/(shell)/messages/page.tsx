import type { Metadata } from 'next';
import { PagePlaceholder } from '@/components/page-placeholder';

export const metadata: Metadata = { title: 'Messages' };

export default function Page() {
  return (
    <PagePlaceholder title="Messages">
      Conversations with buyers and sellers will appear here.
    </PagePlaceholder>
  );
}
