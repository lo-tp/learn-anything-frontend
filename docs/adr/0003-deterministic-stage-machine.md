# The stage machine is deterministic; the LLM generates content, it does not drive the session

The session lifecycle (probing → planning → review → executing → complete) is owned by code. The LLM answers a fixed per-stage contract and always returns validated structured output; its "judgments" (target specific enough, boundary established) arrive as declared output fields that the code acts on.

**Considered option:** an agentic, LLM-in-the-loop design where the model holds tools and drives the session, with code as a safety net. Rejected: the spec's invariants (one active question, a re-test question that differs from the failed question, the 10-question probing cap, concepts-only plans, no execution before approval) are cheap to enforce in code and best-effort at best in a model — and cross-device resume (ADR 0001) requires prompts to be reconstructable purely from persisted state, which the stage machine gives for free.

**Consequences:** every AI-generated artifact must fit a fixed per-stage contract (Zod schema). When a future requirement wants open-ended model initiative, the answer is widening a contract, not handing over the loop.
