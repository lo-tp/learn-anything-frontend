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

**Display name**:
The short chosen name of a User, shown in the top bar. Defaults to the email's local part.
_Avoid_: username, handle, nickname
