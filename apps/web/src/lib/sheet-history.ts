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
 * The in-app path for `href`, or null when it is another origin or would be read as one: a path
 * starting with `//` or `/\` becomes protocol-relative once the origin is dropped.
 */
export function sheetPath(href: string, origin: string): string | null {
  const url = new URL(href, origin);
  if (url.origin !== origin || /^\/[/\\]/.test(url.pathname)) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Destination of a GET form submit, honouring the submitter's form* overrides; null otherwise. */
export function formNavigationTarget(
  form: { action: string; method: string; target: string; entries: Iterable<[string, unknown]> },
  origin: string,
): string | null {
  if (form.method.toLowerCase() !== 'get' || form.target === '_blank') return null;
  const path = sheetPath(form.action, origin);
  if (path === null) return null;
  const pathname = new URL(path, origin).pathname;
  const params = new URLSearchParams();
  for (const [key, value] of form.entries) {
    if (typeof value === 'string' && value !== '') params.append(key, value);
  }
  const search = params.toString();
  return `${pathname}${search === '' ? '' : `?${search}`}`;
}

/**
 * The same-origin destination of a click or GET form submit inside a sheet, or null when the
 * browser should handle it (new tab, download, other origin, non-GET form).
 */
export function sheetNavigationTarget(
  event: {
    target: EventTarget | null;
    type: string;
    submitter?: HTMLElement | null;
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
    return sheetPath(anchor.href, origin);
  }
  if (event.type === 'submit') {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return null;
    const submitter =
      event.submitter instanceof HTMLButtonElement || event.submitter instanceof HTMLInputElement
        ? event.submitter
        : null;
    // formaction/formmethod/formtarget reflect the form's values when the attribute is absent.
    return formNavigationTarget(
      {
        action: submitter?.hasAttribute('formaction') ? submitter.formAction : form.action,
        method: submitter?.hasAttribute('formmethod') ? submitter.formMethod : form.method,
        target: submitter?.hasAttribute('formtarget') ? submitter.formTarget : form.target,
        entries: new FormData(form, submitter),
      },
      origin,
    );
  }
  return null;
}
