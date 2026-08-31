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
