-- db/schema.sql
-- Learn Anything — canonical Postgres schema.
-- Rationale and spec traceability: docs/schema.md.
--
-- Run order: db/schema.sql, then db/seed.sql.
--
-- Source of truth: session_messages (the LLM-turn log). Stage, plan + revision,
-- position, and progress are folded out of it, never stored as columns (ADR 0004).
-- raw_messages is a rebuildable UI projection — never a second truth.

CREATE TABLE users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  knowledge_point TEXT,               -- short AI-recorded summary; home label; updated on re-scope
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE session_messages (
  id BIGSERIAL PRIMARY KEY,           -- id order = truth order
  session_id   UUID NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
  -- The stage the session was in when this request was made — a filter/sectioning
  -- aid, not the current stage. 'planning' and 'complete' never occur as row
  -- types under the current flow (both are zero-length).
  type         TEXT NOT NULL CHECK (type IN ('intake', 'probing', 'planning', 'review',
                                             'executing', 'complete')),
  -- The learner's input for this turn: their typed text, or a canonical action
  -- token (ANSWER:<n>, APPROVE) for non-text input.
  request      TEXT NOT NULL,
  -- The LLM's structured reply: a typed union, validated by core/contracts.
  response     JSONB NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE raw_messages (
  session_id UUID PRIMARY KEY REFERENCES sessions (id) ON DELETE CASCADE,
  messages   JSONB NOT NULL,          -- @ai-sdk UIMessage[] — a view-layer type (ADR 0004)
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX sessions_user_id_idx ON sessions (user_id);
CREATE INDEX session_messages_session_id_idx ON session_messages (session_id);
