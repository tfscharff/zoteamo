// Small HTTP helpers shared by every Pages Function.
const YEAR = 60 * 60 * 24 * 365;

function withCookies(headers, cookies) {
  for (const cookie of cookies) headers.append('set-cookie', cookie);
  return headers;
}

export function htmlResponse(body, { status = 200, cookies = [] } = {}) {
  const headers = withCookies(new Headers({ 'content-type': 'text/html; charset=utf-8' }), cookies);
  return new Response(String(body), { status, headers });
}

export function redirect(location, { cookies = [] } = {}) {
  return new Response(null, { status: 303, headers: withCookies(new Headers({ location }), cookies) });
}

export function parseCookies(request) {
  const out = {};
  for (const part of (request.headers.get('cookie') ?? '').split(';')) {
    const at = part.indexOf('=');
    if (at < 1) continue;
    try {
      out[part.slice(0, at).trim()] = decodeURIComponent(part.slice(at + 1).trim());
    } catch {
      // Ignore cookies that aren't valid percent-encoding.
    }
  }
  return out;
}

export function setCookie(name, value, { maxAge = YEAR } = {}) {
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax; Secure; HttpOnly`;
}

export async function readForm(request) {
  const data = await request.formData();
  const text = (value) => (typeof value === 'string' ? value.trim() : '');
  return {
    get: (name) => text(data.get(name)),
    getAll: (name) => data.getAll(name).map(text),
  };
}
