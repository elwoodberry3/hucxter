import { PROHIBITED_KEYWORDS } from '@/config/prohibited-keywords';

function normalize(text: string): string {
  return ` ${text
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}:+-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()} `;
}

/**
 * Returns the prohibited-item groups that title + description match (whole words or phrases,
 * ignoring case and punctuation). Any match → the listing is held for review.
 */
export function prohibitedMatches(
  title: string,
  description: string,
  keywords: Record<string, readonly string[]> = PROHIBITED_KEYWORDS,
): string[] {
  const text = normalize(`${title} ${description}`);
  return Object.entries(keywords)
    .filter(([, words]) => words.some((word) => text.includes(normalize(word))))
    .map(([group]) => group);
}
