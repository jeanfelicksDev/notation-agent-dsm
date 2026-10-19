/**
 * Données de démonstration pour une base LOCALE uniquement.
 *
 *   DATABASE_URL="postgresql://postgres:postgres@localhost:54329/postgres?sslmode=disable" node scripts/seed_demo.js
 *
 * Comptes créés :
 *   - Administrateur : matricule DEMO-ADMIN, mot de passe « demo-admin-2026 »
 *   - Agents : matricules A001…A024, PIN « 2580 » (A024 n'a pas encore défini de PIN)
 *   - Manager : matricule M001, PIN « 2580 »
 *   - Client externe : téléphone 0707070707
 */
const { PrismaClient } = require('@prisma/client')
const { PrismaPg } = require('@prisma/adapter-pg')
const { Pool } = require('pg')
const crypto = require('crypto')

const url = process.env.DATABASE_URL || ''
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
  console.error('Refus : ce script ne s’exécute que sur une base locale (localhost).')
  process.exit(1)
}

const prisma = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: url })) })

function hash(pw) {
  const salt = crypto.randomBytes(16).toString('hex')
  return `scrypt:${salt}:${crypto.scryptSync(pw, salt, 64).toString('hex')}`
}

const PRENOMS = ['Awa', 'Koffi', 'Mariam', 'Yao', 'Fatou', 'Ibrahim', 'Adjoua', 'Serge', 'Aminata', 'Kouadio', 'Nadia', 'Didier', 'Salimata', 'Hervé', 'Aïcha', 'Lassina', 'Christelle', 'Moussa', 'Estelle', 'Bakary', 'Prisca', 'Jean-Marc', 'Rokia', 'Arnaud']
const NOMS = ['Kouassi', 'Traoré', 'Koné', 'N’Guessan', 'Diabaté', 'Ouattara', 'Yao', 'Bamba', 'Coulibaly', 'Konan', 'Touré', 'Aka', 'Sanogo', 'Kouamé', 'Cissé', 'Doumbia', 'Ehui', 'Fofana', 'Gnagne', 'Kamara', 'Loukou', 'Méité', 'Soro', 'Zadi']
const SERVICES = [
  { service: 'Transit', departement: 'Opérations maritimes', direction: 'DSM' },
  { service: 'Documentation', departement: 'Opérations maritimes', direction: 'DSM' },
  { service: 'Facturation', departement: 'Finance & Clients', direction: 'DSM' },
  { service: 'Relation client', departement: 'Finance & Clients', direction: 'DSM' },
]

const CRITERES = [
  ['Communication', 'TOUS'], ['Force de proposition', 'TOUS'], ['Dynamisme', 'TOUS'], ['Respect et politesse', 'TOUS'],
  ['Ponctualité', 'MANAGER'], ['Réactivité', 'MANAGER'], ['Respect des règles', 'MANAGER'], ['Maîtrise des tâches', 'MANAGER'],
  ["Esprit d'équipe", 'COLLEGUE'], ['Appréciation clients', 'COLLEGUE'], ['Maîtrise des tâches', 'COLLEGUE'],
  ["La qualité de l’assistance", 'CLIENT'], ['Le service rendu', 'CLIENT'], ['La célérité dans le traitement des dossiers', 'CLIENT'],
]
const TYPES = { TOUS: ['MANAGER', 'COLLEGUE', 'CLIENT_INTERNE'], MANAGER: ['MANAGER'], COLLEGUE: ['COLLEGUE'], CLIENT: ['CLIENT'] }

const rnd = (min, max) => min + Math.floor(Math.random() * (max - min + 1))

