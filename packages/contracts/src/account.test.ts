import { describe, expect, it } from 'vitest';
import {
  BIO_BLOCKED_MESSAGE,
  Bio,
  DeleteAccountInput,
  DisplayName,
  NAME_BLOCKED_MESSAGE,
  Email,
  OtpCode,
  ProfileResetInput,
  ProfileUpdate,
  parseUsPhone,
} from './account';

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
  it('turns tabs into spaces (the database allows no tabs)', () => {
    expect(Bio.parse('Lamps\tand chairs')).toBe('Lamps and chairs');
  });

  it('refuses hidden and direction-control characters', () => {
    expect(Bio.safeParse('Hi\u200bthere').success).toBe(false);
    expect(DisplayName.safeParse('\u202eAlex').success).toBe(false);
  });

  it.each([
    '',
    'Weekend woodworker. Selling things I no longer need.',
    'Line one\nLine two\nLine three\nLine four',
    'Selling since 2015 in 2024',
    'Happy to support local sellers',
    'Official Portland pickup spot: the library',
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
    'Ask Hücxter',
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

describe('ProfileUpdate (3C.2 settings)', () => {
  const valid = {
    displayName: 'Sam',
    handle: '@Sam.R',
    bio: 'Vintage lamps.\nPortland.',
    zip: '97205',
  };
  it('takes name, handle, bio and ZIP, normalizing the handle', () => {
    const parsed = ProfileUpdate.parse(valid);
    expect(parsed).toEqual({ ...valid, handle: 'sam.r' });
  });
  it('applies the bio and handle rules', () => {
    expect(ProfileUpdate.safeParse({ ...valid, bio: 'Call 503 555 0100' }).success).toBe(false);
    expect(ProfileUpdate.safeParse({ ...valid, bio: 'x'.repeat(151) }).success).toBe(false);
    expect(ProfileUpdate.safeParse({ ...valid, handle: 'support_team' }).success).toBe(false);
    expect(ProfileUpdate.safeParse({ ...valid, bio: '' }).success).toBe(true);
  });
  it('ProfileResetInput refuses the placeholder name', () => {
    expect(
      ProfileResetInput.safeParse({ displayName: 'Hucxter member', handle: 'sam' }).success,
    ).toBe(false);
    expect(ProfileResetInput.safeParse({ displayName: 'Sam', handle: 'sam_r' }).success).toBe(true);
  });
});

describe('narrower blocked terms (Brief 03C.1b H8)', () => {
  it.each(['Badminton Bob', 'Supportive Sam', 'Officially Jo', 'Zoë Ελένη'])(
    'accepts the name %j',
    (name) => {
      expect(DisplayName.safeParse(name).success).toBe(true);
    },
  );

  it.each([
    'Hucxter Support',
    'Bob Admin',
    'Admin',
    'ＡＤＭＩＮ Bob',
    'Ηucxter', // Greek capital eta
    'Supрort team', // Cyrillic р
    'Hücxter',
    'Bob_Admin',
    'Support24',
    'Official Bob',
    'Hucxterfan',
  ])('refuses the name %j', (name) => {
    const result = DisplayName.safeParse(name);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toContain(NAME_BLOCKED_MESSAGE);
  });

  it('refuses the brand in a bio, with its own message', () => {
    const result = Bio.safeParse('Selling for Hucxtеr'); // Cyrillic е
    expect(result.error?.issues[0]?.message).toBe(BIO_BLOCKED_MESSAGE);
  });
});
