'use client';

import { CONDITION_LABELS, ListingCondition, filtersFor } from '@hucxter/contracts';
import type { AttributeFilter, Department } from '@hucxter/contracts';
import { useId, useState, useTransition } from 'react';
import { saveDetails } from '@/app/actions/sell';
import styles from './sell.module.css';

export interface DetailsValues {
  title: string;
  departmentSlug: string;
  categorySlug: string;
  condition: ListingCondition | '';
  free: boolean;
  price: string;
  attributes: Record<string, string | number | boolean>;
  description: string;
  pickupZip: string;
}

const TITLE_MAX = 80;
const DESCRIPTION_MAX = 2000;

function Counter({ id, value, max }: { id: string; value: string; max: number }) {
  return (
    <span id={id} className={styles.counter} aria-live="polite">
      {value.length}/{max}
    </span>
  );
}

function FieldError({ id, message }: { id: string; message: string | undefined }) {
  return (
    <p id={id} className={styles.fieldError}>
      {message}
    </p>
  );
}

function AttributeField({
  filter,
  value,
  error,
  onChange,
}: {
  filter: AttributeFilter;
  value: string | number | boolean | undefined;
  error: string | undefined;
  onChange: (value: string | number | boolean | undefined) => void;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  if (filter.type === 'boolean') {
    return (
      <label className={styles.check}>
        <input
          type="checkbox"
          checked={value === true}
          onChange={(event) => {
            onChange(event.target.checked ? true : undefined);
          }}
        />
        {filter.label}
      </label>
    );
  }
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {filter.label} <span className={styles.optional}>(optional)</span>
      </label>
      {filter.type === 'enum' ? (
        <select
          id={id}
          className={styles.input}
          value={value === undefined ? '' : String(value)}
          aria-invalid={error !== undefined}
          aria-describedby={errorId}
          onChange={(event) => {
            const option = filter.options.find((o) => String(o) === event.target.value);
            onChange(option);
          }}
        >
          <option value="">Not specified</option>
          {filter.options.map((option) => (
            <option key={String(option)} value={String(option)}>
              {option}
              {filter.unit === undefined ? '' : ` ${filter.unit}`}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          className={styles.input}
          value={typeof value === 'string' ? value : ''}
          maxLength={80}
          aria-invalid={error !== undefined}
          aria-describedby={errorId}
          onChange={(event) => {
            onChange(event.target.value === '' ? undefined : event.target.value);
          }}
        />
      )}
      <FieldError id={errorId} message={error} />
    </div>
  );
}

/**
 * Listing details (Brief 03C.1 §3.3): title ≤ 80, department → subcategory, condition, whole-dollar
 * price or Free (Free Stuff is always $0), the category's attributes, plain-text description
 * ≤ 2,000, and the pickup ZIP (defaults to the member's home ZIP). Used by /sell and by edits.
 */
export function DetailsForm({
  listingId,
  departments,
  initial,
  submitLabel,
  onSaved,
}: {
  listingId: string;
  departments: Department[];
  initial: DetailsValues;
  submitLabel: string;
  /** `inReview`: the saved edit (or an earlier one) holds a published listing for review. */
  onSaved: (values: DetailsValues, outcome: { inReview: boolean }) => void;
}) {
  const [values, setValues] = useState(initial);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const ids = {
    title: useId(),
    department: useId(),
    category: useId(),
    condition: useId(),
    price: useId(),
    description: useId(),
    zip: useId(),
  };

  const department = departments.find((d) => d.slug === values.departmentSlug);
  const freeOnly = department?.attributes.free_only === true;
  const free = freeOnly || values.free;
  const filters =
    department === undefined || values.categorySlug === ''
      ? []
      : filtersFor(department, values.categorySlug);

  const set = <K extends keyof DetailsValues>(key: K, value: DetailsValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const submit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    const price = Number(values.price);
    const attributes = Object.fromEntries(
      filters
        .map((f) => [f.key, values.attributes[f.key]] as const)
        .filter(([, v]) => v !== undefined),
    );
    startTransition(async () => {
      const result = await saveDetails({
        listingId,
        title: values.title,
        categorySlug: values.categorySlug,
        condition: values.condition,
        free,
        priceDollars: free ? 0 : values.price.trim() === '' ? Number.NaN : price,
        attributes,
        description: values.description,
        pickupZip: values.pickupZip.trim(),
      });
      if (result.status === 'saved') {
        setFields({});
        onSaved({ ...values, free }, { inReview: result.inReview });
        return;
      }
      setFields(result.fields ?? {});
      setMessage(result.message);
    });
  };

  const invalid = (key: string) => fields[key] !== undefined;

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <div className={styles.field}>
        <div className={styles.labelRow}>
          <label htmlFor={ids.title} className={styles.label}>
            Title
          </label>
          <Counter id={`${ids.title}-count`} value={values.title} max={TITLE_MAX} />
        </div>
        <input
          id={ids.title}
          className={styles.input}
          value={values.title}
          maxLength={TITLE_MAX}
          autoComplete="off"
          required
          aria-invalid={invalid('title')}
          aria-describedby={`${ids.title}-error ${ids.title}-count`}
          onChange={(event) => {
            set('title', event.target.value);
          }}
        />
        <FieldError id={`${ids.title}-error`} message={fields.title} />
      </div>

      <div className={styles.pair}>
        <div className={styles.field}>
          <label htmlFor={ids.department} className={styles.label}>
            Category
          </label>
          <select
            id={ids.department}
            className={styles.input}
            value={values.departmentSlug}
            required
            onChange={(event) => {
              setValues((current) => ({
                ...current,
                departmentSlug: event.target.value,
                categorySlug: '',
                attributes: {},
              }));
            }}
          >
            <option value="">Choose a category</option>
            {departments.map((d) => (
              <option key={d.slug} value={d.slug}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor={ids.category} className={styles.label}>
            Subcategory
          </label>
          <select
            id={ids.category}
            className={styles.input}
            value={values.categorySlug}
            required
            disabled={department === undefined}
            aria-invalid={invalid('categorySlug')}
            aria-describedby={`${ids.category}-error`}
            onChange={(event) => {
              set('categorySlug', event.target.value);
            }}
          >
            <option value="">Choose a subcategory</option>
            {department?.subcategories.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.name}
              </option>
            ))}
          </select>
          <FieldError id={`${ids.category}-error`} message={fields.categorySlug} />
        </div>
      </div>
      {department?.attributes.notice === undefined ? null : (
        <p className={styles.notice}>{department.attributes.notice}</p>
      )}

      <div className={styles.field}>
        <label htmlFor={ids.condition} className={styles.label}>
          Condition
        </label>
        <select
          id={ids.condition}
          className={styles.input}
          value={values.condition}
          required
          aria-invalid={invalid('condition')}
          aria-describedby={`${ids.condition}-error`}
          onChange={(event) => {
            const parsed = ListingCondition.safeParse(event.target.value);
            set('condition', parsed.success ? parsed.data : '');
          }}
        >
          <option value="">Choose a condition</option>
          {ListingCondition.options.map((c) => (
            <option key={c} value={c}>
              {CONDITION_LABELS[c]}
            </option>
          ))}
        </select>
        <FieldError id={`${ids.condition}-error`} message={fields.condition} />
      </div>

      <div className={styles.field}>
        <label htmlFor={ids.price} className={styles.label}>
          Price
        </label>
        <div className={styles.priceRow}>
          <span className={styles.prefix} aria-hidden="true">
            $
          </span>
          <input
            id={ids.price}
            className={styles.input}
            inputMode="numeric"
            pattern="[0-9]*"
            value={free ? '0' : values.price}
            disabled={free}
            aria-invalid={invalid('priceDollars')}
            aria-describedby={`${ids.price}-error`}
            onChange={(event) => {
              set('price', event.target.value.replace(/[^0-9]/g, '').slice(0, 6));
            }}
          />
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={free}
              disabled={freeOnly}
              onChange={(event) => {
                set('free', event.target.checked);
              }}
            />
            Free
          </label>
        </div>
        <FieldError
          id={`${ids.price}-error`}
          message={freeOnly ? 'Free Stuff is always free.' : fields.priceDollars}
        />
      </div>

      {filters.length === 0 ? null : (
        <fieldset className={styles.fieldset}>
          <legend className={styles.label}>Details buyers look for</legend>
          {filters.map((filter) => (
            <AttributeField
              key={filter.key}
              filter={filter}
              value={values.attributes[filter.key]}
              error={fields[`attributes.${filter.key}`]}
              onChange={(value) => {
                setValues((current) => {
                  const attributes = Object.fromEntries(
                    Object.entries(current.attributes).filter(([key]) => key !== filter.key),
                  );
                  if (value !== undefined) attributes[filter.key] = value;
                  return { ...current, attributes };
                });
              }}
            />
          ))}
        </fieldset>
      )}

      <div className={styles.field}>
        <div className={styles.labelRow}>
          <label htmlFor={ids.description} className={styles.label}>
            Description <span className={styles.optional}>(optional)</span>
          </label>
          <Counter
            id={`${ids.description}-count`}
            value={values.description}
            max={DESCRIPTION_MAX}
          />
        </div>
        <textarea
          id={ids.description}
          className={styles.textarea}
          rows={6}
          value={values.description}
          maxLength={DESCRIPTION_MAX}
          aria-invalid={invalid('description')}
          aria-describedby={`${ids.description}-error ${ids.description}-count`}
          onChange={(event) => {
            set('description', event.target.value);
          }}
        />
        <FieldError id={`${ids.description}-error`} message={fields.description} />
      </div>

      <div className={styles.field}>
        <label htmlFor={ids.zip} className={styles.label}>
          Pickup ZIP code
        </label>
        <input
          id={ids.zip}
          className={styles.input}
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={5}
          value={values.pickupZip}
          aria-invalid={invalid('pickupZip')}
          aria-describedby={`${ids.zip}-hint ${ids.zip}-error`}
          onChange={(event) => {
            set('pickupZip', event.target.value.replace(/[^0-9]/g, '').slice(0, 5));
          }}
        />
        <p id={`${ids.zip}-hint`} className={styles.hint}>
          Buyers see the area and a distance range, never your address.
        </p>
        <FieldError id={`${ids.zip}-error`} message={fields.pickupZip} />
      </div>

      <p role="alert" className={styles.error}>
        {message}
      </p>
      <div className={styles.actions}>
        <button type="submit" className={styles.primary} disabled={pending}>
          {pending ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
