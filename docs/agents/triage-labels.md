# Triage labels

The five canonical triage roles, one label per name — all already exist on
`lo-tp/learn-anything-frontend` (verify with `gh label list`).

- **`needs-triage`** — Maintainer needs to evaluate the issue. An open issue
  with no triage role carries this while it is being evaluated.
- **`needs-info`** — Waiting on the reporter for more information. The issue
  cannot proceed until the reporter responds.
- **`ready-for-agent`** — Fully specified, ready for an AFK agent: the body and
  acceptance criteria are complete, its blockers (if any) are closed.
- **`ready-for-human`** — Requires human implementation or a human decision;
  not delegable to an agent as-is.
- **`wontfix`** — Will not be worked on: rejected, superseded, or out of scope.

Exactly one triage role applies to an open issue at a time; moving an issue to a
role means removing the previous one (`gh issue edit <n> --add-label <role>`
plus `--remove-label <old>`). Closed issues keep whatever role they had.

Wayfinder maps and tickets (`wayfinder:*` labels) use the roles the same way:
the label marks the issue's readiness, not its kind.
