'use client';

import { RADIUS_OPTIONS_MI } from '@hucxter/contracts';
import type { RadiusMi } from '@hucxter/contracts';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { setLocationByZip } from '@/app/actions/location';
import { useToast } from '@/components/ui/toast';

/** The next allowlisted radius above `radiusMi`, or null at 100 mi. */
export function widerRadius(radiusMi: RadiusMi): RadiusMi | null {
  return RADIUS_OPTIONS_MI.find((option) => option > radiusMi) ?? null;
}

/** "Widen your radius" on the empty feed: the next allowlisted radius, same ZIP. */
export function WidenRadiusButton({
  zip,
  radiusMi,
  className,
}: {
  zip: string;
  radiusMi: RadiusMi;
  className?: string | undefined;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const next = widerRadius(radiusMi);
  if (next === null) return null;
  return (
    <button
      type="button"
      className={className}
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const result = await setLocationByZip({ zip, radiusMi: next }).catch(() => null);
          if (result?.ok === true) {
            toast(`Showing videos within ${String(next)} mi`);
            router.refresh();
          } else {
            toast('Couldn’t change your radius. Try again.');
          }
        });
      }}
    >
      {pending ? 'Widening…' : `Widen your radius to ${String(next)} mi`}
    </button>
  );
}
