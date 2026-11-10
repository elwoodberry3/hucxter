'use client';

import { Share2 } from 'lucide-react';
import { useToast } from '@/components/ui/toast';

/**
 * Web Share where the browser has it (phones), else copies the link. No account needed. Shares the
 * current page unless `path` names another same-origin page (the Discover feed shares /l/[id]).
 */
export function ShareButton({
  className,
  labelClassName,
  label = 'Share',
  path,
  title,
  ariaLabel,
}: {
  className?: string | undefined;
  labelClassName?: string | undefined;
  label?: string;
  path?: string | undefined;
  title?: string | undefined;
  ariaLabel?: string | undefined;
}) {
  const toast = useToast();
  return (
    <>
      <button
        type="button"
        className={className}
        aria-label={ariaLabel}
        onClick={() => {
          const url =
            path === undefined ? window.location.href : new URL(path, window.location.origin).href;
          if (typeof navigator.share === 'function' && navigator.maxTouchPoints > 0) {
            navigator.share({ title: title ?? document.title, url }).catch(() => undefined);
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
        <span className={labelClassName}>{label}</span>
      </button>
    </>
  );
}
