import { describe, expect, it } from 'vitest';
import { isSheetEntry, withSheetMarker } from './sheet-history';

describe('sheet history markers', () => {
  it('adds a marker without dropping existing (Next.js) state', () => {
    const state = withSheetMarker({ __NA: true, tree: 'x' }, 'filters');
    expect(state).toMatchObject({ __NA: true, tree: 'x' });
    expect(isSheetEntry(state, 'filters')).toBe(true);
    expect(isSheetEntry(state, 'search')).toBe(false);
  });

  it('handles empty history state', () => {
    expect(isSheetEntry(null, 'filters')).toBe(false);
    expect(isSheetEntry(withSheetMarker(null, 'filters'), 'filters')).toBe(true);
  });
});
