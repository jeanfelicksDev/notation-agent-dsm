import prisma from '@/lib/prisma'
import { compteCommeManager } from '@/lib/criteres'

/**
 * Calcul des scores d'une campagne.
 *
 * Règles :
 * - seules les évaluations SOUMISES (affectation TERMINEE) comptent ; les brouillons sont ignorés ;
 * - chaque évaluateur pèse autant que les autres : on moyenne des ratios note/barème par évaluateur ;
 * - score = part manager (poidsManager) + part collègues/clients (poidsCollegues), sur 100 ;
 * - un manager désigné « client interne » de l'agent compte dans la part collègues/clients, pas manager ;
 * - dans la part collègues/clients, les clients QR comptent pour poidsClient points quand
 *   collègues ET clients existent ; sinon la source présente prend toute la part ;
 * - une source absente compte pour 0 : un agent sans note manager plafonne à poidsCollegues ;
 * - exception : les notes d'une affectation invalidée (force majeure, accident, décès) sont
 *   ignorées, et si la part manager ou collègues/clients n'a plus aucune note pour cette raison,
 *   elle est neutralisée : le score est ramené sur 100 à partir de la part restante.
 */

export type ScoreCalcule = {
  utilisateurId: string
  scoreCollegues: number
  scoreManager: number
  scoreClient: number
  scoreTotal: number
  managerNeutralise: boolean
  colleguesNeutralise: boolean
  rang: number
}

const arrondi = (n: number) => Math.round(n * 100) / 100

function moyenneDesRatios(groupes: Map<string, { val: number; max: number }>): number | null {
  const ratios = [...groupes.values()].filter((g) => g.max > 0).map((g) => g.val / g.max)
  return ratios.length ? (ratios.reduce((a, b) => a + b, 0) / ratios.length) * 100 : null
}

function cumuler(map: Map<string, Map<string, { val: number; max: number }>>, agent: string, source: string, val: number, max: number) {
  const parSource = map.get(agent) ?? new Map()
  const g = parSource.get(source) ?? { val: 0, max: 0 }
  g.val += val
  g.max += max
  parSource.set(source, g)
  map.set(agent, parSource)
}

/** Ordre du classement : total, puis part manager, puis part collègues. */
export function comparerScores(
  a: { scoreTotal: number; scoreManager: number; scoreCollegues: number },
  b: { scoreTotal: number; scoreManager: number; scoreCollegues: number }
) {
  return b.scoreTotal - a.scoreTotal || b.scoreManager - a.scoreManager || b.scoreCollegues - a.scoreCollegues
}

/** Attribue des rangs « sportifs » : deux scores identiques partagent le rang (1, 1, 3…). */
export function attribuerRangs<T extends { scoreTotal: number; scoreManager: number; scoreCollegues: number }>(
  liste: T[],
  appliquer: (item: T, rang: number) => void
) {
  const triee = [...liste].sort(comparerScores)
  let rangPrecedent = 0
  triee.forEach((item, i) => {
    const exAequo = i > 0 && comparerScores(triee[i - 1], item) === 0
    const rang = exAequo ? rangPrecedent : i + 1
    rangPrecedent = rang
    appliquer(item, rang)
  })
  return triee
}

