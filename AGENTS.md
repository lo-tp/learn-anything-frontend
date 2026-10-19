## Agent skills

### Issue tracker

Issues live in GitHub Issues (operated via the `gh` CLI). See `docs/agents/issue-tracker.md`.

### Priority

Issues carry a priority label from `P0` (highest) to `P5` (lowest):

| Label | Meaning |
|---|---|
| `P0` | Drop everything — active incident or data loss |
| `P1` | Urgent — blocks shipping or a core flow is broken |
| `P2` | High — important feature or regression, scheduled soon |
| `P3` | Medium — valuable but not time-sensitive |
| `P4` | Low — nice to have, no active pressure |
| `P5` | Backlog — parked, revisit when capacity allows |

When the user says "prioritise" or "set priority", apply the matching label via `gh issue edit <n> --add-label P<n>`.

### Triage labels

The five canonical triage roles, one label per name: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

The domain language lives in the `CONTEXT.md` glossary at the repo root, and the decisions live in the `docs/adr/` ADR set.

## Commit messages

When writing a Git commit message:

1. Inspect the staged diff and recent commit history (`git log --oneline -20`). Match the repo’s existing style.
2. Use imperative mood, present tense: Add, Fix, Refactor, Remove, Update — not “Added”, “Fixes”, or “Adding”.
3. Subject line:
   - If the repo uses Conventional Commits: `<type>(<scope>): <summary>`
   - Otherwise: `<summary>`
   - Keep it <= 72 chars, ideally <= 50.
   - Capitalize the first word.
   - Do not end with a period.
4. If the change is non-trivial, add a blank line and a body:
   - Explain why the change was made, not just what changed.
   - Wrap lines at 72 chars.
   - Use bullet points if helpful.
5. Footer:
   - Reference issues: `Refs: #123`, `Closes: #123`
   - Mark breaking changes: `BREAKING CHANGE: ...`
   - Do not invent issue numbers, reviewers, or co-authors.
6. Avoid vague messages: “fix bug”, “update code”, “changes”, “WIP”, “misc”.
7. Output only the commit message unless I ask for explanation. No markdown fences.

## Branch promotion

- `main` → `release`: merge as a **merge commit** (the PR's merge commit,
  never its rebase or squash).
- `feature/<slug>` → `main`: rebase-merge.
- The same work lands on one branch at a time — not on both `main` and
  `release` (a cherry-pick across the pair counts as landing it twice).

If a `main` → `release` PR conflicts in files both branches recently
touched, the lineages may be duplicated; diagnose before resolving: `git
cherry release main` (a `-` line is work already on `release`), `git
merge-base main release`, `git merge-tree --write-tree main release` (the
merge's conflicts, without touching a working tree).

<!-- BEGIN:nextjs-agent-rules -->

## How a change here reaches a browser

`main` is checked — lint, typecheck, the coverage-gated test suite — and never builds
an image. Merging `main` into `release` is the act that ships: the image is built,
its smoke step runs it and asserts that the health route answers exactly 200 (the
load balancer's health check accepts nothing else, #158), that an anonymous
visitor is redirected to `/mine`, and that the page renders copy from
`messages/`; it is published under a `sha-<commit>` tag, and
`lo-tp/learn-anything-infra` pins the digest and deploys it, with no human step in
between. `release` is protected and moves only by merging `main` into it, so every
commit production runs stays reachable on `main`.

Two rules follow: never commit directly to `release`, and never expect a push to
`main` to change what is serving. What production runs is recorded in the
infrastructure repository's `manifests/overlays/prod/kustomization.yaml`, and
reverting that pin commit is the rollback.

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
