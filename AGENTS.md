## Agent skills

### Issue tracker

Issues live in GitHub Issues (operated via the `gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles, one label per name: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Architecture and domain language live in `ArchitectureRevamp.md` at the repo root (the prior `CONTEXT.md` glossary and `docs/adr/` set were removed in favor of it). See `docs/agents/domain.md`.

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

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
