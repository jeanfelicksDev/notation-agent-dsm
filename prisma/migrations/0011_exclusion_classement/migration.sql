-- Migration: 0011_exclusion_classement
-- Deux nouvelles situations de noté, toutes deux hors classement :
-- - NON_NOTANT : le noté n'a pas soumis ses propres évaluations à la clôture ;
-- - SEUIL_NON_ATTEINT : moins de « seuilNotants » notants ont soumis (remplace PENALISE, conservé
--   pour les scores déjà enregistrés).
-- Uniquement des ajouts de valeurs d'énumération. Idempotente.
-- À appliquer AVANT de déployer le code qui enregistre ces situations.

ALTER TYPE "SituationScore" ADD VALUE IF NOT EXISTS 'NON_NOTANT';
ALTER TYPE "SituationScore" ADD VALUE IF NOT EXISTS 'SEUIL_NON_ATTEINT';
