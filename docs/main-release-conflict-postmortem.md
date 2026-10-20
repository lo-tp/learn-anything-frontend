# Postmortem: why `main` → `release` always conflicted

_2026-10-19 · fixed via PR #225 · `release` is now `da231a2`_

## The symptom

Every pull request from `main` into `release` came back conflicted, in the same seven
files each time:

```
design/DESIGN.md
messages/en.d.json.ts
messages/en.json
messages/zh.json
test/views/mine/new-session-dialog.test.tsx
views/mine/intake.ts
views/mine/new-session-dialog.tsx
```

Resolved once, the next `main` → `release` PR conflicted again in the same region. The
conflict was not a content disagreement — both branches agreed on what the code should
say. It was a *lineage* problem.

## The root cause: two copies of the same work, committed independently

The #204 work (the plain-form intake sheet) landed on **both branches as separate
commits** — the same five changes, committed once on `main` and again on `release`,
never merged from one to the other:

```
* ef01c62 (#223)                       main
* f5d91f4  make the end of the probe a panel…    (#204)
* 2e60735  give the intake sheet one measure…    (#204)
* 50a0ea4  say what the intake's boundary…       (#204)
* d30a460  keep the intake sheet's original…     (#204)
* bd967c7  rebuild the new-session intake…       (#204)
| * 9e73722  make the end of the probe a panel…  (#204)
| * 8025cd9  give the intake sheet one measure…  (#204)
| * c88b9bb  say what the intake's boundary…     (#204)
| * e9bb71c  keep the intake sheet's original…   (#204)
| * 5d0d450  rebuild the new-session intake…     (#204)
|/
* a77c4db  mark the browsing tab active… (#214)   ← merge base of main and release
```

Evidence:

- `git cherry origin/release main` marks all five `main`-side commits with `-` —
  each is patch-identical to a commit already on `release`.
- `git diff f5d91f4 9e73722 --stat` is empty — the two branches' #204 tips are
  byte-identical trees.

Same work, different SHAs, no shared ancestry between the two chains. Consequence:
the merge base of `main` and `release` sat at `a77c4db`, **before** the #204 work.

## Why that guarantees "always conflict"

Git's 3-way merge compares `base / ours / theirs` per hunk. With the merge base at
`a77c4db`:

1. Both sides "changed" every #204 file relative to that base (each through its own
   copy of the commits).
2. Any new commit on `main` that touches a line the #204 work rewrote — or a line in
   the same hunk neighbourhood — means *both sides changed the same lines to different
   values*: `release` has the #204 value, `main` has the #204 value *plus* the new
   change. That is a content conflict, even though the two branches agree on the
   #204 part.
3. The #223 commit edited exactly such neighbourhoods (the same doc comments, message
   block, and test region #204 had rewritten), so it conflicted in all seven files.

Reproduced without touching any working tree:

```
$ git merge-tree --write-tree --name-only origin/release main
CONFLICT (content): Merge conflict in design/DESIGN.md
…(7 files)
```

The pattern recurs by construction: the merge base never moves, because `release`
never actually contains `main`'s commits.

## Why a squash or rebase merge does not fix it

Both squash and rebase merge put **new commits** on `release`. `main`'s actual commits
(`bd967c7…ef01c62`) still are not ancestors of `release`, so the merge base still sits
at `a77c4db`, and the next `main` commit touching the #204 region conflicts again.

Verified by simulation before choosing the fix: a branch carrying a squash-style
commit (one new commit with `main`'s tree), plus one future `main` commit touching
`new-session-dialog.tsx` — the merge still conflicted:

```
$ git merge-tree --write-tree --name-only sim/main-next sim/release-squash
CONFLICT (content): Merge conflict in views/mine/new-session-dialog.tsx
```

Only a **merge commit** cures it: it makes `release` genuinely contain `main`'s
commits, which moves the merge base up to `main`'s tip. From then on, every
`main` → `release` merge is a fast-forward and cannot conflict.

## The fix

Precondition — prove `release` carries no unique content, so "take the `main` side"
discards nothing:

```
$ git diff origin/release origin/main --stat    # empty: trees identical
$ git cherry origin/release main                # the only "+" is the new main commit
```

Steps:

1. Push `main` (`ef01c62`).
2. Cut a throwaway branch from `origin/release`, merge `origin/main` into it. The
   seven files conflict; resolve **every one to the `main` side**:
   `git restore --source=origin/main --staged --worktree .`. Verify the merge tree is
   byte-identical to `origin/main` before committing.
3. The repository disallowed merge commits on pull requests (rebase/squash only), and
   the setting is UI-managed — temporarily enable *Allow merge commits*
   (Settings → General → Pull requests).
4. Merge the throwaway branch into `release` **as a merge commit** (PR #225) →
   `release` at `da231a2`, whose lineage now includes `ef01c62`.
5. Verify the cure:

   ```
   $ git merge-base origin/main origin/release
   ef01c62…                      # main's tip — the base has moved
   $ git merge-tree --write-tree --name-only sim/future origin/release
   <single tree, no conflicts>  # a future main commit touching the #204 file merges clean
   ```

6. Delete the throwaway branch (local and remote).

## The rules going forward

- **Never commit the same work to two branches.** Land it on one branch; reach the
  other by merge (opened as a PR), not by re-committing.
- **Repair a duplication once, with a merge commit.** Squash or rebase repairs re-create
  the condition — the merge base stays put and the next regional commit conflicts
  again.
- **Diagnose with the three commands**: `git cherry A B` (patch-equivalence — a `-`
  means "already over there"), `git merge-base A B` (how far apart the lineages
  really are), and `git merge-tree --write-tree A B` (simulate the merge's conflicts
  without touching a working tree).
