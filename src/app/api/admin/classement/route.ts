import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { attribuerRangs, calculerScores, enregistrerScores } from '@/lib/scores'
import type { Role } from '@prisma/client'

export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store' }

/** Seuls les agents opérationnels figurent au classement. */
const ROLES_CLASSES = new Set(['UTILISATEUR'])

/** Libellés de repli = valeurs par défaut du schéma (jamais de montants inventés). */
const PRIX_PAR_DEFAUT = {
  prixGlobal: 'Super Lauréat DSM 360°',
  prixDirection: "Trophée d'Excellence + Dotation Spéciale",
  prixDepartement: 'Certificat de Mérite + Prime',
  prixService: "Diplôme d'Honneur + Prime",
}

export interface RawAgentScore {
  utilisateurId: string
  matricule: string
  nom: string
  prenom: string
  direction: string
  departement: string
  service: string
  scoreTotal: number
  scoreCollegues: number
  scoreManager: number
  scoreClient: number
  hasCollegues: boolean
  hasManager: boolean
  hasClient: boolean
  rangGlobal: number
  rangDirection: number
  rangDepartement: number
  rangService: number
  isMajorGlobal: boolean
  isMajorDirection: boolean
  isMajorDepartement: boolean
  isMajorService: boolean
  totalInDirection: number
  totalInDepartement: number
  totalInService: number
  /** Points obtenus et maxima par source, selon les pondérations de la campagne */
  partManager: number
  partCollegues: number
  partClient: number
  maxManager: number
  maxCollegues: number
  maxClient: number
  /** Part neutralisée car tous ses notants ont été invalidés (force majeure) */
  managerNeutralise: boolean
  colleguesNeutralise: boolean
}

type Poids = { poidsManager: number; poidsCollegues: number; poidsClient: number }
const POIDS_PAR_DEFAUT: Poids = { poidsManager: 55, poidsCollegues: 45, poidsClient: 25 }

type Neutralisation = { managerNeutralise?: boolean; colleguesNeutralise?: boolean }

/** Même répartition que le calcul du score (src/lib/scores.ts), exprimée en points. */
function parts(s: { scoreCollegues: number; scoreManager: number; scoreClient: number } & Neutralisation, p: Poids) {
  // Une part neutralisée (tous ses notants invalidés) reporte son poids sur l'autre
  const total = p.poidsManager + p.poidsCollegues
  const poidsManager = s.colleguesNeutralise ? total : s.managerNeutralise ? 0 : p.poidsManager
  const poidsCollegues = s.managerNeutralise ? total : s.colleguesNeutralise ? 0 : p.poidsCollegues
  const echelle = p.poidsCollegues > 0 ? poidsCollegues / p.poidsCollegues : 0

  const c = s.scoreCollegues > 0
  const q = s.scoreClient > 0
  const client = Math.min(p.poidsClient, p.poidsCollegues) * echelle
  const maxCollegues = c && q ? poidsCollegues - client : c ? poidsCollegues : 0
  const maxClient = c && q ? client : q ? poidsCollegues : 0
  const r = (n: number) => Math.round(n * 10) / 10
  return {
    partManager: r((s.scoreManager * poidsManager) / 100),
    partCollegues: r((s.scoreCollegues * maxCollegues) / 100),
    partClient: r((s.scoreClient * maxClient) / 100),
    maxManager: poidsManager,
    maxCollegues: r(maxCollegues || poidsCollegues),
    maxClient: r(maxClient || poidsCollegues),
  }
}

type UtilisateurClasse = {
  matricule: string
  nom: string
  prenom: string
  role: string
  direction: string | null
  departement: string | null
  service: string | null
}

