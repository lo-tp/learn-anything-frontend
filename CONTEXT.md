# Learn Anything

A web app where a learner declares a knowledge point they want to master; the AI probes their current boundary, plans the smallest steps from there to mastery, and drills them with multiple-choice and true/false quizzes until every step is passed.

## Language

**Learner**:
A registered account holder who learns through the app.
_Avoid_: user, student

**Knowledge point**:
The subject a learner declares they want to master, captured in their intake paragraph (e.g. "Newton's second law of motion").
_Avoid_: topic, subject

**Boundary**:
A learner's current frontier of understanding in a knowledge point: what they already know versus what they don't.
_Avoid_: baseline, level

**Stage**:
The phase of a session in its lifecycle: intake, probing, planning, review, executing, or complete.
_Avoid_: phase, status, step

**Probing**:
The multiple-choice / true-false self-assessment phase that establishes the boundary, before any plan exists.
_Avoid_: assessment, intake quiz

**Plan**:
The ordered list of LearningSteps taking a learner from their boundary to mastery of the knowledge point. Contains concepts only — no quizzes.
_Avoid_: syllabus, curriculum

**Plan revision**:
An immutable numbered snapshot of the plan; every learner adjustment produces a new revision, and the progress markdown shows the approved plan's revision number.
_Avoid_: version, iteration

**LearningStep**:
One incrementally small concept a learner must understand on the way to mastery (e.g. "what F is", before "F=ma").
_Avoid_: lesson, unit, chapter

**Demo**:
An optional interactive React component the LLM authors in raw TSX to make a LearningStep tangible. Consists of an ordered list of parts; the host selects which part is active. Stored as TSX in the turn log (source of truth) with its compiled JS as derived data; rendered only inside the sandbox. Never an input to the stage machine.
_Avoid_: widget, illustration, artifact

**Sandbox**:
The script-enabled iframe in which a Demo executes, served by the demo server under its own origin (e.g. localhost:3001 in dev). That origin is nameable but distinct from the host page's: the browser still blocks the demo from the host's DOM, cookies, and storage. A fixed trusted **harness** (our code, built at deploy) boots inside the sandbox and loads the untrusted Demo. Data flows parent → iframe only (selecting the active part); the sole iframe → parent messages are plumbing — resize (auto-height) and error — never demo data.
_Avoid_: iframe, cage, container

**Question**:
A multiple-choice (2–4 options) or true/false item generated at execution time, testing the current LearningStep.
_Avoid_: MCQ, item

**Re-test**:
A different Question on the same LearningStep, generated after a wrong answer in the wrong → explain → re-test loop.
_Avoid_: retry, repeat

**Progress markdown**:
The rendered, live-updated, downloadable markdown report of one session's whole progress. A view, never the source of truth — the database is.
_Avoid_: transcript, log file, specification, spec doc

**Session**:
One learner's in-flight journey to master one knowledge point, resumable on any device from the database.
_Avoid_: course, run, attempt, project

**History**:
The list of a learner's sessions — in-flight and complete — from which a learner resumes one or starts another.
_Avoid_: projects, archive, past sessions
