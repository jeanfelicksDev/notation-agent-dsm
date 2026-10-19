const { PrismaClient } = require('@prisma/client')
const { PrismaPg } = require('@prisma/adapter-pg')
const { Pool } = require('pg')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

// Chargement manuel des variables d'environnement depuis .env ou .env.local
function loadEnv() {
  const envFiles = ['.env.local', '.env.production', '.env']
  for (const file of envFiles) {
    const filePath = path.join(__dirname, '..', file)
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8')
      content.split('\n').forEach((line) => {
        const trimmed = line.trim()
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const idx = trimmed.indexOf('=')
          const key = trimmed.slice(0, idx).trim()
          let val = trimmed.slice(idx + 1).trim()
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1)
          }
          if (!process.env[key]) {
            process.env[key] = val
          }
        }
      })
    }
  }
}

loadEnv()

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('Erreur : DATABASE_URL non trouvée dans .env')
  process.exit(1)
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: databaseUrl.includes('localhost') ? false : { rejectUnauthorized: false },
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex')
  return `scrypt:${salt}:${derivedKey}`
}

async function main() {
  const args = process.argv.slice(2)
  if (args.length < 5) {
    console.error('Usage : npm run admin:seed -- <matricule> <motDePasse> <email> <nom> <prenom>')
    process.exit(1)
  }
  const matricule = args[0].toUpperCase().trim()
  const password = args[1]
  const email = args[2].toLowerCase().trim()
  const nom = args[3]
  const prenom = args[4]
  if (password.length < 8) {
    console.error('Le mot de passe administrateur doit faire au moins 8 caractères.')
    process.exit(1)
  }

  console.log(`\n=== Initialisation Sécurisée Compte Administrateur DSM ===`)
  console.log(`Matricule : ${matricule}`)
  console.log(`Email     : ${email}`)
  console.log(`Rôle      : ADMIN`)

  let site = await prisma.site.findFirst({ where: { nom: 'Siège Social' } })
  if (!site) {
    site = await prisma.site.create({ data: { nom: 'Siège Social', ville: 'Abidjan' } })
  }

  const hashedPassword = hashPassword(password)

  const existing = await prisma.utilisateur.findFirst({
    where: {
      OR: [
        { matricule: { equals: matricule, mode: 'insensitive' } },
        { email: { equals: email, mode: 'insensitive' } },
      ],
    },
  })

  if (existing) {
    const updated = await prisma.utilisateur.update({
      where: { id: existing.id },
      data: {
        matricule,
        email,
        motDePasse: hashedPassword,
        role: 'ADMIN',
        siteId: site.id,
      },
    })
    console.log(`\nCompte existant mis à jour avec succès : ID ${updated.id}`)
  } else {
    const created = await prisma.utilisateur.create({
      data: {
        matricule,
        nom,
        prenom,
        email,
        motDePasse: hashedPassword,
        role: 'ADMIN',
        siteId: site.id,
      },
    })
    console.log(`\nNouveau compte administrateur créé avec succès : ID ${created.id}`)
  }

  console.log(`Mot de passe sécurisé haché avec scrypt (sel aléatoire 16 octets, clé 64 octets).`)
  console.log(`=== Terminé avec succès ===\n`)
}

main()
  .catch((e) => {
    console.error('Erreur lors de l\'initialisation admin:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
