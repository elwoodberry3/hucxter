import { z } from 'zod';

/**
 * Public @handles (D-42, Brief 03C.2 §4.1). The database is the source of truth
 * (`handle_is_valid` / `handle_is_reserved` in supabase/migrations/*_add_profile_handles.sql);
 * these lists mirror it for form validation, and a test keeps the two in sync.
 */
export const HANDLE_MIN = 3;
export const HANDLE_MAX = 24;

/** Exact handles nobody can take: routes, roles and words that could pass for staff. */
export const HANDLE_RESERVED = [
  'about',
  'account',
  'admin',
  'administrator',
  'api',
  'auth',
  'billing',
  'c',
  'contact',
  'discover',
  'edit',
  'email',
  'help',
  'home',
  'hucxter',
  'inbox',
  'info',
  'l',
  'legal',
  'login',
  'logout',
  'mail',
  'me',
  'messages',
  'mod',
  'moderator',
  'new',
  'null',
  'payments',
  'privacy',
  'profile',
  'root',
  'saved',
  'search',
  'security',
  'sell',
  'settings',
  'shop',
  'signin',
  'signup',
  'staff',
  'store',
  'support',
  'system',
  'team',
  'terms',
  'u',
  'undefined',
  'welcome',
  'www',
] as const;

/**
 * Words that can't appear anywhere in a handle (case-insensitive, look-alikes folded), so no
 * member can pass for Hucxter staff. Display names and bios use the narrower patterns below.
 */
export const BLOCKED_TERMS = ['hucxter', 'admin', 'support', 'official'] as const;

/**
 * Display names and bios (Brief 03C.1b H8), on folded text: the brand anywhere, and in names the
 * staff words only as whole words (no letter either side), so "Badminton Bob" and "Happy to
 * support local sellers" are fine while "Hucxter Support" and "Bob_Admin" are not. The SQL CHECKs
 * in 20261108130000_relax_profile_blocked_terms use the same two patterns. The only exception is
 * the system placeholder below.
 */
export const BRAND_TERM_PATTERN = 'hucxter';
export const STAFF_WORD_PATTERN = '(^|[^a-z])(admin|support|official)([^a-z]|$)';
const STAFF_WORD = new RegExp(STAFF_WORD_PATTERN);

/** Set only by staff moderation ("Require new name"); members can't choose it. */
export const PLACEHOLDER_DISPLAY_NAME = 'Hucxter member';

/**
 * Look-alike letters (Cyrillic and Greek, both cases; small capitals) folded to lowercase Latin
 * before the blocked-term check, so "Hucxtеr" with a Cyrillic е is caught. Mapped before
 * lowercasing, so the fold doesn't depend on the database collation. SQL `text_fold` uses the
 * same two strings (a unit test keeps them equal).
 */
export const CONFUSABLES_FROM =
  'аеорсухіѕјԁһӏкмтвнԛԝАВЕКМНОРСТУХЅІЈԚԜӀοαρνικτυΑΒΕΖΗΙΚΜΝΟΡΤΥΧıʜᴜᴄᴛᴇʀᴅᴍɪɴᴏꜰᴀʙɢʟᴘꜱᴠᴡʏᴢᴋᴊ';
export const CONFUSABLES_TO =
  'aeopcyxisjdhlkmtbhqwabekmhopctyxsijqwloapviktuabezhikmnoptyxihucterdminofabglpsvwyzkj';

/**
 * Invisible and direction-control characters (soft hyphen, zero-width, bidi controls, variation
 * selectors, Hangul fillers, Braille blank, BOM, specials, shorthand and musical format
 * controls, tag characters). Never allowed in names or bios: they hide blocked terms and
 * can reorder text. SQL `has_hidden_chars` uses the same ranges.
 */
export const HIDDEN_CHARS =
  // eslint-disable-next-line no-misleading-character-class -- single code points on purpose: combining and joiner characters are exactly what this class matches
  /[\u00ad\u034f\u061c\u115f\u1160\u17b4\u17b5\u180b-\u180f\u200b-\u200f\u202a-\u202e\u2060-\u206f\u2800\u3164\ufe00-\ufe0f\ufeff\ufff0-\ufff8\u{1bca0}-\u{1bca3}\u{1d173}-\u{1d17a}\u{e0000}-\u{e0fff}]/u;

