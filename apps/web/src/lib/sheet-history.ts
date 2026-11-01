/**
 * History bookkeeping for sheets: opening a sheet pushes one entry marked with the sheet id, so the
 * browser Back button closes it. Closing pops that entry; navigating from inside a sheet pops it
 * first, so Back never lands on a "sheet open" ghost entry.
 */
export const SHEET_STATE_KEY = '__hxSheet';

export function withSheetMarker(state: unknown, id: string): Record<string, unknown> {
  const base =
    typeof state === 'object' && state !== null ? (state as Record<string, unknown>) : {};
  return { ...base, [SHEET_STATE_KEY]: id };
}

export function isSheetEntry(state: unknown, id: string): boolean {
  return (
    typeof state === 'object' &&
    state !== null &&
    (state as Record<string, unknown>)[SHEET_STATE_KEY] === id
  );
}

/**
 * The same-origin destination of a click or GET form submit inside a sheet, or null when the
 * browser should handle it (new tab, download, other origin, non-GET form).
 */
export function sheetNavigationTarget(
  event: {
    target: EventTarget | null;
    type: string;
    button?: number;
    metaKey?: boolean;
    ctrlKey?: boolean;
    shiftKey?: boolean;
    altKey?: boolean;
    defaultPrevented: boolean;
  },
  origin: string,
): string | null {
  if (event.defaultPrevented) return null;
  if (event.type === 'click') {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return null;
    const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (
      !(anchor instanceof HTMLAnchorElement) ||
      anchor.target === '_blank' ||
      anchor.hasAttribute('download')
    ) {
      return null;
    }
    const url = new URL(anchor.href, origin);
    return url.origin === origin ? `${url.pathname}${url.search}${url.hash}` : null;
  }
  if (event.type === 'submit') {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || form.method.toLowerCase() !== 'get') return null;
    const url = new URL(form.action, origin);
    if (url.origin !== origin) return null;
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(form)) {
      if (typeof value === 'string' && value !== '') params.append(key, value);
    }
    const search = params.toString();
    return `${url.pathname}${search === '' ? '' : `?${search}`}`;
  }
  return null;
}
