-- Migration: 0006_invalidation_affectation
-- Un notant empêché par un cas de force majeure (accident, décès...) peut être invalidé
-- par l'administrateur : ses notes sont ignorées et le collaborateur noté reste classé
-- sur ses autres évaluations, au lieu de voir la part correspondante compter pour 0.
-- Uniquement des ajouts. Idempotente.

DO $$ BEGIN
  CREATE TYPE "MotifInvalidation" AS ENUM ('FORCE_MAJEURE', 'ACCIDENT', 'DECES', 'AUTRE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Affectation" ADD COLUMN IF NOT EXISTS "invalidee" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Affectation" ADD COLUMN IF NOT EXISTS "motifInvalidation" "MotifInvalidation";
ALTER TABLE "Affectation" ADD COLUMN IF NOT EXISTS "commentaireInvalidation" TEXT;
ALTER TABLE "Affectation" ADD COLUMN IF NOT EXISTS "invalideeAt" TIMESTAMP(3);

ALTER TABLE "ScoreFinal" ADD COLUMN IF NOT EXISTS "managerNeutralise" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ScoreFinal" ADD COLUMN IF NOT EXISTS "colleguesNeutralise" BOOLEAN NOT NULL DEFAULT false;
