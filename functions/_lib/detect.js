// Works out what a member pasted: a URL, DOI, ISBN, PMID or arXiv ID.
// URLs must be public http(s) addresses so translation-server can't be pointed at internal hosts.
export class InputError extends Error {}

const DOI = /^(?:doi:\s*|https?:\/\/(?:dx\.)?doi\.org\/)?(10\.\d{4,9}\/\S+)$/i;
const ISBN_PREFIX = /^isbn(?:-1[03])?:?\s*/i;
const ARXIV = /^(?:arxiv:\s*)?(\d{4}\.\d{4,5}(?:v\d+)?|[a-z-]+(?:\.[a-z]{2})?\/\d{7}(?:v\d+)?)$/i;
const PMID = /^(?:pmid:?\s*)?(\d{1,8})$/i;
const BARE_HOST = /^[a-z0-9-]+(?:\.[a-z0-9-]+)+(?::\d+)?(?:[/?#]|$)/i;
const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;
const PRIVATE_SUFFIXES = ['.localhost', '.local', '.internal', '.lan', '.home.arpa'];

export function detect(input) {
  const text = String(input ?? '').trim();
  if (!text) throw new InputError('Enter a link, DOI, ISBN, PMID or arXiv ID.');
  const doi = DOI.exec(text);
  if (doi) return { kind: 'doi', value: doi[1] };
  const isbn = detectIsbn(text);
  if (isbn) return { kind: 'isbn', value: isbn };
  const arxiv = ARXIV.exec(text);
  if (arxiv) return { kind: 'arxiv', value: arxiv[1] };
  const pmid = PMID.exec(text);
  if (pmid) return { kind: 'pmid', value: pmid[1] };
  return { kind: 'url', value: checkUrl(text) };
}

export function cacheKey({ kind, value }) {
  return `${kind}:${kind === 'doi' ? value.toLowerCase() : value}`;
}

function detectIsbn(text) {
  const compact = text.replace(ISBN_PREFIX, '').replace(/[\s-]/g, '').toUpperCase();
  if (!/^(?:\d{9}[\dX]|\d{13})$/.test(compact)) return null;
  if (!validIsbn(compact)) throw new InputError('That ISBN’s check digit doesn’t match. Check it for typos.');
  return compact;
}

function validIsbn(isbn) {
  let sum = 0;
  if (isbn.length === 10) {
    for (let i = 0; i < 10; i++) sum += (isbn[i] === 'X' ? 10 : Number(isbn[i])) * (10 - i);
    return sum % 11 === 0;
  }
  for (let i = 0; i < 13; i++) sum += Number(isbn[i]) * (i % 2 ? 3 : 1);
  return sum % 10 === 0;
}

function checkUrl(text) {
  let url;
  try {
    url = new URL(BARE_HOST.test(text) ? `https://${text}` : text);
  } catch {
    throw new InputError('That doesn’t look like a link, DOI, ISBN, PMID or arXiv ID.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new InputError('Only links starting with http:// or https:// can be added.');
  }
  if (url.username || url.password) {
    throw new InputError('Links that include a username or password can’t be added.');
  }
  // First-hop filter only: hostnames that resolve via DNS to private addresses (e.g. *.nip.io)
  // can't be caught here, because Functions can't resolve DNS.
  const host = url.hostname.toLowerCase().replace(/\.+$/, '');
  if (
    host === 'localhost' ||
    PRIVATE_SUFFIXES.some((suffix) => host.endsWith(suffix)) ||
    IPV4.test(host) ||
    host.startsWith('[') ||
    !host.includes('.')
  ) {
    throw new InputError('That link points to a local or private address, which can’t be looked up.');
  }
  url.hash = '';
  return url.href;
}
