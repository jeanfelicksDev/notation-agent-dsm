// Met à jour direction / département / service des agents à partir de l'organigramme DSM.
// Usage :
//   node scripts/maj_services_agents.js            -> simulation (lecture seule), affiche le rapport
//   node scripts/maj_services_agents.js --apply    -> écrit les changements en base
const { PrismaClient } = require('@prisma/client')
const { PrismaPg } = require('@prisma/adapter-pg')
const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')

function loadEnv() {
  const envFiles = ['.env.local', '.env.production', '.env']
  for (const file of envFiles) {
    const filePath = path.join(__dirname, '..', file)
    if (!fs.existsSync(filePath)) continue
    fs.readFileSync(filePath, 'utf8').split('\n').forEach((line) => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) return
      const idx = trimmed.indexOf('=')
      const key = trimmed.slice(0, idx).trim()
      let val = trimmed.slice(idx + 1).trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      if (!process.env[key]) process.env[key] = val
    })
  }
}

// Libellé déjà porté par les autres comptes et par la liste DIRECTION : le reprendre évite
// de scinder la direction en deux dans le palmarès.
const DIRECTION = 'DIRECTION SOLUTION MARITIME'

// [département, service, agents séparés par "/"]
const ORGANIGRAMME = [
  ['Consignation', 'OOCL', "ANE KOFFI/BODO HOUPO EVARISTE/ZIAGOUE JEAN-FELIX/TOILI ZOTA LINDA SANDRINE/TOGNISSOU EPSE DALLY GENEVIEVE/COULIBALY AWA GNON/KOUYATE ADAMA/FAYE EPSE DJAMA ESSETCHI VERA SANDIE/KONAN KOUAME N'SISSO PAUL"],
  ['Consignation', 'GSL', "BAKAYOKO MOHAMED ABDRAMANE/AMSTRONG JEAN-JACQUES ARMEL/ASSA ANOUMOU VANESSA/BILE EPSE KOFFI BLA NATACHA NICOLE/ONAGNELIN JEAN LOUIS DESIRE/N'DA KOUAO CHRISTIAN/DIOMANDE MOUSSA"],
  ['Consignation', 'Documentation', 'YEDOH JEAN CONSTANT/COULIBALY FOUNGNIGUE SIMONE/KPANGNY EPSE KOUADIO ABRAN EMMA CHRISTELLE/KONE SALIMATA/KONATE EPSE COULIBALY MINATA'],
  ['Consignation', 'Shipping', 'AMIEN KABRAN MAXIME/GOHOUN KOMLAN ANGE STEPHANE/IKPO GAGNON GUY SERGE/ZAMBLE FRANCK ALEX BOAN'],
  ['Consignation', 'Administration', 'SOLAMA EPSE COULIBALY TENE SANDRINE/AYEREBI KATCHE/BONIFON YAPOGA STANISLAS D/OUATTARA DAOUDA'],
  ['Facturation', "Compte d'escale", 'PALENFO ISMAEL YKIRE/ AMANI KOUADIO LAURENT/NANOU AMAH MARIE-CLAUDE G./MOTCHE FAMIEN SERGE/KOUA AHOULOU EMMANUEL R./BROU KROU ALPHONSE'],
  ['Facturation', 'Back office', 'ZABDA EPSE CAMARA AWA/YENON RUTH DAVILA LAETITIA/YA BI IRIE ERIC/COULIBALY MAXIME DOFARA/SORO SADIO/KONE EPSE PALENFO AMINATA/'],
  ['Facturation', 'Front office', "KOUASSI MODESTE KOUAKOU/KOUAME ARMAND RAPHAEL/KOUAME YVES ROLAND/DIANE N'VA KRAMO AMARA/DOUMBIA KARAMOKO/DIAKITE DRISSA ERIC BIBI/MAMADOU COULIBALY"],
  ['Manutention', 'Magasin', 'TOE KASSOUM/DOSSO DOKO/BAH DAKLOUA CELESTIN/LAGUI DIGBEU EDOUARD'],
  ['Manutention', 'Matériel', 'KADJO MENSAH SERGE/KOUAKOU GUY SERGE FRANC/AKA BONI ELYSEE SAINT J.'],
  ['Manutention', 'Opérations Navire', 'OUATTARA PEKALY AUGUSTIN/MARIKO MOHAMED LAMINE/KOUAME KOUASSI/KASSI KASSI CLAUDE/ZOUGOUE NATOH CHRISTOPHE/NANTI EPSE BAH LOU YOUNAN VIHEVALO'],
  ['Dépôt', 'Dépôt', "AHOURO BOUADI PATRICIA/TRAORE MOUSSA/BATIENO HERMANN/COULIBALY SOUNGALO/MAHAN DRIA CELESTIN/DJECHOU N'CHO JACQUES/ KOUAME BI GOLE MATHIAS/"],
]

