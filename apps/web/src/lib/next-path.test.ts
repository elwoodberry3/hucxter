import { describe, expect, it } from 'vitest';
import { authHref, safeNextPath } from './next-path';

describe('safeNextPath', () => {
  it.each([
    ['/', '/'],
    ['/sell', '/sell'],
    [
      '/c/electronics/gaming?condition=good#results',
      '/c/electronics/gaming?condition=good#results',
    ],
    ['/search?q=red%20bike', '/search?q=red%20bike'],
  ])('accepts same-origin path %s', (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });

  it.each([
    'https://evil.example',
    'http://evil.example/sell',
    'HTTPS://EVIL.EXAMPLE',
    '//evil.example',
    '///evil.example',
    '/\\evil.example',
    '\\\\evil.example',
    '/\\/evil.example',
    'javascript:alert(1)',
    'data:text/html,hi',
    'evil.example',
    ' /sell',
    '/sell\n',
    '/\t/evil.example',
    '%2F%2Fevil.example',
    '/%2F%2Fevil.example',
    '/%2f%2fevil.example',
    '/%5Cevil.example',
    '/%5c%5cevil.example',
    '/%09/evil.example',
    '/%0d%0aLocation:%20https://evil.example',
    '/%E0%A4%A',
    '/.//evil.example',
    '/./\\evil.example',
    'http:/evil.example',
    'https:evil.example',
    '/sign-in',
    '/sign-up?next=/sell',
    '',
  ])('rejects %j', (input) => {
    expect(safeNextPath(input)).toBeNull();
  });

  it('rejects non-strings and overly long values', () => {
    expect(safeNextPath(undefined)).toBeNull();
    expect(safeNextPath(['/sell'])).toBeNull();
    expect(safeNextPath(`/${'a'.repeat(600)}`)).toBeNull();
  });
});

describe('authHref', () => {
  it('encodes a safe next path', () => {
    expect(authHref('/c/home?room=Kitchen')).toBe('/sign-in?next=%2Fc%2Fhome%3Froom%3DKitchen');
    expect(authHref('/sell', '/sign-up')).toBe('/sign-up?next=%2Fsell');
  });

  it('drops unsafe or trivial next values', () => {
    expect(authHref('//evil.example')).toBe('/sign-in');
    expect(authHref('/')).toBe('/sign-in');
    expect(authHref(null)).toBe('/sign-in');
  });
});
