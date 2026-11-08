import { foldText } from '@hucxter/contracts';
import { PROHIBITED_KEYWORDS } from '@/config/prohibited-keywords';

/**
 * Same steps as SQL listing_text_normalize: fold (accents, look-alikes, case, hidden characters),
 * then everything except a–z, 0–9 and ":+-" becomes a space, padded for whole-word matching.
 */
export function normalizeListingText(text: string): string {
  return ` ${foldText(text)
    .replace(/[^a-z0-9:+-]+/g, ' ')
    .trim()} `;
}

/**
 * The prohibited-item groups that title + description match (whole words or phrases). A UI hint
 * only (the admin queue shows the groups): the database decides whether a listing is held for
 * review (listing_text_flagged over the prohibited_keywords table, which this list mirrors).
 */
export function prohibitedMatches(
  title: string,
  description: string,
  keywords: Record<string, readonly string[]> = PROHIBITED_KEYWORDS,
): string[] {
  const text = normalizeListingText(`${title} ${description}`);
  return Object.entries(keywords)
    .filter(([, words]) => words.some((word) => text.includes(` ${word} `)))
    .map(([group]) => group);
}
