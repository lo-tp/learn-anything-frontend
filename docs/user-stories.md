# User Stories — Learn Anything

Single actor: **Learner** (a registered account holder). Stories follow the session flow:
Account → Home → Intake → Probing → Planning → Review → Execution → Completion, plus cross-cutting resume stories.

Format: "As a learner, I want …, so that …" with testable acceptance criteria (AC).
Vocabulary per [`CONTEXT.md`](../../CONTEXT.md).

## Account

**US-A1 — Create an account**
As a learner, I want to sign up with an email and password, so that I can start learning and keep my progress across visits.
- AC1: Signing up with a valid email and password creates the account and signs me in.
- AC2: Signing up with an already-registered email fails with a clear error and creates nothing.
- AC3: I can sign out; all my session state remains stored.

**US-A2 — Sign in**
As a learner, I want to sign in with my email and password, so that I can get back to my learning.
- AC1: Valid credentials take me to my home view with my sessions.
- AC2: Wrong credentials are rejected without revealing which part was wrong.

**US-A3 — Reset a forgotten password**
As a learner, I want to reset a forgotten password via my email, so that I can regain access to my sessions.
- AC1: "Forgot password" sends a reset link to the account's email.
- AC2: After reset, the old password no longer works.

**US-A4 — My data is private to my account**
As a learner, I want my sessions to be visible only under my own account, so that no one else can see or change my progress.
- AC1: Another account's sessions are neither listed nor reachable, e.g. by guessing a URL.

## Home

**US-H1 — See all my sessions**
As a learner, I want a home view listing my sessions with knowledge point, stage, progress, and last activity, so that I can see what I'm learning and pick up any of them.
- AC1: Each session shows its knowledge point, current stage (probing / planning / review / executing / complete), and progress.
- AC2: Opening a session resumes it from stored state.
- AC3: "Start new session" is available from this view at any time.

## Intake

**US-I1 — Describe what I want to learn**
As a learner, I want to describe the knowledge point I want to master in a free paragraph (e.g. "I want to learn Newton's second law of motion"), so that the AI knows my target.
- AC1: Intake is free text — one of only two free-text interactions in a session (the other is plan review).
- AC2: The AI records the knowledge point and immediately moves the session into probing.

## Probing

**US-P1 — Boundary probing with MC/TF only**
As a learner, I want the AI to ask me multiple-choice or true/false self-assessment questions, so that the AI can establish my boundary — what I already know and what I don't.
- AC1: Every probing question is MC (2–4 options) or TF; the AI never asks me to answer in free text.
- AC2: Questions target prior knowledge relevant to the knowledge point I declared.

**US-P2 — Probing is bounded**
As a learner, I want probing to stop as soon as the AI has established my boundary, with a hard cap of 10 questions, so that I reach a plan instead of an endless quiz.
- AC1: Probing ends when the AI judges the boundary established, or at the 10th question at the latest.
- AC2: The moment probing ends, the AI generates the first plan.

## Planning

**US-N1 — A plan from my boundary to mastery**
As a learner, I want the AI to generate a plan of ordered, incrementally small learning steps that take me from my boundary to mastering the knowledge point, so that I can see the whole road.
- AC1: Each step is one concept with a one-line outcome ("after this you can …").
- AC2: Steps form a prerequisite chain — dependencies first (e.g. what F is, what m is, what a is, before F=ma) — with the knowledge point itself covered last.
- AC3: The plan contains concepts only; no quiz questions exist at this stage.
- AC4: The plan respects the probed boundary — it does not re-teach what probing showed I already know.

**US-N2 — Review the plan**
As a learner, I want to review the plan conversationally before any quiz, so that the road matches my needs.
- AC1: Plan review is free text — the second and final free-text interaction of the session.
- AC2: Execution cannot start before I approve the plan.

**US-N3 — Add concepts in my own words**
As a learner, I want to add concepts in my own words (e.g. "I don't know the definition of gravity — add this to the plan"), so that gaps I know about myself are covered.

**US-N4 — Remove steps**
As a learner, I want to remove steps from the plan, so that I don't spend time on things I don't need.