function versAgent(
  utilisateurId: string,
  u: UtilisateurClasse,
  s: { scoreTotal: number; scoreCollegues: number; scoreManager: number; scoreClient: number } & Neutralisation,
  poids: Poids,
  arrondi = (n: number) => Math.round(n * 10) / 10
): RawAgentScore {
  const dir = u.direction?.trim() || 'Direction DSM'
  const dep = u.departement?.trim() || dir
  const srv = u.service?.trim() || dep
  return {
    utilisateurId,
    matricule: u.matricule,
    nom: u.nom,
    prenom: u.prenom,
    direction: dir,
    departement: dep,
    service: srv,
    scoreTotal: arrondi(s.scoreTotal),
    scoreCollegues: arrondi(s.scoreCollegues),
    scoreManager: arrondi(s.scoreManager),
    scoreClient: arrondi(s.scoreClient),
    // Une note vaut au minimum 1 : un score nul signifie « aucune évaluation de cette source ».
    hasCollegues: s.scoreCollegues > 0,
    hasManager: s.scoreManager > 0,
    hasClient: s.scoreClient > 0,
    rangGlobal: 0,
    rangDirection: 0,
    rangDepartement: 0,
    rangService: 0,
    isMajorGlobal: false,
    isMajorDirection: false,
    isMajorDepartement: false,
    isMajorService: false,
    totalInDirection: 0,
    totalInDepartement: 0,
    totalInService: 0,
    managerNeutralise: !!s.managerNeutralise,
    colleguesNeutralise: !!s.colleguesNeutralise,
    ...parts(s, poids),
  }
}

function grouper(list: RawAgentScore[], cle: (a: RawAgentScore) => string) {
  const map = new Map<string, RawAgentScore[]>()
  for (const a of list) map.set(cle(a), [...(map.get(cle(a)) ?? []), a])
  return map
}

function computeRankings(rawList: RawAgentScore[]) {
  const global = attribuerRangs(rawList, (a, rang) => {
    a.rangGlobal = rang
    a.isMajorGlobal = rang === 1
  })

  const classerGroupes = (
    map: Map<string, RawAgentScore[]>,
    appliquer: (a: RawAgentScore, rang: number, total: number) => void
  ) => {
    const out = new Map<string, RawAgentScore[]>()
    for (const [nom, agents] of map) out.set(nom, attribuerRangs(agents, (a, rang) => appliquer(a, rang, agents.length)))
    return out
  }

  const parDirection = classerGroupes(grouper(global, (a) => a.direction), (a, rang, total) => {
    a.rangDirection = rang
    a.isMajorDirection = rang === 1
    a.totalInDirection = total
  })
  const parDepartement = classerGroupes(grouper(global, (a) => a.departement), (a, rang, total) => {
    a.rangDepartement = rang
    a.isMajorDepartement = rang === 1
    a.totalInDepartement = total
  })
  const parService = classerGroupes(grouper(global, (a) => a.service), (a, rang, total) => {
    a.rangService = rang
    a.isMajorService = rang === 1
    a.totalInService = total
  })

  const tri = <T extends { nom: string }>(arr: T[]) => arr.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))

  const groupesDirection = tri([...parDirection].map(([nom, scores]) => ({ nom, scores })))
    .map(({ nom, scores }) => ({ directionNom: nom, scores, major: scores[0] ?? null }))
  const groupesDepartement = tri([...parDepartement].map(([nom, scores]) => ({ nom, scores })))
    .map(({ nom, scores }) => ({ departementNom: nom, directionNom: scores[0]?.direction ?? '', scores, major: scores[0] ?? null }))
  const groupesService = tri([...parService].map(([nom, scores]) => ({ nom, scores })))
    .map(({ nom, scores }) => ({
      serviceNom: nom,
      departementNom: scores[0]?.departement ?? '',
      directionNom: scores[0]?.direction ?? '',
      scores,
      major: scores[0] ?? null,
    }))

  return {
    tousLesScores: global,
    laureats: {
      majorGlobal: global[0] ?? null,
      majorsDirection: groupesDirection.filter((g) => g.major).map((g) => ({ directionNom: g.directionNom, major: g.major!, totalAgents: g.scores.length })),
      majorsDepartement: groupesDepartement.filter((g) => g.major).map((g) => ({ departementNom: g.departementNom, directionNom: g.directionNom, major: g.major!, totalAgents: g.scores.length })),
      majorsService: groupesService.filter((g) => g.major).map((g) => ({ serviceNom: g.serviceNom, departementNom: g.departementNom, directionNom: g.directionNom, major: g.major!, totalAgents: g.scores.length })),
    },
    groupesDirection,
    groupesDepartement,
    groupesService,
  }
}

