-- Migration: 0008_notants_defaillants
-- Un collaborateur noté par au moins « seuilNotants » personnes, manager compris, n'est plus
-- pénalisé par un notant qui n'a pas soumis à la clôture ; sans note du manager, il n'est pas classé.
-- Les campagnes déjà terminées gardent la règle historique (seuilNotants NULL) : la règle n'est pas rétroactive.
-- Uniquement des ajouts. Idempotente : les anciennes campagnes ne passent en règle historique
-- qu'au moment où la colonne est créée, jamais lors d'une seconde exécution.

DO $$ BEGIN
  CREATE TYPE "SituationScore" AS ENUM ('COMPLET', 'PROTEGE', 'PENALISE', 'SANS_MANAGER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'Campagne' AND column_name = 'seuilNotants'
  ) THEN
    ALTER TABLE "Campagne" ADD COLUMN "seuilNotants" INTEGER DEFAULT 3;
    UPDATE "Campagne" SET "seuilNotants" = NULL WHERE "statut" <> 'OUVERTE';
  END IF;
END $$;

ALTER TABLE "ScoreFinal" ADD COLUMN IF NOT EXISTS "situation" "SituationScore";
ALTER TABLE "ScoreFinal" ADD COLUMN IF NOT EXISTS "nbNotants" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ScoreFinal" ADD COLUMN IF NOT EXISTS "nbNotantsAttendus" INTEGER NOT NULL DEFAULT 0;
