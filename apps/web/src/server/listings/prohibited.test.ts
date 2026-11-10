import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PROHIBITED_KEYWORDS } from '@/config/prohibited-keywords';
import { normalizeListingText, prohibitedMatches } from './prohibited';

describe('prohibited-item check (UI hint)', () => {
  it('matches whole words and phrases in the title or description, any case', () => {
    expect(prohibitedMatches('Hunting RIFLE, barely used', '')).toEqual(['weapons']);
    expect(prohibitedMatches('Desk', 'Comes with a free vape.')).toEqual(['alcohol_tobacco']);
    expect(prohibitedMatches('Brass  knuckles!', '')).toEqual(['weapons']);
  });

  it('does not match inside other words', () => {
    expect(prohibitedMatches('Gunmetal grey sofa', 'Shotglass not included')).toEqual([]);
    expect(prohibitedMatches('Methodist hymnal', 'Swine-flu era thermometer')).toEqual([]);
  });

  it('folds accents and look-alike letters like the database', () => {
    expect(prohibitedMatches('A RÍFLE stand', '')).toEqual(['weapons']);
    // Cyrillic і in "rіfle".
    expect(prohibitedMatches(`r${String.fromCodePoint(0x456)}fle`, '')).toEqual(['weapons']);
    expect(normalizeListingText('1:1  AR-15!')).toBe(' 1:1 ar-15 ');
  });

  it('reports every matching group', () => {
    expect(prohibitedMatches('Replica watch', 'and some beer')).toEqual([
      'alcohol_tobacco',
      'counterfeit',
    ]);
  });

  it('clean listings pass', () => {
    expect(prohibitedMatches('Walnut desk', 'Solid wood, light scratches.')).toEqual([]);
  });
});

describe('the database list mirrors this one', () => {
  const dir = join(__dirname, '..', '..', '..', '..', '..', 'supabase', 'migrations');
  const file = readdirSync(dir).find((name) => name.endsWith('_load_prohibited_keywords_v1.sql'));
  const sql = readFileSync(join(dir, file ?? ''), 'utf8');

  it('has the same terms in the same groups', () => {
    const rows = [...sql.matchAll(/\('([^']+)', '([a-z_]+)'\)/g)].map(([, term, group]) => [
      term,
      group,
    ]);
    const expected = Object.entries(PROHIBITED_KEYWORDS).flatMap(([group, words]) =>
      words.map((word) => [word, group]),
    );
    expect(rows).toEqual(expected);
  });

  it('every term is already in normalized form, so both sides match it the same way', () => {
    for (const words of Object.values(PROHIBITED_KEYWORDS)) {
      for (const word of words) expect(normalizeListingText(word)).toBe(` ${word} `);
    }
  });
});
