# Quizzes are generated at execution time, not plan time

The Plan is a concept-only ordered list of LearningSteps — a prerequisite chain from the learner's probed boundary to mastery of the knowledge point. Multiple-choice / true-false Questions are generated at execution time, one per active step; after a wrong answer a *different* Question on the same step is generated.

**Why:** planning stays a fast, reviewable negotiation about concepts (the learner adjusts add/remove/depth/difficulty by triggering full plan regeneration), and questions stay fresh and always tied to the step being tested — there is no stale pre-generated question bank.

**Consequence:** question state must be persisted mid-execution for cross-device resume (see ADR 0001).
