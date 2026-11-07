import { describe, expect, it } from 'vitest';
import { Bio, DeleteAccountInput, DisplayName, Email, OtpCode, parseUsPhone } from './account';

describe('parseUsPhone', () => {
  it.each([
    ['(503) 234-5678', '+15032345678'],
    ['503.234.5678', '+15032345678'],
    ['1 503 234 5678', '+15032345678'],
    ['+1 503-234-5678', '+15032345678'],
    ['+15032345678', '+15032345678'],
  ])('normalizes %s to E.164', (input, e164) => {
    expect(parseUsPhone(input)).toEqual({ ok: true, e164 });
  });

  it.each([
    ['+44 20 7946 0958', 'not_us'],
    ['+52 55 1234 5678', 'not_us'],
    ['+1 503 234 567', 'format'],
    ['503 234 567', 'format'],
    ['503 234 56789', 'format'],
    ['103 234 5678', 'format'],
    ['503 034 5678', 'format'],
    ['911 234 5678', 'format'],
    ['503 411 5678', 'format'],
    ['503-234-5678 ext 2', 'format'],
    ['5+03 234 5678', 'format'],
    ['', 'format'],
  ] as const)('rejects %s as %s', (input, reason) => {
    expect(parseUsPhone(input)).toEqual({ ok: false, reason });
  });

  it.each(['800 234 5678', '888 234 5678', '833 234 5678', '900 234 5678', '503 976 1234'])(
    'refuses toll-free and premium number %s',
    (input) => {
      expect(parseUsPhone(input)).toEqual({ ok: false, reason: 'not_allowed' });
    },
  );

  it('accepts the fictional 555-01xx test range only with allowFictional', () => {
    expect(parseUsPhone('503 555 0100')).toEqual({ ok: false, reason: 'not_allowed' });
    expect(parseUsPhone('503 555 0100', { allowFictional: true })).toEqual({
      ok: true,
      e164: '+15035550100',
    });
    // Other 555 numbers are real directory-assistance-style numbers, not the fictional range.
    expect(parseUsPhone('503 555 1234')).toEqual({ ok: true, e164: '+15035551234' });
  });
});

describe('DisplayName', () => {
  it.each(['Sam', 'Ana María', 'J.R.', 'Sam 2', '  Lee  '])('accepts %s', (name) => {
    expect(DisplayName.safeParse(name).success).toBe(true);
  });

  it.each([
    'A',
    'x'.repeat(26),
    'Hucxter member',
    'HUCXTER fan',
    'Site Admin',
    'Tech Support',
    'Official Bob',
    'me@example.com',
    'see www.example.com',
    'https://x.io',
    'shop.example.com',
    'Call 503 555 0100',
    '5035550100',
    'Tab\tName',
  ])('rejects %j', (name) => {
    expect(DisplayName.safeParse(name).success).toBe(false);
  });

  it('trims', () => {
    expect(DisplayName.parse('  Lee  ')).toBe('Lee');
  });

  it('allows exactly 25 characters', () => {
    expect(DisplayName.safeParse('x'.repeat(25)).success).toBe(true);
  });
});

describe('Bio', () => {
  it.each([
    '',
    'Weekend woodworker. Selling things I no longer need.',
    'Line one\nLine two\nLine three\nLine four',
    'Selling since 2015 in 2024',
  ])('accepts %j', (bio) => {
    expect(Bio.safeParse(bio).success).toBe(true);
  });

  it.each([
    'x'.repeat(151),
    'a\nb\nc\nd\ne',
    'me@example.com',
    'Shop at www.example.com',
    'Text 503-555-0100',
    'Call (503) 555 0100 anytime',
    'Official Hucxter seller',
    'Ask support',
  ])('rejects %j', (bio) => {
    expect(Bio.safeParse(bio).success).toBe(false);
  });

  it('normalizes line endings, strips control characters and trims', () => {
    expect(Bio.parse('  Hi\r\nthere\u0007  ')).toBe('Hi\nthere');
  });
});

describe('Email and OtpCode', () => {
  it('normalizes email case and whitespace', () => {
    expect(Email.parse('  Person@Example.COM ')).toBe('person@example.com');
  });

  it('rejects malformed email', () => {
    expect(Email.safeParse('not-an-email').success).toBe(false);
  });

  it('accepts a 6-digit code with spaces and rejects anything else', () => {
    expect(OtpCode.parse('123 456')).toBe('123456');
    expect(OtpCode.safeParse('12345').success).toBe(false);
    expect(OtpCode.safeParse('12345a').success).toBe(false);
  });
});

describe('DeleteAccountInput', () => {
  it('requires the typed confirmation exactly', () => {
    expect(DeleteAccountInput.safeParse({ confirm: 'DELETE' }).success).toBe(true);
    expect(DeleteAccountInput.safeParse({ confirm: 'delete' }).success).toBe(false);
  });
});
