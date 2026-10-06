import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { handler } from '../../infra/format/index.mjs';

const fixture = (name) => JSON.parse(readFileSync(`tests/fixtures/csl/${name}.json`, 'utf8'));
const invoke = async (body, base64 = false) => {
  const raw = typeof body === 'string' ? body : JSON.stringify(body);
  const res = await handler({ body: base64 ? Buffer.from(raw).toString('base64') : raw, isBase64Encoded: base64 });
  return { ...res, json: JSON.parse(res.body) };
};

describe('zoteamo-format', () => {
  it('formats a book in all three styles', async () => {
    const { statusCode, json } = await invoke({ items: [fixture('book')] });
    expect(statusCode).toBe(200);
    const [{ apa, mla, chicago }] = json.results;
    expect(apa.html).toContain('Doe, J. (2020).');
    expect(apa.html).toContain('<i>The Reading Group</i>');
    expect(apa.text).toContain('Doe, J. (2020). The Reading Group. Example Press.');
    expect(mla.html).toContain('Doe, Jane.');
    expect(mla.text).toContain('Example Press, 2020.');
    expect(chicago.html).toContain('Doe, Jane.');
    expect(chicago.text).toContain('Example Press, 2020.');
  });

  it('formats a journal article', async () => {
    const [{ apa, mla, chicago }] = (await invoke({ items: [fixture('article')] })).json.results;
    expect(apa.html).toContain('Smith, A. (2019).');
    expect(apa.html).toContain('<i>Journal of Groups</i>');
    expect(apa.text).toContain('https://doi.org/10.1234/jog.2019.3');
    expect(mla.text).toContain('“Reading Together.”');
    expect(mla.text).toContain('vol. 12, no. 3');
    expect(chicago.text).toContain('“Reading Together.”');
    expect(chicago.text).toContain('12, no. 3 (2019)');
  });

  it('formats a web page by an organization', async () => {
    const [{ apa, mla, chicago }] = (await invoke({ items: [fixture('webpage')] })).json.results;
    expect(apa.text).toContain('Example Society. (2021, May 4).');
    for (const style of [apa, mla, chicago]) expect(style.text).toContain('example.org/notes');
  });

  it('returns plain text without markup and keeps input order', async () => {
    const { json } = await invoke({ items: [fixture('book'), fixture('article')] });
    expect(json.results).toHaveLength(2);
    expect(json.results[1].apa.text).toContain('Smith');
    for (const result of json.results) for (const style of Object.values(result)) expect(style.text).not.toMatch(/[<>]/);
  });

  it('gives each item its own citation when engines are reused across calls', async () => {
    const book = fixture('book');
    const article = fixture('article');
    const check = (result, surname, title) => {
      for (const style of Object.values(result)) {
        expect(style.text).toContain(surname);
        expect(style.text).toContain(title);
      }
    };
    check((await invoke({ items: [book] })).json.results[0], 'Doe', 'The Reading Group');
    check((await invoke({ items: [article] })).json.results[0], 'Smith', 'Reading Together');
    check((await invoke({ items: [book] })).json.results[0], 'Doe', 'The Reading Group');
  });

  it('keeps results in order within one request', async () => {
    const { json } = await invoke({ items: [fixture('book'), fixture('article')] });
    expect(json.results[0].apa.text).toContain('Doe');
    expect(json.results[1].apa.text).toContain('Smith');
  });

  it('formats a good item correctly after a malformed one', async () => {
    const bad = await invoke({ items: [{ type: 'book', title: 123, author: 'x' }] });
    const { statusCode, json } = await invoke({ items: [fixture('book')] });
    expect(statusCode).toBe(200);
    expect(json.results[0].apa.text).toContain('Doe, J. (2020). The Reading Group. Example Press.');
    expect(json.results[0].mla.text).toContain('Doe, Jane.');
  });

  it('accepts base64 bodies from the Function URL', async () => {
    expect((await invoke({ items: [fixture('book')] }, true)).statusCode).toBe(200);
  });

  it.each([
    ['invalid JSON', 'not json'],
    ['missing items', {}],
    ['items not an array', { items: 'x' }],
    ['non-object items', { items: [1] }],
    ['too many items', { items: Array.from({ length: 51 }, () => ({ type: 'book', title: 'x' })) }],
  ])('rejects %s with 400', async (_name, body) => {
    expect((await invoke(body)).statusCode).toBe(400);
  });
});
