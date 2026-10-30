'use client';

import { Share2 } from 'lucide-react';
import { useState } from 'react';

/** Copies the page link. Sharing doesn't need an account. */
export function ShareButton({ className }: { className?: string | undefined }) {
  const [status, setStatus] = useState('');
  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => {
          navigator.clipboard.writeText(window.location.href).then(
            () => {
              setStatus('Link copied');
            },
            () => {
              setStatus('Couldn’t copy the link');
            },
          );
        }}
      >
        <Share2 size={18} aria-hidden="true" />
        Share
      </button>
      <span role="status" className="visually-hidden">
        {status}
      </span>
    </>
  );
}
