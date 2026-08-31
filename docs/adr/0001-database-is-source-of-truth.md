# The database is the source of truth; the progress markdown is a projection

The original brief says "a single markdown will be used to track the whole progress", which reads as markdown-as-state. We decided the opposite: the database is the single source of truth for session state, and the progress markdown is a live-rendered, downloadable projection that the app never reads back.

**Consequences:**

- Sessions are resumable on a completely different device: stage, current plan with its revision, position, and the *full* Q&A history (question text, options, the learner's choice, correctness, explanation given) are persisted, so a resumed session never changes what already happened.
- The markdown can be regenerated or deleted at any time; it is safe to treat as a report, never as state.
