-- Migration: 0002_add_unique_note_constraint
-- Adds a unique constraint to the Note table to prevent duplicate notes
-- from race conditions (double-clicks, concurrent requests).
-- Uses IF NOT EXISTS so it's safe to re-run.

CREATE UNIQUE INDEX IF NOT EXISTS "Note_evaluateurId_evalueId_critereId_campagneId_key"
  ON "Note" ("evaluateurId", "evalueId", "critereId", "campagneId");
