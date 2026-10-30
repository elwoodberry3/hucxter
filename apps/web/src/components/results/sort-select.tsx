'use client';

import { SORT_LABELS, SORT_OPTIONS } from '@hucxter/contracts';
import type { ListingQuery } from '@hucxter/contracts';
import { listingQueryParams } from '@hucxter/contracts';
import { useRouter } from 'next/navigation';

/** Sort select. Choosing an option updates the URL (announced via the description). */
export function SortSelect({
  action,
  query,
  className,
}: {
  action: string;
  query: ListingQuery;
  className?: string | undefined;
}) {
  const router = useRouter();
  return (
    <label className={className}>
      <span>Sort by</span>
      <select
        name="sort"
        defaultValue={query.sort}
        aria-describedby="sort-hint"
        onChange={(event) => {
          const sort = SORT_OPTIONS.find((option) => option === event.target.value) ?? 'newest';
          const params = listingQueryParams({ ...query, sort });
          const search = params.toString();
          router.push(search === '' ? action : `${action}?${search}`);
        }}
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {SORT_LABELS[option]}
          </option>
        ))}
      </select>
      <span id="sort-hint" className="visually-hidden">
        Results update when you choose an option.
      </span>
    </label>
  );
}
