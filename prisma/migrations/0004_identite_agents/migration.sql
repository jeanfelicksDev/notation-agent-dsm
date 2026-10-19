-- Migration: 0004_identite_agents
-- Champs d'identité des agents issus de la liste RH :
-- Matricule, Nom, Prénom, Sexe, Nationalité, Emploi, Service, Département, Direction.
-- Idempotente (la base de production évolue hors de `prisma migrate`).

ALTER TABLE "Utilisateur" ADD COLUMN IF NOT EXISTS "sexe" TEXT;
ALTER TABLE "Utilisateur" ADD COLUMN IF NOT EXISTS "nationalite" TEXT;
ALTER TABLE "Utilisateur" ADD COLUMN IF NOT EXISTS "emploi" TEXT;
