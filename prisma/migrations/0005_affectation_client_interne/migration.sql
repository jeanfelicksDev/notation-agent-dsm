-- Migration: 0005_affectation_client_interne
-- Lors de la répartition des notants, un pair peut être désigné « client interne »
-- d'un collaborateur : il le note alors sur les critères « Clients internes ».
-- Idempotente.

ALTER TABLE "Affectation" ADD COLUMN IF NOT EXISTS "clientInterne" BOOLEAN NOT NULL DEFAULT false;
