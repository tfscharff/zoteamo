# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**zoteamo** is a collaborative reading list for reading groups. Members paste a URL, DOI or ISBN
and get proper APA, MLA or Chicago citations, using
[Zotero translation-server](https://github.com/zotero/translation-server) for metadata. Repo:
https://github.com/tfscharff/zoteamo (public, AGPL-3.0-or-later).

**Status (2026-10-06):** design approved; no product code yet. The design is
`docs/superpowers/specs/2026-10-06-zoteamo-design.md`. **Read it in full before doing anything.**
The "Decisions already made" table in it is settled, so don't reopen those decisions.

## Your job, in order

1. Read the spec.
2. Use the **superpowers:writing-plans** skill to write the implementation plan to
   `docs/superpowers/plans/2026-10-06-zoteamo.md`. Ship it with
   `npm run ship -- "docs: add implementation plan"`.
3. Carry out the plan with **superpowers:subagent-driven-development**, or
   **superpowers:executing-plans** if subagents aren't available. Use
   **superpowers:test-driven-development** for all code and **frontend-design** for UI work.
4. **Release after every finished task** (see "Releasing"). Releases before the product works stay
   at `0.x`. Release `1.0.0` (`--as 1.0.0`) once the site and Lambda are deployed and the live
   smoke test in the spec (§8) passes.
5. Stop and ask the user only for things in "Needs the user" below. Otherwise work independently.

## Commands (current)

```bash
npm test                                   # node:test suite (tests/**/*.test.mjs)
node --test tests/release.test.mjs         # one file
node --test --test-name-pattern="bumpFor"  # one test by name
npm run ship -- "type: msg" --dry-run      # preview a release
```

`build`, `dev`, `validate`, Vitest and local `wrangler` commands are already pre-approved in
`.claude/settings.json`; add the matching `package.json` scripts as you build them, and list them
here.

## Architecture in one screen

```
Browser ─▶ Pages (11ty static + Functions SSR) ─▶ D1 (lists, items, votes, cache)
                     └─ SigV4 fetch (aws4fetch) ─┬▶ Lambda URL: translation-server (upstream)
                                                 └▶ Lambda URL: zoteamo-format (citeproc-js)
```

- **Write path** (add/edit item): `functions/_lib/enrich.js` → translation-server for CSL-JSON →
  `zoteamo-format` for APA/MLA/Chicago HTML + text → sanitize → store in D1.
- **Read path** (list pages, exports): Functions read stored strings only. No formatting here.
- Lambdas use Function URLs with `AWS_IAM` auth (never API Gateway). Cloudflare holds keys for an
  IAM user that can only `lambda:InvokeFunctionUrl`.
- No accounts: access is by unguessable edit/view tokens (spec §3, §5).

## Hard rules

- **$0 a month.** AWS is allowed only within the always-free tier. Never add anything billed per
  hour (API Gateway, NAT, ALB, ECR private repos, always-on compute). Read spec §6 before touching
  `infra/`.
- **Nothing CPU-heavy in Cloudflare Functions,** because the free plan allows 10 ms of CPU per
  request. Citation formatting happens in the `zoteamo-format` Lambda when items are saved. Pages
  only read stored strings.
- **Don't modify translation-server.** Deploy upstream at the SHA pinned in
  `infra/translation-server.ref`. Never vendor it into this repo.
- **WCAG 2.2 AAA.** Every feature works without JavaScript. Run `npm run validate` and the pa11y
  check before releasing UI changes.
- **Secrets never go in the repo or the chat.** Local secrets live in `.dev.vars` (gitignored).
- **Remote changes need the user's OK:** `wrangler ... --remote`, `wrangler pages deploy`
  and `aws` commands are set to "ask" in `.claude/settings.json`. Local dev and tests
  are pre-approved.

## Releasing (every change is a release)

```bash
npm run ship -- "feat(items): add voting" --body "Optional details.

<Co-Authored-By trailer from your system prompt>"
```

`scripts/ship.mjs` does everything in one step:
1. checks the header is a [Conventional Commit](https://www.conventionalcommits.org/)
2. runs `npm test`
3. bumps `package.json` (`feat` → minor; `fix`, `docs`, `chore` etc. → patch; `!` or
   `BREAKING CHANGE:` → major, or minor before 1.0.0)
4. prepends a `CHANGELOG.md` entry
5. commits everything and tags `vX.Y.Z`
6. pushes and runs `gh release create`

Notes:
- `ship` refuses to run off `main` or with a clean tree. If you work in a branch or worktree,
  merge to `main` first, then ship from there.
- Use `--dry-run` to preview, and `--as X.Y.Z` to force a specific version.
- Don't run `git commit` or `git tag` by hand for releases.
- Keep commit headers short and imperative. Put the user-facing detail in `--body`.
- Fix test failures; never skip them. `npm test` must also keep running `tests/release.test.mjs`.
  When you add Vitest, make `npm test` run both suites.

## Needs the user (credentials and account linking)

These are the only reasons to stop. When you reach one, prepare everything, then give the user a
single copy-paste command or one dashboard step, and continue once they confirm. Never ask the user
to paste secrets into the chat.

- Creating the Cloudflare Pages project, connecting it to GitHub, and creating the D1 database if
  `wrangler` isn't logged in.
- Creating the access key for IAM user `zoteamo-cloudflare` and putting it into Cloudflare secrets
  (`wrangler pages secret put ...`, which the user runs).
- The email address for the AWS Budget alert.
- The first `aws cloudformation deploy`. Show the change set and get approval.

## Conventions

- **Stack:**
  - 11ty 3 + Nunjucks (`src/`)
  - Cloudflare Pages Functions (`functions/`; shared modules in `functions/_lib/`)
  - D1 (`migrations/`)
  - SAM template (`infra/`), deployed with the AWS CLI
  - Vitest + `@cloudflare/vitest-pool-workers`
- **Follow the patterns in the sibling site** `C:\Users\thoma\Documents\integratedlibrarysystems`
  (also 11ty, Pages Functions and D1): custom CSS without frameworks, self-hosted fonts,
  `html-validate`, `src/_data/site.json`.
- **Small, single-purpose modules.** If a file grows past about 200 lines, split it.
- **Update `README.md`** when setup, deployment or usage changes.
- **AWS:** account 145395257847, region us-east-1. The AWS CLI v2 is installed and logged in.
  **The SAM CLI is not installed;** deploy with `aws cloudformation package` and `deploy` instead.
  `wrangler` isn't installed globally; add it as a devDependency. The old 2020 SAM bucket and stacks were deleted on 2026-10-06; don't recreate SAM's
  managed bucket (see spec §2).
- **Shell:** Windows 11. Use the Bash tool (Git Bash) for npm, git and gh, so the permissions in
  `.claude/settings.json` apply.
