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
 * Words that can't appear anywhere in a handle, display name or bio (case-insensitive), so no
 * member can pass for Hucxter staff. The only exception is the system placeholder below.
 */
export const BLOCKED_TERMS = ['hucxter', 'admin', 'support', 'official'] as const;

/** Set only by staff moderation ("Require new name"); members can't choose it. */
export const PLACEHOLDER_DISPLAY_NAME = 'Hucxter member';

export function containsBlockedTerm(value: string): boolean {
  const lower = value.toLowerCase();
  return BLOCKED_TERMS.some((term) => lower.includes(term));
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
