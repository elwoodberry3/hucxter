import { describe, expect, it } from 'vitest';
import { isProductPath } from './routes';

describe('isProductPath', () => {
  it('matches listing pages and the template preview only', () => {
    expect(isProductPath('/l/abc')).toBe(true);
    expect(isProductPath('/dev/templates/listing')).toBe(true);
    expect(isProductPath('/l')).toBe(false);
    expect(isProductPath('/c/home')).toBe(false);
    expect(isProductPath('/l/abc/edit')).toBe(false);
  });
});