const SELECT_UTILISATEUR = {
  matricule: true, nom: true, prenom: true, role: true,
  direction: true, departement: true, service: true,
} as const

async function listeCampagnes() {
  // Poids et prix chargés d'emblée : la campagne choisie n'a pas à être relue ensuite.
  const campagnes = await prisma.campagne.findMany({
    select: {
      id: true, libelle: true, statut: true, dateDebut: true, dateFin: true,
      poidsCollegues: true, poidsManager: true, poidsClient: true,
      prixGlobal: true, prixDirection: true, prixDepartement: true, prixService: true,
    },
    orderBy: { dateDebut: 'desc' },
  })
  const annees = [...new Set(campagnes.map((c) => new Date(c.dateDebut).getFullYear()))].sort((a, b) => b - a)
  const annuels = annees.map((annee) => ({
    id: `ANNUEL_${annee}`,
    libelle: `Palmarès annuel ${annee} (moyenne des campagnes)`,
    statut: 'ANNUEL',
    dateDebut: new Date(`${annee}-01-01`),
    dateFin: new Date(`${annee}-12-31`),
  }))
  const resume = campagnes.map(({ id, libelle, statut, dateDebut, dateFin }) => ({ id, libelle, statut, dateDebut, dateFin }))
  return { campagnes, toutesLesCampagnes: [...annuels, ...resume] }
}

async function palmaresAnnuel(annee: number, toutesLesCampagnes: unknown[]) {
  // Seules les campagnes terminées entrent dans le palmarès annuel.
  const campagnes = await prisma.campagne.findMany({
    where: {
      statut: { not: 'OUVERTE' },
      dateDebut: { gte: new Date(`${annee}-01-01T00:00:00Z`), lte: new Date(`${annee}-12-31T23:59:59.999Z`) },
    },
    select: { id: true },
  })
  const scores = await prisma.scoreFinal.findMany({
    where: { campagneId: { in: campagnes.map((c) => c.id) } },
    include: { utilisateur: { select: SELECT_UTILISATEUR } },
  })

  const parAgent = new Map<string, typeof scores>()
  for (const s of scores) parAgent.set(s.utilisateurId, [...(parAgent.get(s.utilisateurId) ?? []), s])

  const moy = (arr: typeof scores, k: 'scoreTotal' | 'scoreCollegues' | 'scoreManager' | 'scoreClient') =>
    arr.reduce((acc, s) => acc + s[k], 0) / arr.length

  const rawList = [...parAgent]
    .filter(([, arr]) => ROLES_CLASSES.has(arr[0].utilisateur.role))
    .map(([id, arr]) =>
      versAgent(id, arr[0].utilisateur, {
        scoreTotal: moy(arr, 'scoreTotal'),
        scoreCollegues: moy(arr, 'scoreCollegues'),
        scoreManager: moy(arr, 'scoreManager'),
        scoreClient: moy(arr, 'scoreClient'),
      }, POIDS_PAR_DEFAUT)
    )

  return {
    campagne: {
      id: `ANNUEL_${annee}`,
      libelle: `Palmarès annuel ${annee}`,
      statut: 'ANNUEL',
      ...POIDS_PAR_DEFAUT,
      nombreCampagnes: campagnes.length,
      ...PRIX_PAR_DEFAUT,
    },
    provisoire: false,
    toutesLesCampagnes,
    ...computeRankings(rawList),
  }
}

