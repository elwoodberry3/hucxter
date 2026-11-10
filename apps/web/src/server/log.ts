/**
 * Server error logs (Brief 03C.1b H5): one JSON line with the event name, the HTTP status and the
 * error code only. Never a body, message, email, phone or token, so logs can't leak PII.
 */
export function logError(
  event: string,
  detail: { status?: number | null | undefined; code?: string | null | undefined } = {},
): void {
  const line: Record<string, string | number> = { event };
  if (typeof detail.status === 'number') line.status = detail.status;
  if (typeof detail.code === 'string' && /^[A-Za-z0-9_.-]{1,40}$/.test(detail.code)) {
    line.code = detail.code;
  }
  console.error(JSON.stringify(line));
}

/** A loggable code from a thrown value: its `code`, or the suffix of our own "<event>:<code>" errors. */
export function codeOf(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const { code, message } = error as { code?: unknown; message?: unknown };
  if (typeof code === 'string') return code;
  if (typeof message === 'string') return /^[a-z_]+:([A-Za-z0-9_]{1,20})$/.exec(message)?.[1];
  return undefined;
}
