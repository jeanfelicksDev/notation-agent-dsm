-- Migration: 0012_date_resultats
-- Jour et heure de publication des résultats d'une campagne : à partir de ce moment, la page des résultats
-- (/resultats) est ouverte à tous, sans connexion ; avant, elle n'affiche qu'un écran d'attente.
-- NULL : résultats non publiés, la page n'est visible que de l'administrateur.
-- Uniquement l'ajout d'une colonne facultative. Idempotente.
-- À appliquer AVANT de déployer le code qui lit cette colonne.

ALTER TABLE "Campagne" ADD COLUMN IF NOT EXISTS "dateResultats" TIMESTAMP(3);
