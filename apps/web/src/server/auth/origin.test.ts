import { describe, expect, it } from 'vitest';
import { isSameOrigin } from './origin';

describe('isSameOrigin', () => {
  const app = new URL('https://qa.hucxter.app');

  it('accepts exactly the app origin', () => {
    expect(isSameOrigin('https://qa.hucxter.app', app)).toBe(true);
  });

  it.each([
    null,
    undefined,
    '',
    'null',
    'https://evil.example',
    'http://qa.hucxter.app',
    'https://qa.hucxter.app:8443',
    'https://qa.hucxter.app.evil.example',
    'not a url',
  ])('refuses %j', (origin) => {
    expect(isSameOrigin(origin, app)).toBe(false);
  });
});
