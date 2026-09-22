# Use FSRS for review-card scheduling

We replaced the SM-2 spaced-repetition wrapper with the **FSRS** scheduler (`fsrs` PyPI package) for the review deck. After revealing the answer, the learner records a four-level **confidence** — `again` / `hard` / `good` / `easy`, mapping 1:1 to FSRS `Rating` — and FSRS computes the next due date.

The full FSRS card state is stored as an opaque `fsrs_state` JSON blob (via `card.to_json()`) on `ReviewCard`, rather than normalized columns, because it round-trips losslessly and stays robust as FSRS evolves. The old `interval_days` / `ease` / `lapses` / `is_retired` columns and the 21-day retirement are dropped. SM-2 was replaced because FSRS expresses the four confidence grades natively and is the stronger, actively maintained model.