// Correspondances fixées à la main (nom tronqué en base, ou homonyme ADMIN) : nom du tableau -> matricule.
const MATRICULES_FORCES = {
  'KPANGNY EPSE KOUADIO ABRAN EMMA CHRISTELLE': '6880',
  'GOHOUN KOMLAN ANGE STEPHANE': '3325',
  'KOUAKOU GUY SERGE FRANC': '6042',
  'ZIAGOUE JEAN-FELIX': '7453',
}

// Mots ignorés pour la comparaison : "EPSE" et les initiales d'une lettre.
function tokens(nomComplet) {
  return nomComplet
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z]+/g, ' ')
    .trim()
    .split(' ')
    .filter((t) => t.length > 1 && t !== 'EPSE')
}

function agentsDuTableau() {
  return ORGANIGRAMME.flatMap(([departement, service, liste]) =>
    liste.split('/').map((n) => n.trim()).filter(Boolean)
      .map((nom) => ({ nom, departement, service }))
  )
}

// Exact : mêmes mots (ordre libre). Partiel : tous les mots de l'un sont dans l'autre.
function correspondance(ligne, utilisateurs) {
  const force = MATRICULES_FORCES[ligne.nom]
  if (force) return { type: 'forcé', candidats: utilisateurs.filter((u) => u.matricule === force) }
  const t = tokens(ligne.nom)
  const cle = [...t].sort().join(' ')
  const exacts = utilisateurs.filter((u) => u.cle === cle)
  if (exacts.length) return { type: 'exact', candidats: exacts }
  const partiels = utilisateurs.filter((u) => {
    const [petit, grand] = t.length <= u.toks.length ? [t, u.toks] : [u.toks, t]
    return petit.length >= 2 && petit.every((x) => grand.includes(x))
  })
  return { type: 'partiel', candidats: partiels }
}

function libelleUtilisateur(u) {
  return `${u.nom} ${u.prenom} [${u.matricule}, ${u.role}]`
}

function construirePlan(utilisateurs) {
  const indexes = utilisateurs.map((u) => {
    const toks = tokens(`${u.nom} ${u.prenom}`)
    return { ...u, toks, cle: [...toks].sort().join(' ') }
  })
  const trouves = []
  const introuvables = []
  const ambigus = []
  for (const ligne of agentsDuTableau()) {
    const { type, candidats } = correspondance(ligne, indexes)
    if (candidats.length === 1) trouves.push({ ligne, type, u: candidats[0] })
    else if (candidats.length === 0) introuvables.push(ligne)
    else ambigus.push({ ligne, candidats })
  }
  // Un même utilisateur ne doit pas être revendiqué par deux lignes.
  const parId = new Map()
  for (const t of trouves) parId.set(t.u.id, [...(parId.get(t.u.id) || []), t])
  const doublons = [...parId.values()].filter((l) => l.length > 1)
  const idsDoublons = new Set(doublons.map((l) => l[0].u.id))
  return {
    trouves: trouves.filter((t) => !idsDoublons.has(t.u.id)),
    introuvables, ambigus, doublons,
    nonCites: indexes.filter((u) => !parId.has(u.id)),
  }
}

