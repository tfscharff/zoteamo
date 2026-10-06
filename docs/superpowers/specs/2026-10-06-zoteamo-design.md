# zoteamo: design

Date: 2026-10-06. Status: approved by the user (brainstorming session). Next step: implementation plan.

## 1. Purpose

A reading group keeps one collaborative reading list. Members paste a URL, DOI or ISBN and get a
proper citation back. Anyone with the share link can read the list and export it.

**Success looks like:** a member pastes a link, and a few seconds later the list shows a correct APA,
MLA or Chicago citation. The group can see what's suggested, what's up next and what's been
discussed, and can vote on what to read. Running it costs **$0 a month**.

### Decisions already made (do not reopen)

| Topic | Decision |
|---|---|
| Users | A small reading group (assume ≤ 20 people, ≤ a few hundred items per list). |
| Access | **Secret links, no accounts.** Each list has an edit link (members) and a read-only view link (sharing). |
| Per-item fields | **All four:** added-by name, short note, status/schedule (suggested, up next, discussed, plus a meeting date), votes. |
| Citation output | **Group default style + viewer can switch + exports.** Styles: **APA, MLA, Chicago**. Exports: BibTeX, RIS, "save to Zotero". |
| Bad metadata | **Both:** add by DOI/ISBN (and PMID/arXiv) as well as URL, **and** every citation field is editable by hand. |
| Metadata engine | [zotero/translation-server](https://github.com/zotero/translation-server) on **AWS Lambda** (option 1). No metadata-tag fallback. |
| Cost | **Must stay $0.** AWS is allowed only inside the always-free tier. |
| License | **AGPL-3.0-or-later.** translation-server is AGPL-3.0 and citeproc-js is CPAL/AGPL, so AGPL keeps everything compatible. The site footer links to the source repo, which meets AGPL §13 for network users. |

## 2. Architecture

```
Browser ──▶ Cloudflare Pages: 11ty static pages + Pages Functions (SSR) ──▶ D1 (lists, items, votes, cache)
                         │
                         └── SigV4-signed fetch (aws4fetch) ──┬─▶ Lambda Function URL: translation-server (upstream, unmodified)
                                                              └─▶ Lambda Function URL: zoteamo-format (citeproc-js, ours)
```

### Why it's shaped this way

- **The Workers free plan has a 10 ms CPU limit per request.** citeproc-js can't reliably run in
  that time, so **citations are formatted once, on write, by a Lambda**, and stored in D1. Page
  views only read stored strings. Writes (add or edit) are rare. Reads are frequent and have to be
  cheap.
- **Function URLs, not API Gateway.** The upstream `lambda_template.yaml.j2` uses an API Gateway
  REST API, and API Gateway's free tier runs out 12 months after an account opens (this account
  dates from 2020). Lambda Function URLs cost nothing beyond Lambda. Upstream `src/lambda.js` wraps
  Koa in `serverless-http`, which accepts Function URL (payload v2) events.
- **IAM auth on the Function URLs.** Only the Cloudflare Functions, which hold keys for an IAM user
  limited to `lambda:InvokeFunctionUrl`, can call them. That blocks strangers from running up the
  free tier.

### Components

1. **Static site (11ty + Nunjucks), `src/`.** Home page with "Create a reading list", an About page
   with a link to the source (AGPL), and shared CSS and JS. JavaScript only enhances pages (copy
   buttons, remembering your name, style switcher without a reload). **Every feature works without
   JavaScript**, using forms and 303 redirects.
2. **Pages Functions, `functions/`.** They server-render the list pages and handle every form POST
   and export. They keep shared code in small modules under `functions/_lib/` with one purpose
   each:
   - `db.js`: D1 queries
   - `tokens.js`: token creation and hashing
   - `lambda.js`: signed calls to the two Function URLs
   - `enrich.js`: the add/edit pipeline in §4
   - `render.js`: HTML templates with escaping
   - `sanitize.js`: allow-list for citation HTML
   - `detect.js`: works out whether input is a URL, DOI, ISBN, PMID or arXiv ID
