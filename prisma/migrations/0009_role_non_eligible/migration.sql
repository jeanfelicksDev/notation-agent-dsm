-- Migration: 0009_role_non_eligible
-- Rôle « Non-éligible » : agent de l'annuaire qui ne remplit pas les critères de participation
-- (ni noté, ni notant, pas de connexion). Uniquement un ajout. Idempotente.
-- À appliquer AVANT de déployer le code qui utilise ce rôle.

ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'NON_ELIGIBLE';
