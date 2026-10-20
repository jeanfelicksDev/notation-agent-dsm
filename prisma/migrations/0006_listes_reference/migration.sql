-- Migration: 0006_listes_reference
-- Listes déroulantes gérables des fiches agents : Nationalité, Service, Département,
-- Direction (ajout, renommage, suppression) et libellés des rôles (renommage seulement).
-- Les listes sont amorcées avec les valeurs déjà présentes dans les fiches.
-- Idempotente.

CREATE TABLE IF NOT EXISTS "ValeurListe" (
  "id"        TEXT NOT NULL,
  "liste"     TEXT NOT NULL,
  "libelle"   TEXT NOT NULL,
  "code"      TEXT,
  "parDefaut" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ValeurListe_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ValeurListe_liste_libelle_key" ON "ValeurListe"("liste", "libelle");
CREATE INDEX IF NOT EXISTS "ValeurListe_liste_idx" ON "ValeurListe"("liste");

-- Valeurs déjà saisies dans les fiches (une seule par écriture, sans tenir compte de la casse)
INSERT INTO "ValeurListe" ("id", "liste", "libelle")
SELECT gen_random_uuid()::text, v.liste, v.libelle
FROM (
  SELECT DISTINCT ON (liste, lower(libelle)) liste, libelle
  FROM (
    SELECT 'NATIONALITE' AS liste, trim("nationalite") AS libelle FROM "Utilisateur"
    UNION ALL SELECT 'SERVICE', trim("service") FROM "Utilisateur"
    UNION ALL SELECT 'DEPARTEMENT', trim("departement") FROM "Utilisateur"
    UNION ALL SELECT 'DIRECTION', trim("direction") FROM "Utilisateur"
  ) brut
  WHERE libelle IS NOT NULL AND libelle <> ''
  ORDER BY liste, lower(libelle), libelle
) v
WHERE NOT EXISTS (
  SELECT 1 FROM "ValeurListe" e WHERE e.liste = v.liste AND lower(e.libelle) = lower(v.libelle)
);

-- Services proposés jusqu'ici
INSERT INTO "ValeurListe" ("id", "liste", "libelle")
SELECT gen_random_uuid()::text, 'SERVICE', s.libelle
FROM (VALUES ('Manutention'), ('Consignation'), ('Dépôt'), ('Facturation')) AS s(libelle)
WHERE NOT EXISTS (
  SELECT 1 FROM "ValeurListe" e WHERE e.liste = 'SERVICE' AND lower(e.libelle) = lower(s.libelle)
);

-- Direction par défaut : la plus fréquente dans les fiches, sinon « Direction Maritime »
INSERT INTO "ValeurListe" ("id", "liste", "libelle")
SELECT gen_random_uuid()::text, 'DIRECTION', 'Direction Maritime'
WHERE NOT EXISTS (SELECT 1 FROM "ValeurListe" WHERE liste = 'DIRECTION');

UPDATE "ValeurListe" SET "parDefaut" = true
WHERE "id" = (
  SELECT l.id FROM "ValeurListe" l
  LEFT JOIN "Utilisateur" u ON lower(trim(u."direction")) = lower(l.libelle)
  WHERE l.liste = 'DIRECTION'
  GROUP BY l.id, l.libelle
  ORDER BY count(u.id) DESC, l.libelle
  LIMIT 1
)
AND NOT EXISTS (SELECT 1 FROM "ValeurListe" WHERE liste = 'DIRECTION' AND "parDefaut");

-- Libellés des rôles
INSERT INTO "ValeurListe" ("id", "liste", "libelle", "code")
SELECT gen_random_uuid()::text, 'ROLE', r.libelle, r.code
FROM (VALUES ('UTILISATEUR', 'Pair'), ('MANAGER', 'Manager'), ('ADMIN', 'Administrateur'), ('EXTERNE', 'Client externe')) AS r(code, libelle)
WHERE NOT EXISTS (SELECT 1 FROM "ValeurListe" e WHERE e.liste = 'ROLE' AND e.code = r.code);
