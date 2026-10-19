/**
 * Applique prisma/migrations/0003_verrouillage_connexion/migration.sql sur la base de DATABASE_URL.
 *
 *   node scripts/appliquer_migration_0003.js            → affiche l'état, demande confirmation, applique
 *   node scripts/appliquer_migration_0003.js --lecture  → affiche seulement l'état (aucune écriture)
 *
 * La base de production a évolué par `prisma db push` : on exécute le SQL directement
 * (il est idempotent) plutôt que `prisma migrate deploy`, qui rejouerait 0001 et 0002.
 */
const fs = require('fs')
const path = require('path')
const readline = require('readline')
const { Client } = require('pg')

function lireEnv() {
  for (const f of ['.env', '.env.local']) {
    const p = path.join(__dirname, '..', f)
    if (!fs.existsSync(p)) continue
    for (const ligne of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = ligne.match(/^\s*(DATABASE_URL_UNPOOLED|DATABASE_URL)\s*=\s*["']?([^"'\s]+)/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
    }
  }
  return process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
}

async function etat(c) {
  const q = async (s) => (await c.query(s)).rows
  const cols = await q(`select column_name from information_schema.columns
    where table_name='Utilisateur' and column_name in ('tentativesEchouees','verrouilleJusqua')`)
  console.log('Colonnes de verrouillage déjà présentes :', cols.map((r) => r.column_name).join(', ') || 'aucune')
  console.table(await q(`select role, count(*)::int as total from "Utilisateur" group by role order by role`))
  console.log('Comptes dont le PIN sera remis à « à définir » (mot de passe non haché, hors ADMIN) :')
  console.table(await q(`select role, count(*)::int as comptes from "Utilisateur"
    where role <> 'ADMIN' and "motDePasse" not like 'scrypt:%' and "motDePasse" !~ '^[0-9a-f]{64}$'
    group by role order by role`))
  const admins = await q(`select count(*)::int as n from "Utilisateur"
    where role = 'ADMIN' and "motDePasse" not like 'scrypt:%' and "motDePasse" !~ '^[0-9a-f]{64}$'`)
  if (admins[0].n > 0) {
    console.log(`⚠ ${admins[0].n} administrateur(s) sans mot de passe haché : non modifiés par la migration,`)
    console.log('  mais ils ne pourront plus se connecter. Utilisez ensuite : npm run admin:seed -- <matricule> <motDePasse> <email> <nom> <prenom>')
  }
  console.log('Campagnes (poidsClient passera de 0 à 25 si poidsCollegues >= 25) :')
  console.table(await q(`select libelle, statut, "poidsManager", "poidsCollegues", "poidsClient" from "Campagne" order by "dateDebut"`))
}

async function main() {
  const url = lireEnv()
  if (!url) throw new Error('DATABASE_URL introuvable (.env).')
  console.log('Base cible :', new URL(url).hostname, '\n')

  const c = new Client({ connectionString: url, ssl: url.includes('localhost') ? false : { rejectUnauthorized: false } })
  await c.connect()
  try {
    await etat(c)
    if (process.argv.includes('--lecture')) return

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    const reponse = await new Promise((r) => rl.question('\nTapez APPLIQUER pour exécuter la migration : ', r))
    rl.close()
    if (reponse.trim() !== 'APPLIQUER') return console.log('Annulé, aucune modification.')

    const sql = fs.readFileSync(path.join(__dirname, '..', 'prisma/migrations/0003_verrouillage_connexion/migration.sql'), 'utf8')
    await c.query('BEGIN')
    try {
      await c.query(sql)
      await c.query('COMMIT')
    } catch (e) {
      await c.query('ROLLBACK')
      throw e
    }
    console.log('\nMigration appliquée. État après :\n')
    await etat(c)
  } finally {
    await c.end()
  }
}

main().catch((e) => {
  console.error('Erreur :', e.message)
  process.exit(1)
})
