# Trace to LangSmith with unredacted learner content

We instrument the LangGraph graphs (clarify, probe, plan, material) with **LangSmith SaaS** tracing: one project, `metadata = {env, session_id, phase, user_id}` — the opaque integer user PK, never the email — and full tracing in dev and production. Learner-written text (goals, answers, plan adjustments) reaches LangSmith's US-hosted storage unredacted, deliberately.

Considered and rejected: self-hosted Arize Phoenix (another always-on service in a cluster where each service costs its replica floor); prompt redaction (it would blind us to exactly the adjust-loop and probe failures we debug, and these traces are the review source for the preference dataset the DPO experiment exports). Tracing volume is single-user scale, so retention cost is negligible against the debuggability of multi-step graphs.
