// SigV4-signed calls to the two Lambda Function URLs: translation-server and zoteamo-format.
// Reserved concurrency is 2, so throttling (429) is expected under load and retried briefly.
import { AwsClient } from 'aws4fetch';

export class LambdaError extends Error {}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const TRANSLATION_TIMEOUT_MS = 35_000;
const FORMAT_TIMEOUT_MS = 25_000;

function lambdaFailure(error) {
  const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
  return new LambdaError(timedOut ? 'The lookup service took too long to answer.' : 'The lookup service couldn’t be reached.');
}

export function createLambdaClient(env, { fetchImpl = (request, init) => fetch(request, init), retryDelayMs = 500, attempts = 3 } = {}) {
  const configured = env.TRANSLATION_URL && env.FORMAT_URL && env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY;
  const aws = configured
    ? new AwsClient({
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
        region: env.AWS_REGION || 'us-east-1',
        service: 'lambda',
      })
    : null;

  async function send(base, path, body, contentType, timeoutMs) {
    if (!aws) throw new LambdaError('Citation lookup isn’t set up on this server.');
    const url = new URL(path, base).href;
    for (let attempt = 1; ; attempt++) {
      const request = await aws.sign(url, { method: 'POST', headers: { 'content-type': contentType }, body });
      let response;
      try {
        response = await fetchImpl(request, { signal: AbortSignal.timeout(timeoutMs) });
      } catch (error) {
        throw lambdaFailure(error);
      }
      if (response.status !== 429 || attempt >= attempts) return response;
      await response.body?.cancel();
      await sleep(retryDelayMs * attempt);
    }
  }

  return {
    translation: (path, body, contentType = 'text/plain') =>
      send(env.TRANSLATION_URL, path, body, contentType, TRANSLATION_TIMEOUT_MS),

    async exportAs(format, items) {
      const path = `/export?format=${encodeURIComponent(format)}`;
      const res = await send(env.TRANSLATION_URL, path, JSON.stringify(items), 'application/json', TRANSLATION_TIMEOUT_MS);
      if (!res.ok) throw new LambdaError(`Exporting ${format} failed (${res.status}).`);
      try {
        return await res.text();
      } catch (error) {
        throw lambdaFailure(error);
      }
    },

    async format(items) {
      const res = await send(env.FORMAT_URL, '/', JSON.stringify({ items }), 'application/json', FORMAT_TIMEOUT_MS);
      if (!res.ok) throw new LambdaError(`The citation formatter failed (${res.status}).`);
      const data = await res.json().catch(() => null);
      if (!Array.isArray(data?.results)) throw new LambdaError('The citation formatter sent back something unexpected.');
      return data.results;
    },
  };
}
