import { describe, expect, it } from 'vitest';
import { hashToken, newToken, safeEqual, TOKEN_PATTERN } from '../../functions/_lib/tokens.js';

describe('tokens', () => {
  it('makes 22-character URL-safe tokens that differ', () => {
    const tokens = new Set(Array.from({ length: 100 }, newToken));
    expect(tokens.size).toBe(100);
    for (const t of tokens) expect(t).toMatch(TOKEN_PATTERN);
  });

  it('hashes with SHA-256 to lowercase hex', async () => {
    expect(await hashToken('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('compares strings safely', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
    expect(safeEqual('abc', undefined)).toBe(false);
  });
});
