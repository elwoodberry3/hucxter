'use client';

import { useRouter } from 'next/navigation';

/** A select whose options are URLs (sort on profile pages). Choosing one navigates there. */
export function UrlSelect({
  label,
  value,
  options,
  className,
}: {
  label: string;
  value: string;
  options: readonly { value: string; label: string; href: string }[];
  className?: string | undefined;
}) {
  const router = useRouter();
  return (
    <label className={className}>
      <span>{label}</span>
      <select
        value={value}
        aria-describedby="url-select-hint"
        onChange={(event) => {
          const option = options.find((o) => o.value === event.target.value);
          if (option !== undefined) router.push(option.href, { scroll: false });
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <span id="url-select-hint" className="visually-hidden">
        The list updates when you choose an option.
      </span>
    </label>
  );
}
