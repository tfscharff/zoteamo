// One-line messages shown after a redirect, chosen from fixed query flags (never free text from the URL).
const ERRORS = {
  choice_expired: 'That choice expired before it could be saved. Paste a more specific link, or the item’s DOI if it has one.',
};

const titleOf = (item) => item.title || item.input || 'Untitled item';

export function statusMessage(params, items = []) {
  const find = (key) => items.find((item) => item.id === params.get(key));
  const added = params.has('added') && find('added');
  if (added) {
    return added.citation_state === 'ready'
      ? `Added: ${titleOf(added)}`
      : `Added: ${titleOf(added)}. The citation isn’t ready yet, so use Retry on the item.`;
  }
  const updated = params.has('updated') && find('updated');
  if (updated) return `Saved changes to ${titleOf(updated)}.`;
  if (params.get('deleted') === '1') return 'Item deleted.';
  if (params.get('saved') === 'settings') return 'List settings saved.';
  return null;
}

export function errorMessage(params) {
  return ERRORS[params.get('error')] ?? null;
}
