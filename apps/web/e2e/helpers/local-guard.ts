/**
 * Safety guard for e2e setup/teardown that uses the Supabase SECRET key (Founder amendment 3):
 * only ever against a local stack, and only ever touching test users.
 */
export const E2E_EMAIL_DOMAIN = '@e2e.hucxter.test';

export function assertLocalSupabase(url: string | undefined): string {
  if (url === undefined) throw new Error('SUPABASE_URL is not set');
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('SUPABASE_URL is not a URL');
  }
  const local = parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost';
  if (parsed.protocol !== 'http:' || !local || parsed.username !== '' || parsed.password !== '') {
    throw new Error('Refusing to run e2e account setup against a non-local Supabase');
  }
  return parsed.origin;
}

export function isE2eEmail(email: string | null | undefined): boolean {
  if (typeof email !== 'string') return false;
  const lower = email.toLowerCase();
  return (
    lower.endsWith(E2E_EMAIL_DOMAIN) &&
    lower.indexOf('@') === lower.length - E2E_EMAIL_DOMAIN.length
  );
}