/** Combining marks (accents) dropped after NFKD, so "Hücxter" folds to "hucxter". */
export const COMBINING_MARKS =
  // eslint-disable-next-line no-misleading-character-class -- a class of combining marks on purpose
  /[\u0300-\u036f\u1ab0-\u1aff\u1dc0-\u1dff\u20d0-\u20ff\ufe20-\ufe2f]/gu;

/**
 * NFKD (fullwidth → ASCII, accents split off), accents removed, look-alikes → Latin, lowercase,
 * invisible characters removed. SQL `text_fold` does the same steps.
 */
export function foldText(value: string): string {
  const bare = value.normalize('NFKD').replace(COMBINING_MARKS, '');
  let out = '';
  for (const char of bare) {
    const i = CONFUSABLES_FROM.indexOf(char);
    out += i === -1 ? char : (CONFUSABLES_TO[i] ?? char);
  }
  // eslint-disable-next-line no-misleading-character-class -- same class as HIDDEN_CHARS
  return out.toLowerCase().replace(new RegExp(HIDDEN_CHARS.source, 'gu'), '');
}

/** Handles: any blocked term anywhere. */
export function containsBlockedTerm(value: string): boolean {
  const folded = foldText(value);
  return BLOCKED_TERMS.some((term) => folded.includes(term));
}

/** Display names: the brand anywhere, or a staff word as a whole word. */
export function nameHasBlockedTerm(value: string): boolean {
  const folded = foldText(value);
  return folded.includes(BRAND_TERM_PATTERN) || STAFF_WORD.test(folded);
}

/** Bios: the brand anywhere. */
export function bioHasBlockedTerm(value: string): boolean {
  return foldText(value).includes(BRAND_TERM_PATTERN);
}

/** What people type: "@Alex.B " → "alex.b". */
export function normalizeHandle(raw: string): string {
  return raw.trim().replace(/^@/, '').toLowerCase();
}

export type HandleProblem = 'length' | 'characters' | 'dots' | 'letter' | 'reserved';

/** The first rule a normalized handle breaks, or null when it's valid. */
export function handleProblem(handle: string): HandleProblem | null {
  if (handle.length < HANDLE_MIN || handle.length > HANDLE_MAX) return 'length';
  if (!/^[a-z0-9_.]+$/.test(handle)) return 'characters';
  if (/^\.|\.$|\.\./.test(handle)) return 'dots';
  if (!/[a-z]/.test(handle)) return 'letter';
  if ((HANDLE_RESERVED as readonly string[]).includes(handle) || containsBlockedTerm(handle)) {
    return 'reserved';
  }
  return null;
}

export const HANDLE_MESSAGES: Record<HandleProblem, string> = {
  length: `Use ${String(HANDLE_MIN)}–${String(HANDLE_MAX)} characters.`,
  characters: 'Use lowercase letters, numbers, dots and underscores.',
  dots: 'Don’t start or end with a dot, or use two dots in a row.',
  letter: 'Include at least one letter.',
  reserved: 'That handle isn’t available.',
};

export const Handle = z
  .string()
  .max(100)
  .transform(normalizeHandle)
  .superRefine((value, ctx) => {
    const problem = handleProblem(value);
    if (problem !== null) ctx.addIssue({ code: 'custom', message: HANDLE_MESSAGES[problem] });
  });

/** What `handle_status` reports while someone types a new handle. */
export const HANDLE_STATUSES = [
  'available',
  'yours',
  'taken',
  'held',
  'reserved',
  'invalid',
  'limited',
] as const;
export type HandleStatus = (typeof HANDLE_STATUSES)[number];

/** Copy for each status (settings and /welcome). `available` and `yours` are good news. */
export const HANDLE_STATUS_MESSAGES: Record<HandleStatus, string> = {
  available: 'Available',
  yours: 'This is your handle',
  taken: 'That handle is taken.',
  held: 'That handle isn’t available yet.',
  reserved: 'That handle isn’t available.',
  invalid: 'That handle isn’t available.',
  limited: 'Try again shortly',
};
