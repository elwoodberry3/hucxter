import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BLOCKED_TERMS,
  CONFUSABLES_FROM,
  COMBINING_MARKS,
  CONFUSABLES_TO,
  HANDLE_RESERVED,
  HIDDEN_CHARS,
  Handle,
  containsBlockedTerm,
  handleProblem,
  normalizeHandle,
} from './handle';

describe('normalizeHandle', () => {
  it('trims, drops a leading @ and lowercases', () => {
    expect(normalizeHandle('  @Alex.B ')).toBe('alex.b');
  });
});

describe('handleProblem', () => {
  it.each(['alex', 'a_b.c9', 'a'.repeat(24), 'x9z'])('accepts %s', (handle) => {
    expect(handleProblem(handle)).toBeNull();
  });

  it.each([
    ['al', 'length'],
    ['a'.repeat(25), 'length'],
    ['al-ex', 'characters'],
    ['Alex', 'characters'],
    ['.alex', 'dots'],
    ['alex.', 'dots'],
    ['al..ex', 'dots'],
    ['503.555.0100', 'letter'],
    ['1234', 'letter'],
    ['settings', 'reserved'],
    ['me', 'length'],
    ['the_official_bob', 'reserved'],
    ['hucxterfan', 'reserved'],
    ['admin2', 'reserved'],
    ['support.team', 'reserved'],
  ] as const)('rejects %s (%s)', (handle, problem) => {
    expect(handleProblem(handle)).toBe(problem);
  });
});

describe('Handle schema', () => {
  it('normalizes before validating', () => {
    expect(Handle.parse('@Quill.Zed')).toBe('quill.zed');
  });

  it('explains the first broken rule', () => {
    const result = Handle.safeParse('@Admin');
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('That handle isn’t available.');
  });
});

describe('containsBlockedTerm', () => {
  it.each(['Hucxter fan', 'ADMIN', 'Tech Support', 'Official Bob'])('blocks %s', (value) => {
    expect(containsBlockedTerm(value)).toBe(true);
  });

  it('allows ordinary names', () => {
    expect(containsBlockedTerm('Alex B')).toBe(false);
  });

  it('sees through look-alike letters, fullwidth forms and invisible characters', () => {
    expect(containsBlockedTerm('Hucxtеr Ѕupport')).toBe(true); // Cyrillic е, Ѕ
    expect(containsBlockedTerm('ＨＵＣＸＴＥＲ')).toBe(true);
    expect(containsBlockedTerm('Sup\u200dport')).toBe(true);
    expect(containsBlockedTerm('Off\u00adicial')).toBe(true);
    expect(containsBlockedTerm('Zoë Ελένη')).toBe(false);
  });

  it('also sees through accents, small capitals, tag characters and the Braille blank', () => {
    const tag = String.fromCodePoint(0xe0061);
    const braille = String.fromCodePoint(0x2800);
    const acute = String.fromCodePoint(0x301);
    expect(containsBlockedTerm('Hücxter Team')).toBe(true);
    expect(containsBlockedTerm(`Hucxte${acute}r Team`)).toBe(true);
    expect(containsBlockedTerm('ʜᴜᴄxᴛᴇʀ Team')).toBe(true);
    expect(containsBlockedTerm(`Huc${tag}xter Team`)).toBe(true);
    expect(containsBlockedTerm(`Huc${braille}xter`)).toBe(true);
    expect(containsBlockedTerm('ЅUPPORT')).toBe(true);
    expect(HIDDEN_CHARS.test(`Huc${tag}xter`)).toBe(true);
    expect(HIDDEN_CHARS.test(`a${braille}b`)).toBe(true);
    expect(containsBlockedTerm('José Núñez')).toBe(false);
  });

  it('also sees through accents, small capitals, tag characters and the Braille blank', () => {
    const tag = String.fromCodePoint(0xe0061);
    const braille = String.fromCodePoint(0x2800);
    expect(containsBlockedTerm('Hücxter Team')).toBe(true);
    expect(containsBlockedTerm('Hucxte' + String.fromCodePoint(0x301) + 'r Team')).toBe(true);
    expect(containsBlockedTerm('ʜᴜᴄxᴛᴇʀ Team')).toBe(true);
    expect(containsBlockedTerm(`Huc${tag}xter Team`)).toBe(true);
    expect(containsBlockedTerm(`Huc${braille}xter`)).toBe(true);
    expect(containsBlockedTerm('ЅUPPORT')).toBe(true);
    expect(HIDDEN_CHARS.test(`Huc${tag}xter`)).toBe(true);
    expect(HIDDEN_CHARS.test(`a${braille}b`)).toBe(true);
    expect(containsBlockedTerm('José Núñez')).toBe(false);
  });

  it('maps each look-alike to one Latin letter', () => {
    // All BMP letters, so UTF-16 length is the letter count.
    expect(CONFUSABLES_FROM).toHaveLength(CONFUSABLES_TO.length);
  });
});

describe('the database mirrors these lists', () => {
  const dir = join(__dirname, '..', '..', '..', 'supabase', 'migrations');
  const file = readdirSync(dir).find((name) => name.endsWith('_add_profile_handles.sql'));
  const sql = readFileSync(join(dir, file ?? ''), 'utf8');

  it('has the same exact reserved handles', () => {
    const array = /select p_handle = any \(array\[([\s\S]*?)\]::text\[\]\)/.exec(sql)?.[1] ?? '';
    const words = [...array.matchAll(/'([^']+)'/g)].map((match) => match[1]);
    expect(words).toEqual([...HANDLE_RESERVED]);
  });

  it('folds and refuses the same characters (text_fold, has_hidden_chars)', () => {
    const fold = readFileSync(
      join(dir, readdirSync(dir).find((name) => name.endsWith('_harden_profile_rules.sql')) ?? ''),
      'utf8',
    );
    expect(fold).toContain(`'${CONFUSABLES_FROM}'`);
    expect(fold).toContain(`'${CONFUSABLES_TO}'`);
    const sqlClass = /select p_value ~ '(\[[^']+\])'/.exec(fold)?.[1];
    // SQL writes code points above U+FFFF as \\U0001xxxx, JavaScript as \\u{1xxxx}.
    const asJs = sqlClass?.replace(/\\U0*([0-9a-f]+)/g, '\\u{$1}');
    expect(asJs).toBe(HIDDEN_CHARS.source);
    expect(fold).toContain(COMBINING_MARKS.source);
  });

  it('has the same blocked terms', () => {
    const terms = /p_handle ~ '\(([a-z|]+)\)'/.exec(sql)?.[1]?.split('|') ?? [];
    expect(terms).toEqual([...BLOCKED_TERMS]);
  });
});
