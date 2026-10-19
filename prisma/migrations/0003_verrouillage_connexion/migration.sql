-- Migration: 0003_verrouillage_connexion
-- Verrouillage temporaire d'un compte après plusieurs PIN erronés.
-- Idempotente : la base de production a évolué par `prisma db push`,
-- ce script peut donc être rejoué sans risque.

ALTER TABLE "Utilisateur" ADD COLUMN IF NOT EXISTS "tentativesEchouees" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Utilisateur" ADD COLUMN IF NOT EXISTS "verrouilleJusqua" TIMESTAMP(3);

-- Les comptes importés avec un mot de passe en clair (ex. « 123456 ») n'ont
-- jamais défini de PIN : on les remet à « PIN à définir ».
UPDATE "Utilisateur"
SET "motDePasse" = ''
WHERE "role" <> 'ADMIN'
  AND "motDePasse" NOT LIKE 'scrypt:%'
  AND "motDePasse" !~ '^[0-9a-f]{64}$';

-- poidsClient devient la part des clients QR au sein de la part collègues/clients.
-- Les campagnes existantes utilisaient implicitement 25 points sur 45 : on l'explicite.
ALTER TABLE "Campagne" ALTER COLUMN "poidsClient" SET DEFAULT 25;
UPDATE "Campagne" SET "poidsClient" = 25 WHERE "poidsClient" = 0 AND "poidsCollegues" >= 25;