export async function calculerScores(campagneId: string): Promise<ScoreCalcule[]> {
  const campagne = await prisma.campagne.findUnique({
    where: { id: campagneId },
    select: { id: true, poidsCollegues: true, poidsManager: true, poidsClient: true },
  })
  if (!campagne) return []

  const [terminees, invalidees, notes, notesClients] = await Promise.all([
    prisma.affectation.findMany({
      where: { campagneId, statut: 'TERMINEE', invalidee: false },
      select: { evaluateurId: true, evalueId: true, clientInterne: true },
    }),
    prisma.affectation.findMany({
      where: { campagneId, invalidee: true },
      select: { evalueId: true, clientInterne: true, evaluateur: { select: { role: true } } },
    }),
    prisma.note.findMany({
      where: { campagneId },
      select: {
        evaluateurId: true, evalueId: true, valeur: true,
        critere: { select: { noteMaximale: true } },
        evaluateur: { select: { role: true } },
      },
    }),
    prisma.noteClient.findMany({
      where: { campagneId },
      select: { agentId: true, clientId: true, ipHash: true, id: true, valeur: true, critere: { select: { noteMaximale: true } } },
    }),
  ])

  // Paires soumises, avec leur qualité « client interne » (qui décide du bloc où comptent les notes)
  const soumises = new Map(terminees.map((a) => [`${a.evaluateurId}:${a.evalueId}`, a.clientInterne]))
  const manager = new Map<string, Map<string, { val: number; max: number }>>()
  const collegues = new Map<string, Map<string, { val: number; max: number }>>()
  const clients = new Map<string, Map<string, { val: number; max: number }>>()

  for (const n of notes) {
    const clientInterne = soumises.get(`${n.evaluateurId}:${n.evalueId}`)
    if (clientInterne === undefined) continue
    const cible = compteCommeManager(n.evaluateur.role, clientInterne) ? manager : collegues
    cumuler(cible, n.evalueId, n.evaluateurId, n.valeur, n.critere.noteMaximale || 5)
  }
  for (const nc of notesClients) {
    cumuler(clients, nc.agentId, nc.clientId || nc.ipHash || nc.id, nc.valeur, nc.critere.noteMaximale || 5)
  }

  // Sources dont au moins un notant a été invalidé, par collaborateur noté
  const managerInvalide = new Set<string>()
  const collegueInvalide = new Set<string>()
  for (const a of invalidees) {
    ;(compteCommeManager(a.evaluateur.role, a.clientInterne) ? managerInvalide : collegueInvalide).add(a.evalueId)
  }

  const agents = new Set([...manager.keys(), ...collegues.keys(), ...clients.keys()])
  const poidsClient = Math.min(campagne.poidsClient, campagne.poidsCollegues)
  const poidsTotal = campagne.poidsManager + campagne.poidsCollegues

  const resultats: ScoreCalcule[] = [...agents].map((id) => {
    const m = manager.has(id) ? moyenneDesRatios(manager.get(id)!) : null
    const c = collegues.has(id) ? moyenneDesRatios(collegues.get(id)!) : null
    const q = clients.has(id) ? moyenneDesRatios(clients.get(id)!) : null

    let partNonManager = 0
    if (c !== null && q !== null && campagne.poidsCollegues > 0) {
      partNonManager = (c * (campagne.poidsCollegues - poidsClient) + q * poidsClient) / campagne.poidsCollegues
    } else {
      partNonManager = c ?? q ?? 0
    }

    // Part sans aucune note valide à cause d'un notant invalidé : neutralisée plutôt que comptée 0
    const managerNeutralise = m === null && managerInvalide.has(id) && campagne.poidsCollegues > 0
    const colleguesNeutralise = c === null && q === null && collegueInvalide.has(id) && campagne.poidsManager > 0

    let total = ((m ?? 0) * campagne.poidsManager + partNonManager * campagne.poidsCollegues) / 100
    if (managerNeutralise) total = (partNonManager * poidsTotal) / 100
    else if (colleguesNeutralise) total = ((m ?? 0) * poidsTotal) / 100

    return {
      utilisateurId: id,
      scoreManager: arrondi(m ?? 0),
      scoreCollegues: arrondi(c ?? 0),
      scoreClient: arrondi(q ?? 0),
      scoreTotal: arrondi(total),
      managerNeutralise,
      colleguesNeutralise,
      rang: 0,
    }
  })

  attribuerRangs(resultats, (s, rang) => (s.rang = rang))
  return resultats
}

/** Calcule et enregistre les scores ; supprime ceux des agents qui n'ont plus aucune note. */
export async function enregistrerScores(campagneId: string) {
  const scores = await calculerScores(campagneId)
  await prisma.$transaction([
    prisma.scoreFinal.deleteMany({
      where: { campagneId, utilisateurId: { notIn: scores.map((s) => s.utilisateurId) } },
    }),
    ...scores.map((s) =>
      prisma.scoreFinal.upsert({
        where: { utilisateurId_campagneId: { utilisateurId: s.utilisateurId, campagneId } },
        update: {
          scoreCollegues: s.scoreCollegues, scoreManager: s.scoreManager, scoreClient: s.scoreClient, scoreTotal: s.scoreTotal,
          managerNeutralise: s.managerNeutralise, colleguesNeutralise: s.colleguesNeutralise, rang: s.rang,
        },
        create: { ...s, campagneId },
      })
    ),
  ])
  return scores
}
