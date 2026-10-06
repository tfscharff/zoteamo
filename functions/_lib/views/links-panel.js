// The edit page's "Links and settings" panel. It opens by itself right after creating a list or replacing its edit link.
import { html } from '../html.js';
import { attr } from './forms.js';

export function linksPanel({ list, token, origin, params }) {
  const created = params.get('created') === '1';
  const rotated = params.get('rotated') === '1';
  return html`<details class="links-panel"${attr('open', created || rotated)}>
<summary>Links and settings</summary>
${created ? html`<p class="notice" role="status">Your reading list is ready. Save the edit link somewhere safe, because it’s the only way back in.</p>` : ''}
${rotated ? html`<p class="notice" role="status">Here’s the new edit link. The old one no longer works, so share this one with your group.</p>` : ''}
<h2>Links to this list</h2>
<p><strong>Anyone with the edit link can change this list. Keep it within the group.</strong></p>
<div class="field"><label for="edit-link">Edit link (for members)</label><input id="edit-link" value="${origin}/e/${token}" type="text" readonly data-copy></div>
<div class="field"><label for="view-link">View link (read-only, for sharing)</label><input id="view-link" value="${origin}/l/${list.view_token}" type="text" readonly data-copy></div>
</details>`;
}
