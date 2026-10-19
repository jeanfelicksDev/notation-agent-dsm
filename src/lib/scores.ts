import prisma from '@/lib/prisma'
import { estEvaluateurManager } from '@/lib/criteres'

/**
 * Calcul des scores d'une campagne.
 *
 * Règles :
 * - seules les évaluations SOUMISES (affectation TERMINEE) comptent ; les brouillons sont ignorés ;
 * - chaque évaluateur pèse autant que les autres : on moyenne des ratios note/barème par évaluateur ;
 * - score = part manager (poidsManager) + part collègues/clients (poidsCollegues), sur 100 ;
 * - dans la part collègues/clients, les clients QR comptent pour poidsClient points quand
 *   collègues ET clients existent ; sinon la source présente prend toute la part ;
 * - une source absente compte pour 0 : un agent sans note manager plafonne à poidsCollegues.
 */

export type ScoreCalcule = {
  utilisateurId: string
  scoreCollegues: number
  scoreManager: number
  scoreClient: number
  scoreTotal: number
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

  const [terminees, notes, notesClients] = await Promise.all([
    prisma.affectation.findMany({
      where: { campagneId, statut: 'TERMINEE' },
      select: { evaluateurId: true, evalueId: true },
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

  const soumises = new Set(terminees.map((a) => `${a.evaluateurId}:${a.evalueId}`))
  const manager = new Map<string, Map<string, { val: number; max: number }>>()
  const collegues = new Map<string, Map<string, { val: number; max: number }>>()
  const clients = new Map<string, Map<string, { val: number; max: number }>>()

  for (const n of notes) {
    if (!soumises.has(`${n.evaluateurId}:${n.evalueId}`)) continue
    const cible = estEvaluateurManager(n.evaluateur.role) ? manager : collegues
    cumuler(cible, n.evalueId, n.evaluateurId, n.valeur, n.critere.noteMaximale || 5)
  }
  for (const nc of notesClients) {
    cumuler(clients, nc.agentId, nc.clientId || nc.ipHash || nc.id, nc.valeur, nc.critere.noteMaximale || 5)
  }

  const agents = new Set([...manager.keys(), ...collegues.keys(), ...clients.keys()])
  const poidsClient = Math.min(campagne.poidsClient, campagne.poidsCollegues)

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

    const total = ((m ?? 0) * campagne.poidsManager + partNonManager * campagne.poidsCollegues) / 100

    return {
      utilisateurId: id,
      scoreManager: arrondi(m ?? 0),
      scoreCollegues: arrondi(c ?? 0),
      scoreClient: arrondi(q ?? 0),
      scoreTotal: arrondi(total),
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
        update: { scoreCollegues: s.scoreCollegues, scoreManager: s.scoreManager, scoreClient: s.scoreClient, scoreTotal: s.scoreTotal, rang: s.rang },
        create: { ...s, campagneId },
      })
    ),
  ])
  return scores
}