async function main() {
  await prisma.$transaction([
    prisma.noteClient.deleteMany(), prisma.note.deleteMany(), prisma.scoreFinal.deleteMany(),
    prisma.affectation.deleteMany(), prisma.critere.deleteMany(), prisma.campagne.deleteMany(),
    prisma.session.deleteMany(), prisma.otpToken.deleteMany(), prisma.utilisateur.deleteMany(),
  ])

  const pin = hash('2580')

  await prisma.utilisateur.create({
    data: { matricule: 'DEMO-ADMIN', nom: 'Admin', prenom: 'Démo', email: 'admin@demo.local', motDePasse: hash('demo-admin-2026'), role: 'ADMIN', sexe: 'M', nationalite: 'Ivoirienne', emploi: 'Chef de service' },
  })
  const manager = await prisma.utilisateur.create({
    data: { matricule: 'M001', nom: 'Gbagbo', prenom: 'Laurent', email: 'm001@demo.local', motDePasse: pin, role: 'MANAGER', service: 'Transit', departement: 'Opérations maritimes', direction: 'DSM', sexe: 'M', nationalite: 'Ivoirienne', emploi: 'Chef de service' },
  })

  const agents = []
  for (let i = 0; i < 24; i++) {
    const s = SERVICES[i % SERVICES.length]
    agents.push(await prisma.utilisateur.create({
      data: {
        matricule: `A${String(i + 1).padStart(3, '0')}`,
        nom: NOMS[i].toUpperCase(), prenom: PRENOMS[i], email: `a${i + 1}@demo.local`,
        telephone: `0102030${String(400 + i)}`,
        motDePasse: i === 23 ? '' : pin, role: 'UTILISATEUR', ...s,
        sexe: i % 2 ? 'F' : 'M', nationalite: 'Ivoirienne', emploi: `Agent ${s.service.toLowerCase()}`,
        qrcodeActif: i % 2 === 0, qrToken: i % 2 === 0 ? crypto.randomBytes(20).toString('hex') : null,
      },
    }))
  }
  const client = await prisma.utilisateur.create({
    data: { matricule: '0707070707', telephone: '0707070707', nom: 'Bolloré Logistics', prenom: 'Client', email: 'client@demo.local', motDePasse: '', role: 'EXTERNE' },
  })

  async function campagne(libelle, debut, fin, statut, remplissage) {
    const c = await prisma.campagne.create({
      data: {
        libelle, dateDebut: new Date(debut), dateFin: new Date(fin), statut,
        criteres: { create: CRITERES.map(([libelle, t]) => ({ libelle, description: `Évalue « ${libelle.toLowerCase()} » au quotidien.`, noteMaximale: 5, typeEvaluateur: t, typeEvaluateurs: TYPES[t] })) },
      },
      include: { criteres: true },
    })
    const typesOf = (cr) => cr.typeEvaluateurs
    const affs = []
    for (const evalue of agents) {
      for (const peer of agents) {
        if (peer.id !== evalue.id && peer.service === evalue.service) affs.push({ evaluateurId: peer.id, evalueId: evalue.id })
      }
      affs.push({ evaluateurId: manager.id, evalueId: evalue.id })
    }
    for (const a of affs) {
      const evaluateur = a.evaluateurId === manager.id ? manager : agents.find((x) => x.id === a.evaluateurId)
      const r = Math.random()
      const statut = r < remplissage ? 'TERMINEE' : r < remplissage + 0.15 ? 'BROUILLON' : 'EN_ATTENTE'
      await prisma.affectation.create({ data: { ...a, campagneId: c.id, statut } })
      if (statut === 'EN_ATTENTE') continue
      const isMgr = evaluateur.role === 'MANAGER'
      const crits = c.criteres.filter((cr) => (isMgr ? typesOf(cr).includes('MANAGER') : typesOf(cr).includes('COLLEGUE')))
      const biais = rnd(-1, 1)
      await prisma.note.createMany({
        data: crits.map((cr) => ({ evaluateurId: a.evaluateurId, evalueId: a.evalueId, critereId: cr.id, campagneId: c.id, valeur: Math.max(1, Math.min(5, rnd(3, 5) + biais)) })),
      })
    }
    const critsClient = c.criteres.filter((cr) => typesOf(cr).includes('CLIENT'))
    for (const agent of agents.filter((x) => x.qrcodeActif).slice(0, 6)) {
      await prisma.noteClient.createMany({
        data: critsClient.map((cr) => ({ agentId: agent.id, campagneId: c.id, critereId: cr.id, valeur: rnd(3, 5), clientId: client.id })),
      })
    }
    return c
  }

  await campagne('Campagne S1 2026', '2026-01-15', '2026-02-15', 'CLOTUREE', 0.95)
  await campagne('Campagne S2 2026', '2026-09-01', '2026-12-31', 'OUVERTE', 0.4)
  console.log('Données de démonstration créées.')
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
