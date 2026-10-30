'use client';

import type { AttributeFilter, ListingQuery, RadiusMi } from '@hucxter/contracts';
import {
  CONDITION_LABELS,
  ListingCondition,
  POSTED_LABELS,
  POSTED_OPTIONS,
  RADIUS_OPTIONS_MI,
  activeFilterKeys,
} from '@hucxter/contracts';
import Form from 'next/form';
import Link from 'next/link';
import { track } from '@/lib/analytics';
import styles from './results.module.css';

/**
 * Left filter panel (storefront-ia §4): common filters, then the category's attribute filters.
 * A GET form, so state lives in the URL (shareable, back/forward work) and it works without JS.
 */
export function FilterPanel({
  action,
  query,
  filters,
  freeOnly,
  defaultDistanceMi,
  surface,
}: {
  action: string;
  query: ListingQuery;
  filters: AttributeFilter[];
  freeOnly: boolean;
  defaultDistanceMi: RadiusMi;
  surface: 'category' | 'search';
}) {
  const hasActive = activeFilterKeys(query).length > 0;
  return (
    <aside className={styles.panel} aria-labelledby="filters-heading">
      <div className={styles.panelHeader}>
        <h2 id="filters-heading" className={styles.panelTitle}>
          Filters
        </h2>
        {hasActive ? (
          <Link
            href={query.q === undefined ? action : `${action}?q=${encodeURIComponent(query.q)}`}
            className={styles.clearAll}
          >
            Clear all
          </Link>
        ) : null}
      </div>
      <Form
        action={action}
        className={styles.form}
        onSubmit={(event) => {
          const data = new FormData(event.currentTarget);
          const keys = [
            ...new Set([...data.entries()].filter(([, v]) => v !== '').map(([k]) => k)),
          ];
          track({
            name: 'filter_applied',
            surface,
            keys: keys.filter((k) => k !== 'q' && k !== 'sort'),
          });
        }}
      >
        {query.q === undefined ? null : <input type="hidden" name="q" value={query.q} />}
        {query.sort === 'newest' ? null : <input type="hidden" name="sort" value={query.sort} />}

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Price</legend>
          {freeOnly ? (
            <p className={styles.hint}>Everything here is free.</p>
          ) : (
            <>
              <div className={styles.priceRow}>
                <label className={styles.inline}>
                  <span className="visually-hidden">Minimum price in dollars</span>
                  <span aria-hidden="true">$</span>
                  <input
                    name="price_min"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={1000000}
                    placeholder="Min"
                    defaultValue={query.priceMin}
                    className={styles.input}
                  />
                </label>
                <span aria-hidden="true">–</span>
                <label className={styles.inline}>
                  <span className="visually-hidden">Maximum price in dollars</span>
                  <span aria-hidden="true">$</span>
                  <input
                    name="price_max"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={1000000}
                    placeholder="Max"
                    defaultValue={query.priceMax}
                    className={styles.input}
                  />
                </label>
              </div>
              <label className={styles.check}>
                <input type="checkbox" name="free" value="true" defaultChecked={query.free} />
                Free only
              </label>
            </>
          )}
        </fieldset>

        <div className={styles.fieldset}>
          <label htmlFor="filter-distance" className={styles.legend}>
            Distance
          </label>
          <select
            id="filter-distance"
            name="distance"
            defaultValue={String(query.distanceMi ?? defaultDistanceMi)}
            className={styles.select}
          >
            {RADIUS_OPTIONS_MI.map((miles) => (
              <option key={miles} value={miles}>
                Within {miles} mi
              </option>
            ))}
          </select>
        </div>

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Condition</legend>
          {ListingCondition.options.map((condition) => (
            <label key={condition} className={styles.check}>
              <input
                type="checkbox"
                name="condition"
                value={condition}
                defaultChecked={query.conditions.includes(condition)}
              />
              {CONDITION_LABELS[condition]}
            </label>
          ))}
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Posted</legend>
          {POSTED_OPTIONS.map((posted) => (
            <label key={posted} className={styles.check}>
              <input
                type="radio"
                name="posted"
                value={posted}
                defaultChecked={query.posted === posted}
              />
              {POSTED_LABELS[posted]}
            </label>
          ))}
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Status</legend>
          <label className={styles.check}>
            <input
              type="radio"
              name="status"
              value="available"
              defaultChecked={query.status === 'available'}
            />
            Available only
          </label>
          <label className={styles.check}>
            <input
              type="radio"
              name="status"
              value="include_pending"
              defaultChecked={query.status === 'include_pending'}
            />
            Include pending
          </label>
        </fieldset>

        {filters.map((filter) => (
          <AttributeField key={filter.key} filter={filter} value={query.attributes[filter.key]} />
        ))}

        <button type="submit" className={styles.apply}>
          Apply filters
        </button>
      </Form>
    </aside>
  );
}

function AttributeField({
  filter,
  value,
}: {
  filter: AttributeFilter;
  value: string | number | boolean | undefined;
}) {
  const id = `filter-${filter.key}`;
  if (filter.type === 'boolean') {
    return (
      <div className={styles.fieldset}>
        <label className={styles.check}>
          <input type="checkbox" name={filter.key} value="true" defaultChecked={value === true} />
          {filter.label}
        </label>
      </div>
    );
  }
  if (filter.type === 'text') {
    return (
      <div className={styles.fieldset}>
        <label htmlFor={id} className={styles.legend}>
          {filter.label}
        </label>
        <input
          id={id}
          name={filter.key}
          type="text"
          maxLength={80}
          defaultValue={typeof value === 'string' ? value : undefined}
          className={styles.textInput}
        />
      </div>
    );
  }
  return (
    <div className={styles.fieldset}>
      <label htmlFor={id} className={styles.legend}>
        {filter.label}
      </label>
      <select
        id={id}
        name={filter.key}
        defaultValue={value === undefined ? '' : String(value)}
        className={styles.select}
      >
        <option value="">Any</option>
        {filter.options.map((option) => (
          <option key={String(option)} value={String(option)}>
            {option}
            {filter.unit === undefined ? '' : ` ${filter.unit}`}
          </option>
        ))}
      </select>
    </div>
  );
}
