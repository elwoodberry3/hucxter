'use client';

import { ErrorState } from '@/components/ui/error-state';

/** Route-level error boundary inside the storefront frame. Never shows error details. */
export default function StoreError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorState onRetry={reset} />;
}
