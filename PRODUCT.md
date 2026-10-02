# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Real customers of all ages — anyone who wants to learn something they are
personally interested in (a physics law, a language concept, a programming
idea). They arrive self-directed: they know what they want to learn, not how
to get there. The job is "take me from what I already know to genuine
mastery of this specific thing, without wasting my time." Ages range from
children to adults, so every surface must be comprehensible and operable
without specialist knowledge or dense reading.

## Product Purpose

An AI conversation-driven learning assistant. The learner describes a
knowledge point in plain words; the app clarifies it if too broad, probes the
learner's current boundary with short self-assessment questions, generates an
ordered plan of incrementally small steps from that boundary to mastery,
lets the learner adjust and approve the plan, then drills one
multiple-choice / true-false question at a time until every step is passed.
A single live-updated markdown document tracks the whole session and is
downloadable at any time. Missed questions become spaced-repetition review
cards. Success means a learner reaches verified mastery of their declared
goal and can return, resume, and keep reviewing.

## Positioning

Not a chat tutor that answers questions — a guided walk to verified mastery.
The different mechanism: the app maps what you already know before teaching
anything, turns that map into a plan you approve, and only calls you finished
when every step has been passed under questioning. The session's own
markdown document is a durable artifact the learner owns, and misses persist
as a personal review deck (spaced repetition) across sessions.

## Operating Context

- Sessions are private to a signed-in account; all state lives server-side,
  so a learner can resume exactly where they left off on any device.
- Multiple learning sessions run independently side by side.
- The app has no usable surface without sign-in state.
- A live session is a workspace: conversation/questions on one side, the
  living markdown document on the other (layout itself is now open to
  reimagining).
- A separate review deck serves due cards scheduled for spaced repetition.

## Capabilities and Constraints

- Hard functional requirements (confirmed): dual language — English and
  Chinese (next-intl, `messages/`); dual theme — light and dark
  (theme toggle, palette in `public/palette.css`). Every redesigned surface
  must work equally in both languages and both themes.
- Flow phases are fixed product facts: clarifying → probing → planning →
  reviewing → generating/drilling; probes max 10; questions are MCQ or
  true/false only; every plan adjustment regenerates the full plan.
- Backend is a separate service; the frontend talks to it through the typed
  OpenAPI client (`lib/api-client.ts`, `types/api.d.ts` is generated, never
  hand-edited).
- Repo glossary in `CONTEXT.md` is the binding terminology: Session, Session
  intake, User, Display name, Review card, Confidence, Reveal, Lapse, Miss,
  Due, Review deck. UI copy must use these terms.
- Licensed GPL-3.0. Built on Next.js 16, Tailwind 4, shadcn/radix.
- Deliberately undecided: pricing, accounts model beyond email+password,
  mobile native apps — none exist yet; do not invent them.

## Brand Commitments

- Name: "Learn Anything".
- Voice: plain, warm, unpretentious language a child and an adult can both
  follow; the app speaks as a patient tutor, never as a dashboard.
- "Electric Vivid Modern" (`design/DESIGN.md`) is explicitly NOT binding;
  the incumbent dark "Syntactic Deep" palette is evidence and anti-reference,
  not a constraint.

## Evidence on Hand

- Working app shell and components (`app/`, `views/`, `components/`):
  login, session list + intake, session workspace, review deck.
- Design mockups and prior direction studies under `design/` (screens,
  HTML comps, two DESIGN.md variants) — evidence of past exploration, not
  commitments.
- README describes the full intended flow and API integration.
- Absences that must not be fabricated: no testimonials, no customer
  counts, no benchmarks, no case studies, no press, no pricing.

## Product Principles

1. One question at a time — the learner is never asked to do more than the
   next single step.
2. Know the learner before teaching — the boundary probe is the product's
   foundation, not a formality.
3. The learner's plan is the contract — nothing is taught until the plan is
   approved in the learner's own words.
4. Everything the learner does leaves a durable artifact — the session
   markdown and the review deck belong to them.
5. Understandable at any age — copy, density, and interaction must work for
   a 10-year-old and a 70-year-old alike.

## Accessibility & Inclusion

No formal standard required yet, but users span all ages: legible type,
plain language in two scripts (Latin + Chinese), full light/dark support,
keyboard operability, and low cognitive load are product requirements, not
polish.
