# Learn Anything

An AI conversation-driven learning assistant. Describe the knowledge you want to learn, and it walks you to mastery — one quiz question at a time.

> Status: design phase. The behaviour is fully specified in the docs below; the implementation is not yet in the repo.

## How it works

1. **You say what you want to learn.** A free paragraph — e.g. *"I want to learn Newton's second law of motion."* If the target is too broad, the AI asks you to narrow it before probing.
2. **The AI probes your boundary.** A short run (max 10) of multiple-choice / true-false self-assessment questions that map what you already know and what you don't.
3. **The AI generates a plan.** An ordered list of incrementally small learning steps from your current boundary to mastery — dependencies first (understand `F`, `m`, `a` before `F=ma`).
4. **You review and adjust it.** In your own words you can add, remove, or change the depth or difficulty of the plan (*"I don't know the definition of gravity — add this"*). Every adjustment regenerates the full plan; execution starts when you approve.
5. **You get drilled.** From this point on, everything asked of you is a multiple-choice or true/false question — one at a time, generated for the current step. Answer wrong and the AI explains why yours is wrong and why the correct one is right, then re-tests you with a *different* question on the same step, until you pass.
6. **One markdown tracks it all.** A single live-updated markdown file per session — plan checklist, per-question outcomes, explanations — viewable and downloadable at any time.
7. **You finish when you've mastered it.** The session ends when every plan step has been passed, with a closing summary.

## Also

- **Your account, your progress** — sign up with email and password; sessions are private to your account.
- **Pick up on any device** — all state lives in a server-side database; resuming continues exactly where you left off.
- **Learn several things at once** — sessions for different knowledge points run independently.

## Docs

- [User stories](docs/user-stories.md) — what the app does, story by story, with acceptance criteria
- [Glossary](CONTEXT.md) — the app's exact terminology
- [ADR 0001](docs/adr/0001-database-is-source-of-truth.md) — the database is the source of truth; the progress markdown is a projection
- [ADR 0002](docs/adr/0002-execution-time-quiz-generation.md) — quizzes are generated at execution time, not plan time
