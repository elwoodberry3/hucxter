'use client';

import { Share2 } from 'lucide-react';
import { useToast } from '@/components/ui/toast';

/** Web Share where the browser has it (phones), else copies the link. No account needed. */
export function ShareButton({
  className,
  labelClassName,
}: {
  className?: string | undefined;
  labelClassName?: string | undefined;
}) {
  const toast = useToast();
  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => {
          const url = window.location.href;
          if (typeof navigator.share === 'function' && navigator.maxTouchPoints > 0) {
            navigator.share({ title: document.title, url }).catch(() => undefined);
            return;
          }
          navigator.clipboard.writeText(url).then(
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
        <span className={labelClassName}>Share</span>
      </button>
    </>
  );
}