3. **D1 database `zoteamo`** (binding `DB`). Schema in §3. Migrations live in `migrations/`.
4. **AWS stack `zoteamo`.** A SAM template in `infra/template.yaml`, deployed with the AWS CLI.
   The SAM CLI is not installed and isn't needed.
   - **`zoteamo-translation`:** upstream translation-server pinned to a commit SHA in
     `infra/translation-server.ref`. Not vendored; the deploy script clones it into the gitignored
     `infra/.build/`. Runtime `nodejs24.x` as upstream uses, 2048 MB, 30 s timeout,
     `NODE_OPTIONS=--experimental-require-module` as upstream needs. Function URL with `AWS_IAM`.
   - **`zoteamo-format`:** our own small Node function in `infra/format/`. It takes CSL-JSON items
     and returns, for each item, APA, MLA and Chicago bibliography entries as HTML and plain text.
     It bundles citeproc-js, the three CSL style files and `locales-en-US.xml`. 512 MB, 10 s
     timeout. Function URL with `AWS_IAM`.
   - Both functions: **reserved concurrency 2** (the account limit is 1000, so this is allowed),
     log retention 7 days.
   - IAM user `zoteamo-cloudflare` whose only permission is `lambda:InvokeFunctionUrl` on those two
     functions.
   - **A deploy bucket we create ourselves**, not SAM's managed bucket, because SAM's is versioned
     and keeps old packages forever. Not versioned, with a lifecycle rule that deletes objects after
     1 day. `aws cloudformation package --s3-bucket` uploads to it. Lambda copies the code when it deploys, so the
     artifact doesn't need to stay.
   - AWS Budget: $0.01 monthly cost budget that emails the user. The first two budgets are free.

### CSL styles

- APA: `apa.csl` (7th ed.)
- MLA: `modern-language-association.csl` (9th ed.)
- Chicago: the notes-bibliography style's **bibliography** entries, because a reading list is a
  bibliography. Check the current filename in
  https://github.com/citation-style-language/styles; it's `chicago-notes-bibliography.csl` or
  `chicago-note-bibliography.csl` depending on edition.
- The styles are CC BY-SA 3.0. Credit them on the About page.

## 3. Data model (D1 / SQLite)

```sql
CREATE TABLE lists (
  id              TEXT PRIMARY KEY,               -- random id, never shown
  title           TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  default_style   TEXT NOT NULL DEFAULT 'apa' CHECK (default_style IN ('apa','mla','chicago')),
  view_token      TEXT NOT NULL UNIQUE,           -- 128-bit random, base64url
  edit_token_hash TEXT NOT NULL UNIQUE,           -- SHA-256 of the edit token, hex
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE TABLE items (
  id              TEXT PRIMARY KEY,
  list_id         TEXT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  input           TEXT NOT NULL,                  -- what the member pasted
  input_kind      TEXT NOT NULL CHECK (input_kind IN ('url','doi','isbn','pmid','arxiv','manual')),
  zotero_json     TEXT,                           -- source of truth for citation data (Zotero item JSON)
  csl_json        TEXT,                           -- derived
  cite_apa        TEXT, cite_mla TEXT, cite_chicago TEXT,   -- derived, sanitized HTML
  text_apa        TEXT, text_mla TEXT, text_chicago TEXT,   -- derived, plain text (copy, .txt export)
  bibtex          TEXT, ris TEXT, coins TEXT,     -- derived, from translation-server /export
  citation_state  TEXT NOT NULL CHECK (citation_state IN ('pending','ready','failed')),
  citation_error  TEXT,
  added_by        TEXT NOT NULL DEFAULT '',
  note            TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested','up_next','discussed')),
  meeting_date    TEXT,                           -- ISO date, optional
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
CREATE INDEX items_list ON items(list_id);

CREATE TABLE votes (
  item_id    TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  voter_id   TEXT NOT NULL,                       -- random id from the zoteamo_voter cookie
  created_at TEXT NOT NULL,
  PRIMARY KEY (item_id, voter_id)
);

CREATE TABLE lookup_cache (                       -- avoids repeat translation-server calls
  key         TEXT PRIMARY KEY,                   -- normalized URL or identifier
  zotero_json TEXT NOT NULL,
  fetched_at  TEXT NOT NULL                       -- entries older than 30 days are treated as missing
);
```

`zotero_json` is the source of truth. Everything marked "derived" is recalculated whenever it
changes.

## 4. Flows

### Create a list

- The home page form (title, optional description, default style) posts to `POST /api/lists`.
- That creates the view token and edit token (`crypto.getRandomValues`, 16 bytes, base64url) and
  stores the edit token **hashed**.
- It responds with a 303 redirect to `/e/{editToken}?created=1`. That page shows both links with
  copy buttons and a warning: "Anyone with the edit link can change this list. Keep it within the
  group."

