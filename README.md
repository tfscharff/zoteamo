# zoteamo

Collaborative reading lists for reading groups. Paste a URL, DOI or ISBN and get a proper
citation in APA, MLA or Chicago. Members share an edit link, and anyone can read and export the
list from a view link. No accounts.

Metadata comes from [Zotero translation-server](https://github.com/zotero/translation-server),
running on AWS Lambda's always-free tier. The site runs on Cloudflare Pages and D1's free tiers.
Hosting costs $0.

> **Status:** design approved, implementation not started. See
> [`docs/superpowers/specs/2026-10-06-zoteamo-design.md`](docs/superpowers/specs/2026-10-06-zoteamo-design.md).

## Features (planned)

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
npm test            # unit tests (release script for now; app tests to come)
```

Setup for the dev server, D1 and Lambda deployment will be added here as they're built.

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
