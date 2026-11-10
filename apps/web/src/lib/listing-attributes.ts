import { CONDITION_LABELS } from '@hucxter/contracts';
import type { AttributeFilter, ListingDetail } from '@hucxter/contracts';

export interface AttributeRow {
  label: string;
  value: string;
}

/** A listing's details as labelled rows: Condition first, then the category's filters it has. */
export function attributeRows(
  listing: Pick<ListingDetail, 'condition' | 'attributes'>,
  filters: AttributeFilter[],
): AttributeRow[] {
  return [
    { label: 'Condition', value: CONDITION_LABELS[listing.condition] },
    ...filters.flatMap((filter) => {
      const value = listing.attributes[filter.key];
      if (value === undefined) return [];
      const shown =
        typeof value === 'boolean'
          ? value
            ? 'Yes'
            : 'No'
          : `${String(value)}${filter.type === 'enum' && filter.unit !== undefined ? ` ${filter.unit}` : ''}`;
      return [{ label: filter.label, value: shown }];
    }),
  ];
}
