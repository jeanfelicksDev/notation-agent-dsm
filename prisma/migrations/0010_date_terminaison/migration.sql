-- Migration: 0010_date_terminaison
-- Date et heure de soumission définitive d'une affectation, affichées dans le suivi de campagne.
-- Les affectations déjà terminées reprennent la date de la dernière note de leur notant
-- (agents : Note.updatedAt ; clients externes : NoteClient.createdAt).
-- Un ajout de colonne et un remplissage des seules lignes vides. Idempotente.
-- À appliquer AVANT de déployer le code qui lit cette colonne.

ALTER TABLE "Affectation" ADD COLUMN IF NOT EXISTS "termineeAt" TIMESTAMP(3);

UPDATE "Affectation" a
SET "termineeAt" = n.derniere
FROM (
  SELECT "evaluateurId", "evalueId", "campagneId", MAX("updatedAt") AS derniere
  FROM "Note"
  GROUP BY "evaluateurId", "evalueId", "campagneId"
) n
WHERE a.statut = 'TERMINEE'
  AND a."termineeAt" IS NULL
  AND n."evaluateurId" = a."evaluateurId"
  AND n."evalueId" = a."evalueId"
  AND n."campagneId" = a."campagneId";

UPDATE "Affectation" a
SET "termineeAt" = nc.derniere
FROM (
  SELECT "clientId", "agentId", "campagneId", MAX("createdAt") AS derniere
  FROM "NoteClient"
  WHERE "clientId" IS NOT NULL
  GROUP BY "clientId", "agentId", "campagneId"
) nc
WHERE a.statut = 'TERMINEE'
  AND a."termineeAt" IS NULL
  AND nc."clientId" = a."evaluateurId"
  AND nc."agentId" = a."evalueId"
  AND nc."campagneId" = a."campagneId";
