'use client';

import type { Department } from '@hucxter/contracts';
import { useRouter } from 'next/navigation';
import { DetailsForm } from '@/components/sell/details-form';
import type { DetailsValues } from '@/components/sell/details-form';
import { useToast } from '@/components/ui/toast';

/** Edit a published listing's details; back to its page when saved. */
export function EditListing({
  listingId,
  departments,
  initial,
}: {
  listingId: string;
  departments: Department[];
  initial: DetailsValues;
}) {
  const router = useRouter();
  const toast = useToast();
  return (
    <DetailsForm
      listingId={listingId}
      departments={departments}
      initial={initial}
      submitLabel="Save changes"
      onSaved={(_values, { inReview }) => {
        toast(
          inReview
            ? 'Saved. We’re reviewing this listing before buyers can see it again.'
            : 'Changes saved.',
        );
        router.push(`/l/${listingId}`);
        router.refresh();
      }}
    />
  );
}
