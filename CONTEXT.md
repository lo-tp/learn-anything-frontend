# learn-anything — Context

Glossary for the AI conversation-driven learning assistant. Definitions only — no implementation detail. The spec produced by the current wayfinder map builds on these terms.

## Terms

**Topic** — the single sentence a learner gives describing what they want to learn. One topic starts one course.

**Course** — one learning engagement for a topic: its baseline, learning plan, conversation, and one Markdown document. A learner may run many courses; a course is resumable.

**Baseline (boundary test)** — the opening phase in which the assistant questions the learner to find the edge of what they already know.

**Learning plan** — the ordered set of sections the assistant commits to after the baseline. Lives inside the course document, with a per-section status.

**Question card** — one assessment item in exactly one of two formats: multiple-choice with four options, or free-text.

**The doc** — the course's single Markdown document, continuously edited by the assistant throughout the course: the learning plan with live status plus evolving study notes. The assistant's visible, shared memory.

**Phase** — the coarse stage of a course: baseline → planning → execution → complete.

**Anchor** — the grading key on a graded free-text question card: a self-contained short paragraph stating the core claim a correct answer must convey, the acceptable scope around it, and the misconception the check targets.

**Grader** — the evaluation of a graded free-text answer against its anchor. The grader's verdict is advisory: it judges, it never teaches, never advances the course, and never writes to the doc.
