import { describe, expect, it } from 'vitest';
import { createLambdaClient, LambdaError } from '../../functions/_lib/lambda.js';

const env = {
  AWS_ACCESS_KEY_ID: 'AKIDTEST', AWS_SECRET_ACCESS_KEY: 'secret', AWS_REGION: 'us-east-1',
  TRANSLATION_URL: 'https://translation.test/', FORMAT_URL: 'https://format.test/',
};

const SIGV4 = /^AWS4-HMAC-SHA256 Credential=AKIDTEST\/\d{8}\/us-east-1\/lambda\/aws4_request, SignedHeaders=[a-z0-9;-]*host[a-z0-9;-]*, Signature=[0-9a-f]{64}$/;

function recorder(responses) {
  const seen = [];
  const fetchImpl = async (request, init) => {
    seen.push({ request, init, body: await request.clone().text() });
    const next = responses.shift();
    if (next instanceof Error) throw next;
    return next;
  };
  return { seen, fetchImpl };
}

describe('createLambdaClient', () => {
  it('signs requests with SigV4 for Lambda in us-east-1', async () => {
    const { seen, fetchImpl } = recorder([new Response('[]')]);
    const res = await createLambdaClient(env, { fetchImpl }).translation('/web', 'https://example.com/a');
    expect(res.status).toBe(200);
    const { request, body, init } = seen[0];
    expect(request.method).toBe('POST');
    expect(request.url).toBe('https://translation.test/web');
    expect(request.headers.get('content-type')).toBe('text/plain');
    expect(request.headers.get('x-amz-date')).toMatch(/^\d{8}T\d{6}Z$/);
    expect(request.headers.get('authorization')).toMatch(
      /^AWS4-HMAC-SHA256 Credential=AKIDTEST\/\d{8}\/us-east-1\/lambda\/aws4_request, SignedHeaders=[a-z0-9;-]*host[a-z0-9;-]*, Signature=[0-9a-f]{64}$/,
    );
    expect(body).toBe('https://example.com/a');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('exports items as JSON and returns the text', async () => {
    const { seen, fetchImpl } = recorder([new Response('@book{x}')]);
    const text = await createLambdaClient(env, { fetchImpl }).exportAs('bibtex', [{ itemType: 'book' }]);
    expect(text).toBe('@book{x}');
    expect(seen[0].request.url).toBe('https://translation.test/export?format=bibtex');
    expect(seen[0].request.headers.get('content-type')).toBe('application/json');
    expect(JSON.parse(seen[0].body)).toEqual([{ itemType: 'book' }]);
  });

  it('sends CSL-JSON to the formatter and returns its results', async () => {
    const results = [{ apa: { html: 'a', text: 'a' }, mla: { html: 'm', text: 'm' }, chicago: { html: 'c', text: 'c' } }];
    const { seen, fetchImpl } = recorder([Response.json({ results })]);
    expect(await createLambdaClient(env, { fetchImpl }).format([{ id: 'x' }])).toEqual(results);
    expect(seen[0].request.url).toBe('https://format.test/');
    expect(JSON.parse(seen[0].body)).toEqual({ items: [{ id: 'x' }] });
  });

  it('rejects an unexpected formatter response', async () => {
    const { fetchImpl } = recorder([Response.json({ nope: true })]);
    await expect(createLambdaClient(env, { fetchImpl }).format([])).rejects.toThrow(LambdaError);
  });

  it('retries when Lambda throttles, then succeeds', async () => {
    const { seen, fetchImpl } = recorder([new Response('slow down', { status: 429 }), new Response('ok')]);
    const text = await createLambdaClient(env, { fetchImpl, retryDelayMs: 1 }).exportAs('ris', []);
    expect(text).toBe('ok');
    expect(seen).toHaveLength(2);
    expect(seen[1].body).toBe(seen[0].body);
    expect(seen[1].request.headers.get('authorization')).toMatch(SIGV4);
  });

  it('turns a body read failure into a LambdaError', async () => {
    const body = new ReadableStream({ start(c) { c.error(new TypeError('reset')); } });
    const { fetchImpl } = recorder([new Response(body)]);
    await expect(createLambdaClient(env, { fetchImpl }).exportAs('ris', [])).rejects.toThrow(LambdaError);
  });

  it('gives up after the last throttled attempt', async () => {
    const throttled = () => new Response('slow down', { status: 429 });
    const { seen, fetchImpl } = recorder([throttled(), throttled(), throttled()]);
    await expect(createLambdaClient(env, { fetchImpl, retryDelayMs: 1 }).exportAs('ris', [])).rejects.toThrow(/429/);
    expect(seen).toHaveLength(3);
  });

  it('turns network failures and timeouts into LambdaErrors', async () => {
    const down = recorder([new TypeError('network down')]);
    await expect(createLambdaClient(env, { fetchImpl: down.fetchImpl }).translation('/web', 'x')).rejects.toThrow(/couldn’t be reached/);
    const slow = recorder([new DOMException('timed out', 'TimeoutError')]);
    await expect(createLambdaClient(env, { fetchImpl: slow.fetchImpl }).translation('/web', 'x')).rejects.toThrow(/took too long/);
  });

  it('explains when Lambda isn’t configured', async () => {
    await expect(createLambdaClient({}).translation('/web', 'x')).rejects.toThrow(/isn’t set up/);
  });
});
