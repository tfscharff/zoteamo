// Picks the viewer's citation style (?style, then cookie, then group default) and identifies voters by cookie.
import { setCookie } from './http.js';
import { STYLES } from './validate.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function chooseStyle(url, cookies, defaultStyle) {
  const asked = url.searchParams.get('style');
  if (STYLES.includes(asked)) {
    return { style: asked, cookie: cookies.zoteamo_style === asked ? null : setCookie('zoteamo_style', asked) };
  }
  if (STYLES.includes(cookies.zoteamo_style)) return { style: cookies.zoteamo_style, cookie: null };
  return { style: defaultStyle, cookie: null };
}

export function ensureVoter(cookies) {
  if (UUID.test(cookies.zoteamo_voter ?? '')) return { voterId: cookies.zoteamo_voter, cookie: null };
  const voterId = crypto.randomUUID();
  return { voterId, cookie: setCookie('zoteamo_voter', voterId) };
}
