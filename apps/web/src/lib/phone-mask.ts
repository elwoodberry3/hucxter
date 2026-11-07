/**
 * The member's own number for Settings → Account, masked (Brief 03C.2 §2): area code and last
 * three digits only, e.g. "+1 (503) •••-•742". Never shown to anyone else.
 */
export function maskPhone(phone: string | null | undefined): string | null {
  const digits = (phone ?? '').replace(/\D/g, '');
  const national = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (national.length !== 10) return null;
  return `+1 (${national.slice(0, 3)}) •••-•${national.slice(7)}`;
}
