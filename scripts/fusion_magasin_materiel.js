// Complète les affectations de la campagne ouverte pour le service de notation Magasin-Matériel :
// les Pairs du Magasin et du Matériel se notent tous entre eux et chaque manager de l'un ou l'autre
// sous-service les note tous. N'ajoute que les paires manquantes (rien n'est supprimé ni modifié).
// Usage :
//   node scripts/fusion_magasin_materiel.js            -> simulation (lecture seule)
//   node scripts/fusion_magasin_materiel.js --apply    -> écrit les affectations en base
const { PrismaClient } = require('@prisma/client')
const { PrismaPg } = require('@prisma/adapter-pg')
const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')

function loadEnv() {
  for (const file of ['.env.local', '.env.production', '.env']) {
    const filePath = path.join(__dirname, '..', file)
    if (!fs.existsSync(filePath)) continue
    fs.readFileSync(filePath, 'utf8').split('\n').forEach((line) => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) return
      const idx = trimmed.indexOf('=')
      const key = trimmed.slice(0, idx).trim()
      let val = trimmed.slice(idx + 1).trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1)
      if (!process.env[key]) process.env[key] = val
    })
  }
}

// Même règle que src/lib/service-notation.ts
const cle = (s) => (s ?? '').trim().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const SOUS_SERVICES = new Set(['magasin', 'materiel'])

async function main() {
  loadEnv()
  const apply = process.argv.includes('--apply')
  const prisma = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })) })
  try {
    const campagne = await prisma.campagne.findFirst({ where: { statut: 'OUVERTE' }, orderBy: { dateDebut: 'desc' } })
    if (!campagne) throw new Error('Aucune campagne ouverte.')

    const agents = (await prisma.utilisateur.findMany({
      where: { role: { in: ['UTILISATEUR', 'MANAGER'] }, service: { not: null } },
      select: { id: true, nom: true, prenom: true, role: true, service: true },
    })).filter((a) => SOUS_SERVICES.has(cle(a.service)))
    const pairs = agents.filter((a) => a.role === 'UTILISATEUR')
    const managers = agents.filter((a) => a.role === 'MANAGER')

    const voulues = [
      ...pairs.flatMap((e) => pairs.filter((n) => n.id !== e.id).map((n) => ({ evaluateurId: e.id, evalueId: n.id }))),
      ...managers.flatMap((m) => pairs.map((p) => ({ evaluateurId: m.id, evalueId: p.id }))),
    ]
    const existantes = new Set((await prisma.affectation.findMany({
      where: { campagneId: campagne.id, evalueId: { in: pairs.map((p) => p.id) } },
      select: { evaluateurId: true, evalueId: true },
    })).map((a) => `${a.evaluateurId}_${a.evalueId}`))
    const aCreer = voulues.filter((v) => !existantes.has(`${v.evaluateurId}_${v.evalueId}`))

    const nom = new Map(agents.map((a) => [a.id, `${a.nom} ${a.prenom} (${a.service}${a.role === 'MANAGER' ? ', manager' : ''})`]))
    console.log(`Campagne : ${campagne.libelle}`)
    console.log(`Magasin-Matériel : ${pairs.length} Pairs, ${managers.length} manager(s) — ${aCreer.length} affectation(s) à ajouter`)
    for (const a of aCreer) console.log(`  + ${nom.get(a.evaluateurId)}  →  ${nom.get(a.evalueId)}`)

    if (!apply) return console.log('\nSimulation : rien n\'a été écrit. Relancer avec --apply pour enregistrer.')
    if (aCreer.length === 0) return
    const { count } = await prisma.affectation.createMany({
      data: aCreer.map((a) => ({ campagneId: campagne.id, ...a })),
      skipDuplicates: true,
    })
    console.log(`\n${count} affectation(s) ajoutée(s).`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => { console.error(e.message); process.exit(1) })
