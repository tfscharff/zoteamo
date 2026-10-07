# zoteamo

Collaborative reading lists for reading groups. Paste a URL, DOI or ISBN and get a proper
citation in APA, MLA or Chicago. Members share an edit link, and anyone can read and export the
list from a view link. No accounts.

Metadata comes from [Zotero translation-server](https://github.com/zotero/translation-server),
running on AWS Lambda's always-free tier. The site runs on Cloudflare Pages and D1's free tiers.
Hosting costs $0.

> **Status:** live at https://zoteamo.pages.dev. Design:
> [`docs/superpowers/specs/2026-10-06-zoteamo-design.md`](docs/superpowers/specs/2026-10-06-zoteamo-design.md).

## Features

- One input box for a URL, DOI, ISBN, PMID or arXiv ID.
- Citations in APA, MLA and Chicago. The group sets a default style and each viewer can switch.
- Copy one citation or the whole list. Export to BibTeX or RIS. Save to Zotero through the Zotero
  Connector, using COinS.
- Each item has an added-by name, a note, a status (suggested, up next or discussed), a meeting
  date and votes.
- Every citation field can be edited by hand when automatic metadata is wrong.
- Meets WCAG 2.2 AAA and works without JavaScript.

## Development

Requires Node 22 or later.

```bash
npm install
npm test            # node:test for tooling + Vitest (unit and Workers/D1 suites)
```

### Local development

```bash
cp .dev.vars.example .dev.vars   # optional: add Lambda credentials to test lookups locally
npx wrangler d1 migrations apply zoteamo --local
npm run dev                      # builds, then serves on http://localhost:8788
npm run validate                 # html-validate on the static pages
npm run a11y                     # html-validate + pa11y-ci (WCAG 2.2 AAA) + a real-browser form check
```

Without Lambda credentials, adding an item fails gracefully and opens the manual edit form.

### Deployment

- **Site:** Cloudflare Pages builds `main` automatically (`npm run build`, output `_site`). D1
  migrations: `npx wrangler d1 migrations apply zoteamo --remote`.
- **AWS:** a personal account, used through the CLI profile `zoteamo` (sign in with
  `aws login --profile zoteamo`). Prefix the commands below with `AWS_PROFILE=zoteamo`.
- **One-time:** `npm run deploy:bootstrap -- --email you@example.com` creates the deploy bucket and a
  $0.01 budget alert.
- **Lambda:** `npm run deploy:lambda -- --review` creates a change set to inspect, and
  `npm run deploy:lambda` deploys. translation-server is pinned in `infra/translation-server.ref`; to
  upgrade, change the SHA and redeploy. On new accounts (Lambda concurrency limit 10), reserved
  concurrency is left unset until AWS raises the limit.
- **Cloudflare Pages secrets:** `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` (IAM user
  `zoteamo-cloudflare`), `AWS_REGION`, and `TRANSLATION_URL` and `FORMAT_URL` (the stack's outputs).

### Live smoke test

After a deploy, on the live site: create a list, then add a DOI (`10.1038/nature14539`), a news
article URL, an ISBN (`9780262033848`) and a blog post URL. Check each in APA, MLA and Chicago,
download the .bib, .ris and .txt exports, and open the view link to confirm it's read-only.

### Releasing

Every commit to `main` is a [SemVer](https://semver.org/) release with a GitHub release:

```bash
npm run ship -- "feat(items): add voting" [--body "details"] [--dry-run] [--as X.Y.Z]
```

The header must be a [Conventional Commit](https://www.conventionalcommits.org/). `feat` bumps the
minor version, everything else bumps the patch version, and a breaking change (`!`) bumps the major
version (the minor version before 1.0.0). The script runs the tests, bumps `package.json`, updates
`CHANGELOG.md`, commits, tags, pushes and publishes the release.

## License

[GNU AGPL-3.0-or-later](LICENSE). zoteamo depends on translation-server (AGPL-3.0) and citeproc-js
(CPAL-1.0 or AGPL), and AGPL keeps it compatible with both. If you run a modified copy as a public
service, you must offer its source to its users.

CSL citation styles are © their authors, licensed CC BY-SA 3.0. "Zotero" is a trademark of the
Corporation for Digital Scholarship. zoteamo is not affiliated with Zotero.
