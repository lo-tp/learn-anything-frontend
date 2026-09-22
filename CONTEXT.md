# Learn Anything

An AI conversation-driven learning app: a learner declares a knowledge point and the app walks them to mastery, one question at a time.

## Language

**Session**:
One learning journey from goal declaration through to generated materials (phases: clarifying → probing → planning → reviewing → generating).
_Avoid_: conversation, course, unit

**User**:
A person who can sign in to the app: a unique email address, a display name, and a password.
_Avoid_: account, member, learner

**Sign-in state**:
The fact that a visitor is a signed-in user. Every function of the app requires it; the app has no usable surface without it.
_Avoid_: session, login session, auth session (in this repo "session" is always a learning Session)

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
