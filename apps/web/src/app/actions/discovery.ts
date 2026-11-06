'use server';

import type { ListingCard } from '@hucxter/contracts';
import { z } from 'zod';
import { resultsPage } from '@/lib/listings';

const MoreInput = z
  .object({
    departmentSlug: z
      .string()
      .regex(/^[a-z0-9-]{1,40}$/)
      .optional(),
    subcategorySlug: z
      .string()
      .regex(/^[a-z0-9-]{1,60}$/)
      .optional(),
    /** The results page's query string (filters), as in its URL. */
    search: z.string().max(2000),
    after: z.string().min(1).max(200),
  })
  .strict();

/** "Load more" on category and search pages: the next keyset page (read-only). */
export async function moreListings(
  input: unknown,
): Promise<{ items: ListingCard[]; nextCursor: string | null }> {
  const parsed = MoreInput.safeParse(input);
  if (!parsed.success) return { items: [], nextCursor: null };
  const params = new URLSearchParams(parsed.data.search);
  const raw: Record<string, string[]> = {};
  for (const [key, value] of params) (raw[key] ??= []).push(value);
  raw.after = [parsed.data.after];
  const page = await resultsPage(
    { departmentSlug: parsed.data.departmentSlug, subcategorySlug: parsed.data.subcategorySlug },
    raw,
  );
  return { items: page.items, nextCursor: page.nextCursor };
}
