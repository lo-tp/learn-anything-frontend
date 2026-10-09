# Learn Anything

An AI conversation-driven learning app: a learner declares a knowledge point and the app walks them to mastery, one question at a time.

## Language

**Session**:
One learning journey from goal declaration through to generated materials (phases: clarifying → probing → planning → reviewing → generating). A Session has a **public record** — the generated materials deck, browsable and answerable by anyone — and a **private working surface** — the intake (clarify, probe, plan), its in-progress state, and the owned review data — reachable only by its User. "A public Session" is the record, not the whole thing.
_Avoid_: conversation, course, unit

**Session intake**:
The interactive arc that opens a Session: goal declaration through clarifying, probing, and planning, ending when the plan is approved.
_Avoid_: intake dialog, new-session flow, onboarding

**User**:
A person who can sign in to the app: a unique email address, a display name, and a password.
_Avoid_: account, member, learner

**Visitor**:
A person who has not signed in to the app: they browse the public surfaces — Explore, and a Session's deck — without credentials.
_Avoid_: guest, anonymous user

**Sign-in state**:
The fact that a visitor is a signed-in user. It is required only where data is owned — a User's History, a Session's intake, and the review writes that attach to a Session — not for the app's public surfaces, which a Visitor uses.
_Avoid_: session, login session, auth session (in this repo "session" is always a learning Session)

**Explore**:
The public list of Session records — the newest Sessions that reached materials, goal text first, with no owner. Served at the site root; a Visitor and a signed-in User see the same feed.
_Avoid_: gallery

**History**:
A User's own Sessions, listed at `/mine` and labelled Study in the top bar. Requires sign-in, unlike Explore — it is owned data, not the public feed.
_Avoid_: Explore, Study (which is only the tab's label for it)

**Visitor deck view**:
The projection of a Session's deck that a Visitor may browse and answer. Their answers stay local to the view and no review card is written for them; what they earned is retained only if they sign in and become a User.
_Avoid_: guest deck, anonymous deck

**Service principal**:
A non-human caller of the backend that is not a signed-in User: the Sandbox, which fetches shared (unscoped) content on its own behalf. It is a distinct principal from the User and is scoped to internal endpoints only.
_Avoid_: service account, API key, client, bot

**Display name**:
The short chosen name of a User, shown in the top bar. Defaults to the email's local part.
_Avoid_: username, handle, nickname

## Review

**Review card**:
A durable record of a question the user missed, scheduled for spaced repetition. One per unique (user, source, session, question).
_Avoid_: flashcard, card

**Confidence**:
The user's self-assessment of how correctly they answered a review card, recorded on a four-level scale — again, hard, good, easy — after a reveal.
_Avoid_: grade, rating, score, was_correct

**Reveal**:
The step that shows the correct answer and explanation before the user records their confidence.
_Avoid_: show answer, unlock

**Lapse**:
A review recorded as `again`; a review card's running count of such reviews. A lapse is a review of an existing card, not the creation of one.
_Avoid_: miss

**Miss**:
A question the user got wrong in a probe or material, which creates a review card.
_Avoid_: lapse

**Due**:
The state of a review card whose scheduled review time has arrived, making it eligible for the deck.

**Review deck**:
The user's set of due review cards, served in scheduled order.
_Avoid_: queue

## Memory

**Boundary map**:
The outcome of a Session's probing phase: for each prerequisite strand the plan will depend on, where the learner's understanding starts (floor) and ends (ceiling). Scoped to one Session.
_Avoid_: knowledge profile, skill assessment

**Learner map**:
A User's persistent record of their understanding across Sessions. Each Session's boundary map is seeded from it and written back to it; it outlives every Session.
_Avoid_: user memory, long-term memory, learner profile, knowledge graph
