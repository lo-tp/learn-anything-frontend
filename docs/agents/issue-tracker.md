# Issue tracker

GitHub Issues on `lo-tp/learn-anything-frontend`, operated via the `gh` CLI (auth
as `lo-tp`). Issues filed on the private `lo-tp/learn-anything` are historical: do
not seek or update them there.

## Wayfinding operations

How this repo physically expresses the wayfinder's tracker primitives:

- **Map**: an issue labelled `wayfinder:map`.
- **Ticket**: a **native sub-issue** of the map — `--parent <map>` at create time, or `gh issue edit <map> --add-sub-issue <n>`. Labelled `wayfinder:<type>` (`map`, `research`, `prototype`, `grilling`, `task` — all already exist; check with `gh label list`).
- **Blocking**: GitHub native linked issues. Direction matters: `gh issue edit <blocker> --add-blocking <blocked>` means *blocker blocks* the listed issues. Reverse direction is `--add-blocked-by`. Remove with `--remove-blocking` / `--remove-blocked-by`.
- **Claim**: `gh issue edit <n> --add-assignee @me` (claim = assignee; open + unassigned = unclaimed).
- **Resolve**: `gh issue comment <n> --body-file <file>` for the resolution comment, then `gh issue close <n>`.
- **Frontier**: the open sub-issues of the map that are unassigned and whose blockers are all closed — visible in the map's sub-issues view on github.com; `gh issue list --state open` for the flat list.

## gh CLI gotchas (v2.98.0)

- `gh issue create` has **no `--json` and no `--silent` flag** — it prints the issue's plain URL. Capture the number with `... | grep -oE 'issues/[0-9]+' | grep -oE '[0-9]+'`.
- `--parent`, `--blocked-by`, `--blocking` **do** exist on `gh issue create`; `--add-blocking`/`--add-blocked-by`/`--add-sub-issue` exist on `gh issue edit`.
- Blocking edges need issue numbers that exist → **two passes**: create every ticket first (collecting numbers), then wire all `--add-blocking` edges in a second loop.
- Create in dependency-safe order only if you want stable small numbers; otherwise record the printed numbers per ticket as they come back.
