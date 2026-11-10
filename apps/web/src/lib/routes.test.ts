import { describe, expect, it } from 'vitest';
import { isFeedPath, isProductPath, needsInlineStyles } from './routes';

describe('isProductPath', () => {
  it('matches listing pages only', () => {
    expect(isProductPath('/l/abc')).toBe(true);
    expect(isProductPath('/dev/templates/listing')).toBe(false);
    expect(isProductPath('/l')).toBe(false);
    expect(isProductPath('/c/home')).toBe(false);
    expect(isProductPath('/l/abc/edit')).toBe(false);
  });
});

describe('isFeedPath and needsInlineStyles (3D)', () => {
  it('matches /discover only', () => {
    expect(isFeedPath('/discover')).toBe(true);
    expect(isFeedPath('/discover/')).toBe(true);
    expect(isFeedPath('/discover/x')).toBe(false);
    expect(isFeedPath('/discovery')).toBe(false);
  });

  it('allows inline styles on listing pages and Discover, nowhere else', () => {
    expect(needsInlineStyles('/l/abc')).toBe(true);
    expect(needsInlineStyles('/discover')).toBe(true);
    for (const path of ['/', '/c/home', '/search', '/u/sam', '/sell', '/settings', '/admin']) {
      expect(needsInlineStyles(path)).toBe(false);
    }
  });
});
