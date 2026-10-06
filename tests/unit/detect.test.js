import { describe, expect, it } from 'vitest';
import { cacheKey, detect, InputError } from '../../functions/_lib/detect.js';

describe('detect', () => {
  it.each([
    ['10.1038/nature14539', 'doi', '10.1038/nature14539'],
    ['  doi:10.1038/nature14539  ', 'doi', '10.1038/nature14539'],
    ['https://doi.org/10.1038/nature14539', 'doi', '10.1038/nature14539'],
    ['http://dx.doi.org/10.1000/xyz(1)', 'doi', '10.1000/xyz(1)'],
    ['9780262033848', 'isbn', '9780262033848'],
    ['ISBN 978-0-262-03384-8', 'isbn', '9780262033848'],
    ['isbn-10: 0-262-03384-4', 'isbn', '0262033844'],
    ['080442957x', 'isbn', '080442957X'],
    ['arXiv:2101.00001', 'arxiv', '2101.00001'],
    ['2101.00001v2', 'arxiv', '2101.00001v2'],
    ['hep-th/9901001', 'arxiv', 'hep-th/9901001'],
    ['math.GT/0309136', 'arxiv', 'math.GT/0309136'],
    ['PMID: 31452104', 'pmid', '31452104'],
    ['31452104', 'pmid', '31452104'],
    ['https://example.com/a?b=1#frag', 'url', 'https://example.com/a?b=1'],
    ['example.com/article', 'url', 'https://example.com/article'],
    ['http://news.example.org:8080/story', 'url', 'http://news.example.org:8080/story'],
  ])('reads %j as %s', (input, kind, value) => {
    expect(detect(input)).toEqual({ kind, value });
  });

  it.each([
    ['', /Enter a link/],
    ['   ', /Enter a link/],
    ['9780262033847', /check digit/],
    ['not a thing', /doesn’t look like/],
    ['ftp://example.com/file', /http:\/\/ or https:\/\//],
    ['javascript:alert(1)', /http:\/\/ or https:\/\//],
    ['http://user:pw@example.com/', /username or password/],
    ['http://localhost:8080/', /local or private/],
    ['http://127.0.0.1/', /local or private/],
    ['http://2130706433/', /local or private/],
    ['http://[::1]/', /local or private/],
    ['http://169.254.169.254/latest', /local or private/],
    ['http://intranet/', /local or private/],
    ['http://printer.local/', /local or private/],
    ['http://app.localhost/', /local or private/],
    ['http://localhost./', /local or private/],
    ['http://intranet./', /local or private/],
    ['http://printer.local./', /local or private/],
    ['http://foo.localhost./', /local or private/],
    ['http://metadata.google.internal./', /local or private/],
    ['https://foo.home.arpa./', /local or private/],
  ])('rejects %j', (input, message) => {
    expect(() => detect(input)).toThrow(InputError);
    expect(() => detect(input)).toThrow(message);
  });

  it('builds cache keys, lower-casing DOIs only', () => {
    expect(cacheKey({ kind: 'doi', value: '10.1038/NATURE14539' })).toBe('doi:10.1038/nature14539');
    expect(cacheKey({ kind: 'url', value: 'https://example.com/A' })).toBe('url:https://example.com/A');
  });
});