### Pages

- `GET /l/{viewToken}`: read-only list.
- `GET /e/{editToken}`: the same list plus the editing controls.
- `?style=apa|mla|chicago` overrides the group default for the current viewer, and is remembered in
  the `zoteamo_style` cookie.
- **Order:** "Up next" first (by meeting date, then votes), then "Suggested" (most votes first,
  then newest), then "Discussed" (most recent meeting first).
- Each item shows:
  - its citation in the selected style
  - status, meeting date, note, added-by, vote count
  - for edit links: vote toggle, change status or date, edit, delete
- Each item includes its stored COinS span, so the Zotero Connector shows "save to Zotero" and can
  save one item or many from the page.

### Add an item (the add/edit pipeline, `enrich.js`)

1. The form takes one input box (URL, DOI, ISBN, PMID or arXiv ID), "your name" (pre-filled from
   the `zoteamo_name` cookie) and an optional note. It posts to `POST /e/{t}/items`.
2. `detect.js` classifies the input. Only allow `http:` and `https:` URLs. Reject IP-literal hosts
   and `localhost`, so translation-server can't be pointed at internal addresses.
3. Check `lookup_cache` first. If there's no fresh entry, call translation-server: `POST /web` with
   the URL as text, or `POST /search` with the identifier.
   - **200:** use the first item. Cache it.
   - **300 (several possible items):** show a selection page and post the choice back. Selection
     depends on translation-server's in-memory session, which may land on a different Lambda
     instance and fail. If it fails, say so plainly and suggest pasting a more specific URL or a
     DOI.
   - **Error or timeout:** store the item with `citation_state='failed'`, the input and the error,
     then redirect to the manual edit form with a clear message.
4. Derive the formats. These run in parallel on the now-warm translation-server instance:
   - `POST /export?format=csljson`
   - `POST /export?format=bibtex`
   - `POST /export?format=ris`
   - `POST /export?format=coins`
   - Then call `zoteamo-format` with the CSL-JSON.
   - Sanitize the citation HTML, allowing only `i b em strong span sup sub`, and `span` only with a
     `class`.
   - Store everything and set `citation_state='ready'`.
5. Redirect back to the list with 303, and announce "Added: {title}" in a polite live region.

The cold-start budget is about 10 to 15 s for the first add after an idle period. Tell the user the
lookup takes a few seconds. With JS, show progress in the button. Without JS, the browser's own
loading indicator covers it.

### Edit citation by hand

- `GET /e/{t}/items/{id}/edit` shows a form built from `zotero_json`. Fields:
  - item type
  - title
  - creators: a repeatable first/last/role group
  - date, container or publication title, publisher, place
  - volume, issue, pages
  - URL, DOI, ISBN, accessed date
- On POST, write the edited `zotero_json`, then re-run step 4. If the formatter Lambda is down,
  still save the edit, and leave the derived fields `pending` with a "Retry" button
  (`POST /e/{t}/items/{id}/retry`).

### Other edit actions (all POST, then a 303 back to the list)

- `/e/{t}/items/{id}/vote` toggles the vote. The voter is identified by the `zoteamo_voter` cookie,
  which holds a random ID and is set on first visit.
- `/e/{t}/items/{id}/status`: status, meeting date, note.
- `/e/{t}/items/{id}/delete`: needs a confirmation step, either a page or a `<dialog>`.
- `/e/{t}/settings`: title, description, default style.
- `/e/{t}/rotate-edit-link`: issues a new edit token, invalidates the old one, and shows the new
  link.

### Exports (view or edit token)

- `/l/{t}/export.bib`: joins the stored `bibtex` values.
- `/l/{t}/export.ris`: joins the stored `ris` values.
- `/l/{t}/export.txt?style=`: plain-text bibliography from `text_<style>`.
- No Lambda calls at export time.

## 5. Security and privacy

- **The tokens are the secret.** Every HTML response sends:
  - `Referrer-Policy: no-referrer`, so tokens never leak to linked sites.
  - `X-Robots-Tag: noindex, nofollow`, plus `<meta name="robots" content="noindex">` on list pages.
  - A strict CSP: `default-src 'self'`; no inline script; no third-party origins.
- **Look up the edit token by its hash.** Hash with SHA-256, then use a constant-time compare.
- **Check Origin on POST.** Reject any POST whose `Origin` doesn't match the site's own origin.
- **Escape everything.** User text is always escaped. Citation HTML goes through the allow-list
  sanitizer only.
