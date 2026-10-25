'use client';

import type { GatedAction } from '@hucxter/contracts';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { authHref } from '@/lib/next-path';

/** An action that needs an account. Guests are sent to sign in and returned here afterwards. */
export function GatedActionButton({
  children,
  className,
}: {
  action: GatedAction;
  prompt: string;
  children: ReactNode;
  className?: string | undefined;
}) {
  const pathname = usePathname();
  return (
    <Link href={authHref(pathname)} className={className}>
      {children}
    </Link>
  );
}
