import { describe, expect, it } from 'vitest';
import { prohibitedMatches } from './prohibited';

describe('prohibited-item check', () => {
  it('matches whole words and phrases in the title or description, any case', () => {
    expect(prohibitedMatches('Hunting RIFLE, barely used', '')).toEqual(['weapons']);
    expect(prohibitedMatches('Desk', 'Comes with a free vape.')).toEqual(['alcohol_tobacco']);
    expect(prohibitedMatches('Brass  knuckles!', '')).toEqual(['weapons']);
  });

  it('does not match inside other words', () => {
    expect(prohibitedMatches('Gunmetal grey sofa', 'Shotglass not included')).toEqual([]);
    expect(prohibitedMatches('Methodist hymnal', 'Swine-flu era thermometer')).toEqual([]);
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
