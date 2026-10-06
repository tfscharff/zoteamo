// Progressive enhancements. Each has a no-JavaScript equivalent:
//   copy buttons -> select and copy the text; style switch -> the Show button reloads the page;
//   lookup progress -> the browser's own loading indicator.
const FLAGS = ['created', 'rotated', 'added', 'updated', 'deleted', 'saved', 'error'];

const live = document.createElement('p');
live.className = 'visually-hidden';
live.setAttribute('role', 'status');
document.body.append(live);

function announce(message) {
  live.textContent = '';
  window.setTimeout(() => {
    live.textContent = message;
  }, 50);
}

function copyButton(name, getText) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'secondary copy-button';
  const hidden = document.createElement('span');
  hidden.className = 'visually-hidden';
  hidden.textContent = ` ${name}`;
  button.append('Copy', hidden);
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(await getText());
      announce('Copied.');
    } catch {
      announce('Couldn’t copy automatically. Select the text and copy it instead.');
    }
  });
  return button;
}

function enhanceCopy(root) {
  for (const input of root.querySelectorAll('input[data-copy]')) {
    const name = (input.labels?.[0]?.textContent ?? 'link').trim();
    input.after(copyButton(name.charAt(0).toLowerCase() + name.slice(1), () => input.value));
  }
  for (const citation of root.querySelectorAll('.citation[data-copy-text]')) {
    const article = citation.closest('article');
    const title = article?.querySelector('.item-title')?.textContent ?? '';
    const button = copyButton(`citation for ${title}`, () => citation.dataset.copyText);
    const actions = article?.querySelector('.item-actions');
    if (actions) actions.prepend(button);
    else citation.after(button);
  }
  const all = root.querySelector('a[data-copy-all]');
  if (all) {
    all.after(' ', copyButton('all citations', async () => (await fetch(all.href)).text()));
  }
}

function enhanceStyleSwitch(form) {
  if (!form) return;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const select = form.querySelector('select');
    const url = new URL(window.location.href);
    for (const flag of FLAGS) url.searchParams.delete(flag);
    url.searchParams.set('style', select.value);
    let fresh;
    try {
      const response = await fetch(url, { headers: { accept: 'text/html' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      fresh = new DOMParser().parseFromString(await response.text(), 'text/html').getElementById('items');
      if (!fresh) throw new Error('No #items in response');
    } catch {
      form.submit();
      return;
    }
    document.getElementById('items').replaceWith(fresh);
    window.history.replaceState(null, '', url);
    enhanceCopy(fresh);
    enhanceStyleSwitch(fresh.querySelector('form.style-switch'));
    fresh.querySelector('#style')?.focus();
    announce(`Showing ${select.options[select.selectedIndex].textContent} citations.`);
  });
}

function enhanceBusyForms() {
  for (const form of document.querySelectorAll('form[data-busy-label]')) {
    const button = form.querySelector('button[type="submit"]');
    const idle = button.textContent;
    form.addEventListener('submit', (event) => {
      if (form.dataset.busy) {
        event.preventDefault();
        return;
      }
      form.dataset.busy = 'true';
      button.setAttribute('aria-disabled', 'true');
      button.textContent = form.dataset.busyLabel;
      announce(form.dataset.busyLabel);
    });
    window.addEventListener('pageshow', () => {
      delete form.dataset.busy;
      button.removeAttribute('aria-disabled');
      button.textContent = idle;
    });
  }
}

enhanceCopy(document);
enhanceStyleSwitch(document.querySelector('form.style-switch'));
enhanceBusyForms();
document.querySelector('.error-summary')?.focus();
