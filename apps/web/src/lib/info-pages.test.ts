import { describe, expect, it } from 'vitest';
import { INFO_PAGES, infoPage } from './info-pages';

describe('info pages', () => {
  it('resolves known slugs only, ignoring prototype keys', () => {
    expect(infoPage('terms')?.title).toBe('Terms of Service');
    expect(infoPage('nope')).toBeUndefined();
    expect(infoPage('constructor')).toBeUndefined();
    expect(infoPage('__proto__')).toBeUndefined();
  });

  it('never collides with real routes', () => {
    const reserved = [
      'c',
      'l',
      'search',
      'sell',
      'messages',
      'saved',
      'listings',
      'profile',
      'settings',
      'admin',
      'sign-in',
      'sign-up',
      'dev',
      'api',
    ];
    for (const slug of Object.keys(INFO_PAGES)) expect(reserved).not.toContain(slug);
  });
});
