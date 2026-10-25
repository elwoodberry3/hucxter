import type { ReactNode } from 'react';
import { StoreShell } from '@/components/store/store-shell';
import { getTaxonomy } from '@/lib/taxonomy';

export default async function StoreLayout({ children }: { children: ReactNode }) {
  const taxonomy = await getTaxonomy();
  return (
    <StoreShell taxonomy={taxonomy} location={null} locationLabel={null}>
      {children}
    </StoreShell>
  );
}
