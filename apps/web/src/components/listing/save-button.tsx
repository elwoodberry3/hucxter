'use client';

import { Heart } from 'lucide-react';
import { useOptimistic, useState, useTransition } from 'react';
import { toggleSave } from '@/app/actions/saves';
import { useViewer } from '@/components/auth/viewer-context';
import { useToast } from '@/components/ui/toast';
import { cx } from '@/lib/cx';
import { GatedActionButton } from './gated-action';
import styles from './save-button.module.css';

/**
 * Save toggle (Brief 03C.2 §4.3). Optimistic: it flips at once, then takes the server's answer;
 * a refusal or a failed request rolls it back with a toast. Guests get the sign-in sheet and
 * unverified members go on to /welcome. Saves are private, so there's never a count.
 */
export function SaveButton({
  listingId,
  title,
  initialSaved,
  variant = 'button',
  className,
  labelClassName,
}: {
  listingId: string;
  /** For the icon-only card button's accessible name ("Save Oak desk"). */
  title: string;
  initialSaved: boolean;
  /** `button`: icon + label (listing page). `icon`: round button over a card poster. */
  variant?: 'button' | 'icon';
  className?: string | undefined;
  labelClassName?: string | undefined;
}) {
  const viewer = useViewer();
  const toast = useToast();
  const [saved, setSaved] = useState(initialSaved);
  const [shown, setShown] = useOptimistic(saved);
  const [, startTransition] = useTransition();
  const icon = variant === 'icon';
  const classes = cx(icon ? styles.icon : undefined, className);
  const content = (on: boolean) => (
    <>
      <Heart size={icon ? 20 : 18} aria-hidden="true" fill={on ? 'currentColor' : 'none'} />
      {/* A constant name: the pressed state says whether it's saved. */}
      {icon ? null : <span className={labelClassName}>Save</span>}
    </>
  );

  if (viewer.status !== 'verified') {
    return (
      <GatedActionButton
        action="save"
        prompt="Sign in to save listings"
        className={classes}
        label={icon ? `Save ${title}` : undefined}
      >
        {content(false)}
      </GatedActionButton>
    );
  }

  return (
    <button
      type="button"
      className={classes}
      aria-pressed={shown}
      aria-label={icon ? `Save ${title}` : undefined}
      data-saved={shown ? 'true' : undefined}
      onClick={() => {
        const next = !shown;
        startTransition(async () => {
          setShown(next);
          try {
            const result = await toggleSave({ listingId, saved: next });
            setSaved(result.saved);
            if (result.status === 'error') toast(result.message);
          } catch {
            // The optimistic state falls back to `saved` when the transition ends.
            toast('Couldn’t save that. Check your connection and try again.');
          }
        });
      }}
    >
      {content(shown)}
    </button>
  );
}