function afficherRapport(plan) {
  const { trouves, introuvables, ambigus, doublons, nonCites } = plan
  const aChanger = trouves.filter(({ ligne, u }) =>
    u.direction !== DIRECTION || u.departement !== ligne.departement || u.service !== ligne.service)
  console.log(`\n=== Correspondances (${trouves.length}, dont ${aChanger.length} à modifier) ===`)
  for (const { ligne, type, u } of trouves) {
    const avant = `${u.departement ?? '-'} / ${u.service ?? '-'}`
    const marque = type === 'exact' ? '' : ` (${type})`
    console.log(`  ${ligne.nom}  ->  ${libelleUtilisateur(u)}${marque}\n      ${avant}  =>  ${ligne.departement} / ${ligne.service}`)
  }
  console.log(`\n=== Introuvables en base (${introuvables.length}) ===`)
  introuvables.forEach((l) => console.log(`  ${l.nom}  (${l.departement} / ${l.service})`))
  console.log(`\n=== Ambigus (${ambigus.length}) ===`)
  ambigus.forEach(({ ligne, candidats }) =>
    console.log(`  ${ligne.nom}  ->  ${candidats.map(libelleUtilisateur).join(' | ')}`))
  console.log(`\n=== Un même agent revendiqué par plusieurs lignes (${doublons.length}) ===`)
  doublons.forEach((l) => console.log(`  ${libelleUtilisateur(l[0].u)}  <-  ${l.map((t) => t.ligne.nom).join(' | ')}`))
  console.log(`\n=== En base mais absents du tableau, inchangés (${nonCites.length}) ===`)
  nonCites.forEach((u) => console.log(`  ${libelleUtilisateur(u)}  ${u.departement ?? '-'} / ${u.service ?? '-'}`))
  return aChanger
}

async function appliquer(prisma, aChanger) {
  const listes = [
    ['DIRECTION', [DIRECTION]],
    ['DEPARTEMENT', [...new Set(ORGANIGRAMME.map(([d]) => d))]],
    ['SERVICE', [...new Set(ORGANIGRAMME.map(([, s]) => s))]],
  ]
  const valeurs = listes.flatMap(([liste, libelles]) => libelles.map((libelle) => ({ liste, libelle })))
  // Une requête par couple (département, service) : la base distante rend 68 updates unitaires trop lents.
  const groupes = new Map()
  for (const { ligne, u } of aChanger) {
    const cle = `${ligne.departement}|${ligne.service}`
    groupes.set(cle, { ...ligne, ids: [...(groupes.get(cle)?.ids || []), u.id] })
  }
  await prisma.$transaction(async (tx) => {
    await tx.valeurListe.createMany({ data: valeurs, skipDuplicates: true })
    for (const { departement, service, ids } of groupes.values()) {
      await tx.utilisateur.updateMany({
        where: { id: { in: ids } },
        data: { direction: DIRECTION, departement, service },
      })
    }
  }, { timeout: 60000 })
  console.log(`\n${aChanger.length} agent(s) mis à jour, listes déroulantes complétées.`)
}

async function main() {
  loadEnv()
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL non trouvée')
  const apply = process.argv.includes('--apply')
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
  try {
    const utilisateurs = await prisma.utilisateur.findMany({
      select: { id: true, matricule: true, nom: true, prenom: true, role: true, direction: true, departement: true, service: true },
    })
    const aChanger = afficherRapport(construirePlan(utilisateurs))
    if (apply) await appliquer(prisma, aChanger)
    else console.log('\nSimulation uniquement : relancer avec --apply pour écrire en base.')
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

main().catch((e) => {
  console.error('Erreur :', e.message || e)
  process.exit(1)
})