**US-N5 — Change depth or difficulty**
As a learner, I want to ask for the plan to be deeper or shallower, or pitched at a different difficulty, so that the pace and level fit me.
- AC1: Deeper → more, smaller steps; shallower → fewer, bigger steps.
- AC2: A difficulty change carries into how step content and eventual questions are pitched.

**US-N6 — Any adjustment regenerates the plan**
As a learner, I want any of my adjustments to trigger a full plan regeneration by the AI, so that the revised plan stays coherent instead of being patched mechanically.
- AC1: After any add / remove / depth / difficulty request, I receive a new complete plan.
- AC2: The review loop repeats until I explicitly approve.

**US-N7 — Approve the plan**
As a learner, I want to explicitly approve the plan, so that execution begins from the first step.

## Execution

**US-E1 — One MC/TF question at a time**
As a learner, I want to be tested one question at a time, always a multiple-choice or true/false question on the current step, so that the format is always the same and predictable.
- AC1: After intake and plan review, every question the AI asks me is MC (2–4 options) or TF — no exceptions.
- AC2: Exactly one question is active at a time.
- AC3: Questions are generated at execution time for the current step; they are not pre-made in the plan.

**US-E2 — Explanation on a wrong answer**
As a learner, I want an immediate explanation when I answer wrong — why my answer is wrong and why the correct answer is right — so that I learn from the mistake instead of memorizing the key.

**US-E3 — Re-test with a different question**
As a learner, I want to be re-tested with a *different* question on the same step after a wrong answer, so that I prove real understanding instead of recognizing the previous question.
- AC1: The re-test question is not a repeat of the question I just got wrong.
- AC2: The wrong → explain → re-test loop continues until I answer the step correctly; there is no attempt cap.

**US-E4 — A step passes on a correct answer**
As a learner, I want a step to be marked passed when I correctly answer its (re-)generated question, so that I move to the next step.

**US-E5 — One markdown tracks the whole progress**
As a learner, I want a single markdown file, updated live, that tracks the session's whole progress — plan checklist, per-question outcomes, explanations given — so that one document tells the whole story of my learning.
- AC1: The markdown is viewable and downloadable at any time.
- AC2: It is rendered from stored session state (never read back by the app) and is identical on every device I resume from.

## Completion

**US-C1 — Mastery means every step passed**
As a learner, I want the session to end once every step of the plan has been passed, so that completion objectively means mastery of the knowledge point.

**US-C2 — A closing summary**
As a learner, I want a closing summary when the session completes, so that I can look back at what I learned and how I got there.
- AC1: The AI appends a final summary section to the progress markdown.
- AC2: The session is marked complete and remains in my home list.

## Resume & concurrency

**US-R1 — Resume on any device**
As a learner, I want to resume my session from a completely different device after signing in, so that my progress follows me.
- AC1: Stage, the current plan with its revision, position, and the complete Q&A history are restored exactly — a resumed session never changes what already happened.
- AC2: The progress markdown on the new device is identical to the one from before.

**US-R2 — Multiple concurrent sessions**
As a learner, I want to run several sessions for different knowledge points in parallel, so that I can learn several things at once.
- AC1: Sessions are fully independent of each other.
- AC2: Each session has its own progress markdown.

## Requirement traceability

| Original requirement | Stories |
|---|---|
| 1. Describe the knowledge to learn in a paragraph | US-I1 |
| 2. AI asks questions to test my boundaries | US-P1, US-P2 |
| 3. AI generates a plan toward mastery | US-N1, US-N7 |
| 4. Review and adjust the plan ("add the definition of gravity") | US-N2 … US-N6 |
| 5. A single markdown tracks the whole progress | US-E5 (+ ADR 0001) |
| 6. Only MC / TF questions, except intake and plan review | US-P1, US-E1 |
| 7. Wrong → explain why → re-test with a new question | US-E2, US-E3 |
| 8. All quizzes passed → session can end | US-C1, US-C2 |
| Accounts, multi-user, cross-device resume (decided in design rounds) | US-A1…A4, US-H1, US-R1, US-R2 |
