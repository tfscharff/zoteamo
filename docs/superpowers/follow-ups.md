# Follow-ups after 1.0.0

These are minor findings that task reviews and the final whole-branch review deferred. None blocked
the launch. They're grouped by area, with the most useful first.

## Needs a person
- A visual pass: 320 px width, dark mode, keyboard focus visibility and 400% zoom.
- A screen-reader pass, and a no-JavaScript walkthrough of create → add → vote → delete.
- Ask AWS to raise the Lambda concurrency limit from 10 (Service Quotas → AWS Lambda → Concurrent
  executions). Then redeploy, so `deploy:lambda` sets reserved concurrency 2 per function, as the spec intends.

## Product
- Replacing the edit link has no confirmation step, so one click hands the group a new link.
- After a 422 or 429 on add or settings, the page is re-rendered without a redirect, so a refresh
  resubmits the form.
- "Saved changes" shows even when re-deriving the citation failed. The item itself shows the error and
  a Retry button.
- A choice page abandoned without cancelling leaves a pending item.
- Submitting an empty name doesn't clear the `zoteamo_name` cookie.
- The rate limit's check-then-insert isn't atomic, so two concurrent adds can slightly exceed 30 an
  hour.
- On the edit form, fields that don't apply to the chosen item type are dropped. The form says so in
  general but doesn't name the dropped values.
- Corrupt `zotero_json` is replaced with `{}` on retry.

## Input detection
- DOIs keep any `?query` from doi.org links, and any trailing punctuation pasted from prose.
- Bare numbers such as years are read as PMIDs.
- Old-style arXiv matching accepts any `word/1234567`.

## Robustness
- A corrupt `lookup_cache` row raises a raw `SyntaxError`, which shows as a 500.
- `lookupChoice` reports translation-server 5xx errors as "expired".
- Bad CSL field types return 500 from zoteamo-format, where 400 would be more accurate.
- The sanitizer:
  - `TITLE_ATTR` also matches `data-title`.
  - Lone surrogates aren't rejected.
  - An unclosed `<script>` drops the rest of the citation.
  - `class` values aren't restricted.

## Tests
- Add the final reviewer's XSS probes as regression tests for `sanitize.js`.
- Add `constructor` and `__proto__` cases to the export-route tests. Add CR, LF and quote cases for
  `exportFilename`.
- Assert that the translation-server exports run one at a time, not just in order.
- Guardrail tests (`tests/infra.test.mjs`):
  - pair each function with its log group
  - ban `Resource: '*'`
  - tie `NODE_OPTIONS` to the translation function

## Tooling
- `scripts/a11y.mjs` has no SIGINT handler.
- The bootstrap bucket has no `aws:SecureTransport` deny and no `DeletionPolicy`.
- Pages builds Functions with wrangler 3.x (`tests/pages-bundle.test.mjs` guards import attributes).
  Watch for other syntax that version's bundler rejects.
- Your `.claude/settings.json` "ask" list doesn't cover `npx wrangler d1 create`,
  `npx wrangler d1 migrations apply --remote` or `npx wrangler pages secret`.