async function getFullClassementData(cible?: string) {
  const { campagnes, toutesLesCampagnes } = await listeCampagnes()

  if (cible?.startsWith('ANNUEL_')) {
    const annee = Number.parseInt(cible.slice('ANNUEL_'.length), 10)
    if (Number.isFinite(annee)) return palmaresAnnuel(annee, toutesLesCampagnes)
  }

  const choisie =
    campagnes.find((c) => c.id === cible) ?? campagnes.find((c) => c.statut === 'OUVERTE') ?? campagnes[0]

  if (!choisie) {
    return {
      campagne: null,
      provisoire: false,
      toutesLesCampagnes,
      laureats: { majorGlobal: null, majorsDirection: [], majorsDepartement: [], majorsService: [] },
      groupesDirection: [],
      groupesDepartement: [],
      groupesService: [],
      tousLesScores: [],
    }
  }

  const campagne = choisie

  // Campagne ouverte, ou close sans calcul enregistré : classement calculé à la volée, sans écriture.
  // Scores et agents classables sont chargés en parallèle.
  const chargerScores = async () => {
    if (campagne.statut !== 'OUVERTE') {
      const enregistres = await prisma.scoreFinal.findMany({ where: { campagneId: campagne.id } })
      if (enregistres.length > 0) return { provisoire: false, scores: enregistres }
    }
    return { provisoire: true, scores: await calculerScores(campagne.id, campagne) }
  }
  const [{ provisoire, scores }, utilisateurs] = await Promise.all([
    chargerScores(),
    prisma.utilisateur.findMany({
      where: { role: { in: [...ROLES_CLASSES] as Role[] } },
      select: { id: true, ...SELECT_UTILISATEUR },
    }),
  ])
  const parId = new Map(utilisateurs.map((u) => [u.id, u]))

  const rawList = scores
    .filter((s) => ROLES_CLASSES.has(parId.get(s.utilisateurId)?.role ?? ''))
    .map((s) => versAgent(s.utilisateurId, parId.get(s.utilisateurId)!, s, campagne))

  return {
    campagne: {
      id: campagne.id,
      libelle: campagne.libelle,
      statut: campagne.statut,
      poidsCollegues: campagne.poidsCollegues,
      poidsManager: campagne.poidsManager,
      poidsClient: campagne.poidsClient,
      prixGlobal: campagne.prixGlobal || PRIX_PAR_DEFAUT.prixGlobal,
      prixDirection: campagne.prixDirection || PRIX_PAR_DEFAUT.prixDirection,
      prixDepartement: campagne.prixDepartement || PRIX_PAR_DEFAUT.prixDepartement,
      prixService: campagne.prixService || PRIX_PAR_DEFAUT.prixService,
    },
    provisoire,
    toutesLesCampagnes,
    ...computeRankings(rawList),
  }
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const campagneId = request.nextUrl.searchParams.get('campagneId') || undefined
    return NextResponse.json(await getFullClassementData(campagneId), { headers: NO_STORE })
  } catch (error) {
    console.error('GET /api/admin/classement error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * POST /api/admin/classement — enregistre le classement d'une campagne.
 * Une campagne clôturée passe à CALCULEE ; une campagne ouverte garde son statut.
 */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const body = await request.json().catch(() => null)
    const campagneId = typeof body?.campagneId === 'string' ? body.campagneId : ''
    const campagne = campagneId ? await prisma.campagne.findUnique({ where: { id: campagneId } }) : null
    if (!campagne) {
      return NextResponse.json({ error: 'Campagne introuvable' }, { status: 404 })
    }

    await enregistrerScores(campagne.id)
    if (campagne.statut === 'CLOTUREE') {
      await prisma.campagne.update({ where: { id: campagne.id }, data: { statut: 'CALCULEE' } })
    }

    return NextResponse.json(
      { success: true, message: 'Classement recalculé et enregistré.', ...(await getFullClassementData(campagne.id)) },
      { headers: NO_STORE }
    )
  } catch (error) {
    console.error('POST /api/admin/classement error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
