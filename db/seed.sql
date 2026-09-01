-- db/seed.sql
-- MVP stand-in identity: one static learner user.
-- The db layer's current-user resolution returns this row for every request;
-- it is swapped for real session-cookie -> user lookup when auth lands post-MVP.
-- Run after db/schema.sql (the tables live there).

INSERT INTO users (id, email, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'learner@example.com', 'Test Learner')
ON CONFLICT (email) DO NOTHING;
