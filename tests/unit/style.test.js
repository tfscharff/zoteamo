import { describe, expect, it } from 'vitest';
import { chooseStyle, ensureVoter } from '../../functions/_lib/style.js';

const url = (q = '') => new URL(`https://x.test/l/t${q}`);

describe('chooseStyle', () => {
  it('uses ?style and remembers it', () => {
    const { style, cookie } = chooseStyle(url('?style=mla'), {}, 'apa');
    expect(style).toBe('mla');
    expect(cookie).toMatch(/^zoteamo_style=mla;/);
  });

  it('does not reset a cookie that already matches', () => {
    expect(chooseStyle(url('?style=mla'), { zoteamo_style: 'mla' }, 'apa').cookie).toBeNull();
  });

  it('falls back to the cookie, then the group default, ignoring junk', () => {
    expect(chooseStyle(url(), { zoteamo_style: 'chicago' }, 'apa').style).toBe('chicago');
    expect(chooseStyle(url('?style=harvard'), { zoteamo_style: 'x' }, 'mla')).toEqual({ style: 'mla', cookie: null });
  });
});

describe('ensureVoter', () => {
  it('keeps a valid voter cookie', () => {
    const id = '6f1c2a8e-1b2c-4d5e-8f90-123456789abc';
    expect(ensureVoter({ zoteamo_voter: id })).toEqual({ voterId: id, cookie: null });
  });

  it('issues a new voter ID when missing or malformed', () => {
    const { voterId, cookie } = ensureVoter({ zoteamo_voter: 'nope' });
    expect(voterId).toMatch(/^[0-9a-f-]{36}$/);
    expect(cookie).toContain(`zoteamo_voter=${voterId};`);
  });
});
