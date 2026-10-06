// @vitest-environment happy-dom
// @vitest-environment-options {"url":"https://zoteamo.test/e/abc"}
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

async function load(body) {
  document.body.innerHTML = body;
  vi.resetModules();
  await import('../../src/assets/enhance.js');
}
const flush = () => new Promise((resolve) => setTimeout(resolve, 80));
const status = () => document.querySelector('[role="status"]').textContent;

beforeEach(() => {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn(async () => {}) }, configurable: true });
});
afterEach(() => vi.restoreAllMocks());

it('adds copy buttons named after what they copy', async () => {
  await load(`<div class="field"><label for="edit-link">Edit link (for members)</label><input id="edit-link" value="https://z.test/e/abc" readonly data-copy></div>
<article><h3 class="item-title">A Book</h3><p class="citation" data-copy-text="Doe, J. (2020). A Book.">Doe</p><div class="item-actions"></div></article>`);
  const buttons = [...document.querySelectorAll('button.copy-button')];
  expect(buttons.map((b) => b.textContent)).toEqual(['Copy edit link (for members)', 'Copy citation for A Book']);
  buttons[1].click();
  await flush();
  expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Doe, J. (2020). A Book.');
  expect(status()).toBe('Copied.');
});

it('copies the whole bibliography from the plain-text export', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('A.\n\nB.\n'));
  await load('<ul><li><a href="/l/v/export.txt?style=apa" data-copy-all>Plain text</a></li></ul>');
  document.querySelector('button.copy-button').click();
  await flush();
  expect(navigator.clipboard.writeText).toHaveBeenCalledWith('A.\n\nB.\n');
});

it('shows lookup progress and blocks a second submit', async () => {
  await load('<form data-busy-label="Looking it up…"><button type="submit">Add to list</button></form>');
  const form = document.querySelector('form');
  const first = new Event('submit', { cancelable: true });
  form.dispatchEvent(first);
  expect(first.defaultPrevented).toBe(false);
  expect(form.querySelector('button').textContent).toBe('Looking it up…');
  expect(form.querySelector('button').getAttribute('aria-disabled')).toBe('true');
  const second = new Event('submit', { cancelable: true });
  form.dispatchEvent(second);
  expect(second.defaultPrevented).toBe(true);
});

it('switches citation style without a reload and keeps focus on the picker', async () => {
  const region = (style, text) => `<div id="items"><form class="style-switch" method="get"><select id="style" name="style"><option value="apa">APA</option><option value="mla"${style === 'mla' ? ' selected' : ''}>MLA</option></select><button type="submit">Show citations</button></form><article><h3 class="item-title">T</h3><p class="citation" data-copy-text="${text}">${text}</p></article></div>`;
  await load(region('apa', 'APA text'));
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(`<!DOCTYPE html><html><body>${region('mla', 'MLA text')}</body></html>`));
  document.querySelector('#style').value = 'mla';
  document.querySelector('form.style-switch').dispatchEvent(new Event('submit', { cancelable: true }));
  await flush();
  expect(String(fetchSpy.mock.calls[0][0])).toBe('https://zoteamo.test/e/abc?style=mla');
  expect(document.querySelector('#items .citation').textContent).toBe('MLA text');
  expect(document.querySelectorAll('#items button.copy-button')).toHaveLength(1);
  expect(document.activeElement.id).toBe('style');
  expect(status()).toBe('Showing MLA citations.');
});

it('moves focus to an error summary', async () => {
  await load('<div class="error-summary" tabindex="-1" role="alert"><h2>There’s a problem</h2></div>');
  expect(document.activeElement.className).toBe('error-summary');
});

const switchRegion = '<div id="items"><form class="style-switch" method="get"><select id="style" name="style"><option value="apa">APA</option><option value="mla">MLA</option></select><button type="submit">Show citations</button></form><p class="citation" data-copy-text="APA text">APA text</p></div>';

it('falls back to a normal form submit when the style fetch is not OK', async () => {
  await load(switchRegion);
  const submit = vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => {});
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('nope', { status: 500 }));
  const before = document.getElementById('items');
  document.querySelector('form.style-switch').dispatchEvent(new Event('submit', { cancelable: true }));
  await flush();
  expect(submit).toHaveBeenCalledTimes(1);
  expect(document.getElementById('items')).toBe(before);
});

it('falls back to a normal form submit when the response has no #items', async () => {
  await load(switchRegion);
  const submit = vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => {});
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('<!DOCTYPE html><html><body><p>Hi</p></body></html>'));
  const before = document.getElementById('items');
  document.querySelector('form.style-switch').dispatchEvent(new Event('submit', { cancelable: true }));
  await flush();
  expect(submit).toHaveBeenCalledTimes(1);
  expect(document.getElementById('items')).toBe(before);
});

it('announces when the clipboard refuses', async () => {
  navigator.clipboard.writeText.mockRejectedValue(new Error('denied'));
  await load('<div class="field"><label for="l">Link</label><input id="l" value="x" data-copy></div>');
  document.querySelector('button.copy-button').click();
  await flush();
  expect(status()).toBe('Couldn’t copy automatically. Select the text and copy it instead.');
});

it('restores the busy button when the page is shown again', async () => {
  await load('<form data-busy-label="Looking it up…"><button type="submit">Add to list</button></form>');
  const form = document.querySelector('form');
  form.dispatchEvent(new Event('submit', { cancelable: true }));
  window.dispatchEvent(new Event('pageshow'));
  const button = form.querySelector('button');
  expect(button.textContent).toBe('Add to list');
  expect(button.hasAttribute('aria-disabled')).toBe(false);
  expect(form.dataset.busy).toBeUndefined();
});
