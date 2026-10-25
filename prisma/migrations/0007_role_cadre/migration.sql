-- Migration: 0007_role_cadre
-- Rôle « Cadre » : membre du personnel présent dans l'annuaire mais hors campagne
-- (ni noté, ni notant, pas de connexion). Uniquement un ajout. Idempotente.

ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'CADRE';
