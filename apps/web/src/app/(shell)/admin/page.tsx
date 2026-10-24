import type { Metadata } from 'next';
import { PagePlaceholder } from '@/components/page-placeholder';

export const metadata: Metadata = { title: 'Admin' };

// Placeholder only. Server-side role check (app_roles) arrives in Brief 03; there is no data here yet.
export default function Page() {
  return <PagePlaceholder title="Admin">Moderation tools will appear here.</PagePlaceholder>;
}
