import { describe, expect, it } from 'vitest';
import { formNavigationTarget, isSheetEntry, sheetPath, withSheetMarker } from './sheet-history';

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

const ORIGIN = 'https://hucxter.app';

describe('sheetPath', () => {
  it('keeps same-origin paths with query and hash', () => {
    expect(sheetPath('https://hucxter.app/c/bikes?sort=new#top', ORIGIN)).toBe(
      '/c/bikes?sort=new#top',
    );
    expect(sheetPath('/search?q=lamp', ORIGIN)).toBe('/search?q=lamp');
  });

  it('rejects other origins', () => {
    expect(sheetPath('https://evil.example/x', ORIGIN)).toBeNull();
  });

  it('rejects same-origin paths that would turn protocol-relative', () => {
    expect(sheetPath('https://hucxter.app//evil.example/x', ORIGIN)).toBeNull();
    expect(sheetPath('https://hucxter.app/\\evil.example/x', ORIGIN)).toBeNull();
  });
});

describe('formNavigationTarget', () => {
  const form = (overrides: Partial<Parameters<typeof formNavigationTarget>[0]> = {}) => ({
    action: 'https://hucxter.app/search',
    method: 'get',
    target: '',
    entries: [
      ['q', 'lamp'],
      ['empty', ''],
      ['file', {}],
    ] as [string, unknown][],
    ...overrides,
  });

  it('builds the GET URL from non-empty string entries', () => {
    expect(formNavigationTarget(form(), ORIGIN)).toBe('/search?q=lamp');
  });

  it('includes the submitter entry when present', () => {
    const entries: [string, unknown][] = [
      ['q', 'lamp'],
      ['sort', 'new'],
    ];
    expect(formNavigationTarget(form({ entries }), ORIGIN)).toBe('/search?q=lamp&sort=new');
  });

  it('leaves non-GET, new-tab, off-site and protocol-relative forms to the browser', () => {
    expect(formNavigationTarget(form({ method: 'post' }), ORIGIN)).toBeNull();
    expect(formNavigationTarget(form({ target: '_blank' }), ORIGIN)).toBeNull();
    expect(formNavigationTarget(form({ action: 'https://evil.example/s' }), ORIGIN)).toBeNull();
    expect(
      formNavigationTarget(form({ action: 'https://hucxter.app//evil.example/s' }), ORIGIN),
    ).toBeNull();
  });
});