- **Rate limit:** at most 30 new items per list per hour, counted from `items.created_at`. Over the
  limit, show a friendly message. Retries and edits aren't counted; reserved concurrency limits
  their cost.
- **Lambda caps:** reserved concurrency 2 and a 30 s timeout limit the worst case. The IAM user can
  only invoke the two Function URLs.

## 6. Cost guardrails ($0)

| Service | Free allowance | Expected use |
|---|---|---|
| Cloudflare Pages + Functions | 100k requests/day, 10 ms CPU each | Tiny; no heavy CPU work in Functions |
| Cloudflare D1 | 5 GB storage, 5M reads/day, 100k writes/day | Tiny |
| AWS Lambda (always free) | 1M requests + 400k GB-s per month | About 5 calls per add; 2 GB × a few seconds each ⇒ thousands of adds a month fit |
| Lambda Function URLs | No extra charge | — |
| CloudWatch Logs (always free) | 5 GB ingestion | 7-day retention |
| S3 deploy bucket | **Not** free after the first 12 months, but objects are deleted after 1 day | Fractions of a cent, which rounds to $0 |
| AWS Budgets | First 2 budgets free | One $0.01 alert |

**Rule:** nothing that bills per hour (no NAT, no ALB, no always-on compute, no API Gateway, no ECR
private repos).

## 7. Accessibility (WCAG 2.2 AAA)

- Contrast at least 7:1 for text and 4.5:1 for large text. Visible focus at least 3:1, never hidden
  by sticky elements.
- Targets at least 44 × 44 px.
- Every input has a visible label. Errors are listed at the top of the form with links to each
  field, plus inline messages tied to the field with `aria-describedby`.
- Status messages use `role="status"`. No time limits. Respect `prefers-reduced-motion`. Use a
  self-hosted font or system fonts, with no third-party requests.
- One `h1` per page and a logical heading order, with each item as a heading-led `article`. The
  citation is the item's main text. Vote and status controls have names that include the item's
  title, for example "Vote for *Title*".
- Check with `html-validate` and `pa11y-ci` (standard `WCAG2AAA`, axe and htmlcs runners) against
  `wrangler pages dev`.

## 8. Testing

- **Unit tests (Vitest):**
  - `detect.js`
  - `tokens.js`
  - `sanitize.js`
  - the ordering logic
  - render escaping
  - export joining
  - the `zoteamo-format` handler, run against fixture CSL-JSON (for example a book, a journal
    article and a web page), checking the expected APA/MLA/Chicago output
- **Functions + D1 (`@cloudflare/vitest-pool-workers`):** create a list, add an item (Lambda
  client mocked), edit, vote, status, delete, rotate the edit link, exports, Origin rejection, rate
  limit.
- **Lambda client:** check the signing request shape against a stubbed `fetch`.
- **Live smoke test (manual, after deploy):** add a DOI, a news URL, an ISBN and a blog post, and
  check all three styles. This is listed in the README.
- **Release script:** `tests/release.test.mjs` (node:test) has to keep passing.

## 9. Deployment

- **Site:** a Cloudflare Pages project connected to GitHub `tfscharff/zoteamo`, branch `main`.
  - Build: `npm run build`. Output: `_site`.
  - D1 binding `DB`.
  - Secrets: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION=us-east-1`,
    `TRANSLATION_URL`, `FORMAT_URL`.
  - Use the `*.pages.dev` domain; no custom domain is needed.
- **Lambda:** `npm run deploy:lambda`. It:
  1. clones translation-server at the pinned SHA into `infra/.build/`
  2. runs `npm ci --omit=dev` there
  3. builds `infra/format/`
  4. runs `aws cloudformation package --s3-bucket zoteamo-deploy-145395257847`, then
     `aws cloudformation deploy --capabilities CAPABILITY_IAM`. The `AWS::Serverless` transform
     runs inside CloudFormation, so the SAM CLI isn't needed.
- **Steps the user does themselves** (credentials and account linking): connecting Cloudflare to
  GitHub, creating the IAM user's access key and pasting it into Cloudflare secrets, and confirming
  the budget email address.

## 10. Out of scope (YAGNI)

Accounts and logins, multiple lists per person or a dashboard, comments and threads, notifications,
full-text storage, PDF uploads, citation styles beyond the three, a metadata-tag fallback when
Lambda is down, a custom domain.
