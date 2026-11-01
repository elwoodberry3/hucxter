'use client';

import { Share2 } from 'lucide-react';
import { useToast } from '@/components/ui/toast';

/** Copies the page link. Sharing doesn't need an account. */
export function ShareButton({ className }: { className?: string | undefined }) {
  const toast = useToast();
  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => {
          navigator.clipboard.writeText(window.location.href).then(
            () => {
              toast('Link copied');
            },
            () => {
              toast('Couldn’t copy the link');
            },
          );
        }}
      >
        <Share2 size={18} aria-hidden="true" />
        Share
      </button>
    </>
  );
}
