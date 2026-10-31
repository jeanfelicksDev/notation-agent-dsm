import { compteCommeManager } from '@/lib/criteres'
import {
  BILAN_VIDE,
  bilansNotants,
  estClasse,
  situationDuNote,
  type AffectationBilan,
  type BilanNotants,
  type SituationScore,
} from '@/lib/eligibilite'

/**
 * Calcul des scores d'une campagne, sur des données déjà chargées (lecture en base : src/lib/scores.ts).
 *
 * Règles :
 * - seules les évaluations SOUMISES (affectation TERMINEE) comptent ; les brouillons sont ignorés ;
 * - chaque évaluateur pèse autant que les autres : on moyenne des ratios note/barème par évaluateur ;
 * - score = part manager (poidsManager) + part collègues/clients (poidsCollegues), sur 100 ;
 * - un manager désigné « client interne » de l'agent compte dans la part collègues/clients, pas manager ;
 * - dans la part collègues/clients, les clients QR comptent pour poidsClient points quand
 *   collègues ET clients existent ; sinon la source présente prend toute la part ;
 * - les notes d'une affectation invalidée (force majeure, accident, décès) sont ignorées, et si la part
 *   manager ou collègues/clients n'a plus aucune note pour cette raison, elle est neutralisée :
 *   le score est ramené sur 100 à partir de la part restante ;
 * - notants défaillants, quand la campagne a un seuilNotants (situations : src/lib/eligibilite.ts) :
 *   PENALISE → chaque défaillant compte 0 dans son bloc ; PROTEGE → les défaillants sont ignorés, et une
 *   part vidée par des défaillants est neutralisée comme pour la force majeure ; SANS_MANAGER → score
 *   indicatif, non classé (rang null) ;
 * - règle historique (seuilNotants null) : une source absente compte pour 0, un agent sans note manager
 *   plafonne à poidsCollegues.
 */

export type ScoreCalcule = {
  utilisateurId: string
  scoreCollegues: number
  scoreManager: number
  scoreClient: number
  scoreTotal: number
  managerNeutralise: boolean
  colleguesNeutralise: boolean
  /** null : campagne en règle historique */
  situation: SituationScore | null
  nbNotants: number
  nbNotantsAttendus: number
  /** null : non classé */
  rang: number | null
}

export type CampagneScores = {
  poidsManager: number
  poidsCollegues: number
  poidsClient: number
  seuilNotants: number | null
}
export type NoteScores = { evaluateurId: string; evalueId: string; valeur: number; noteMaximale: number }
/** source : client QR qui a noté (identifiant client, à défaut empreinte IP ou identifiant de la note) */
export type NoteClientScores = { agentId: string; source: string; valeur: number; noteMaximale: number }
export type DonneesScores = {
  campagne: CampagneScores
  affectations: AffectationBilan[]
  notes: NoteScores[]
  notesClients: NoteClientScores[]
}

type Groupes = Map<string, Map<string, { val: number; max: number }>>
type Blocs = { manager: Groupes; collegues: Groupes; clients: Groupes }

const arrondi = (n: number) => Math.round(n * 100) / 100

function moyenneDesRatios(blocs: Groupes, agent: string): number | null {
  const groupes = blocs.get(agent)
  if (!groupes) return null
  const ratios = [...groupes.values()].filter((g) => g.max > 0).map((g) => g.val / g.max)
  return ratios.length ? (ratios.reduce((a, b) => a + b, 0) / ratios.length) * 100 : null
}

function cumuler(map: Groupes, agent: string, source: string, val: number, max: number) {
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

/** Répartit les notes soumises entre les blocs manager, collègues / clients internes et clients QR. */
function regrouperNotes({ affectations, notes, notesClients }: DonneesScores): Blocs {
  // Paires soumises, avec leur bloc (décidé par le rôle du notant et sa qualité « client interne »)
  const enBlocManager = new Map(
    affectations
      .filter((a) => a.statut === 'TERMINEE' && !a.invalidee)
      .map((a) => [`${a.evaluateurId}:${a.evalueId}`, compteCommeManager(a.roleEvaluateur, a.clientInterne)])
  )
  const blocs: Blocs = { manager: new Map(), collegues: new Map(), clients: new Map() }
  for (const n of notes) {
    const manager = enBlocManager.get(`${n.evaluateurId}:${n.evalueId}`)
    if (manager === undefined) continue
    cumuler(manager ? blocs.manager : blocs.collegues, n.evalueId, n.evaluateurId, n.valeur, n.noteMaximale || 5)
  }
  for (const nc of notesClients) {
    cumuler(blocs.clients, nc.agentId, nc.source, nc.valeur, nc.noteMaximale || 5)
  }
  return blocs
}

function scoreDuNote(
  id: string,
  blocs: Blocs,
  bilan: BilanNotants,
  situation: SituationScore | null,
  campagne: CampagneScores
): ScoreCalcule {
  const m = moyenneDesRatios(blocs.manager, id)
  const c = moyenneDesRatios(blocs.collegues, id)
  const q = moyenneDesRatios(blocs.clients, id)

  const poidsClient = Math.min(campagne.poidsClient, campagne.poidsCollegues)
  const poidsTotal = campagne.poidsManager + campagne.poidsCollegues
  let partNonManager = 0
  if (c !== null && q !== null && campagne.poidsCollegues > 0) {
    partNonManager = (c * (campagne.poidsCollegues - poidsClient) + q * poidsClient) / campagne.poidsCollegues
  } else {
    partNonManager = c ?? q ?? 0
  }

  // Part sans aucune note valide à cause d'un notant invalidé, ou d'un notant défaillant chez un noté
  // protégé : neutralisée plutôt que comptée 0
  const ignores = situation === 'PROTEGE' ? bilan.defaillants : []
  const managerEcarte = bilan.managerInvalide || ignores.some((d) => d.manager)
  const colleguesEcartes = bilan.collegueInvalide || ignores.some((d) => !d.manager)
  const managerNeutralise = m === null && managerEcarte && campagne.poidsCollegues > 0
  const colleguesNeutralise = c === null && q === null && colleguesEcartes && campagne.poidsManager > 0

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
    situation,
    nbNotants: bilan.nbNotants,
    nbNotantsAttendus: bilan.nbAttendus,
    rang: null,
  }
}

export function calculerScoresDepuis(donnees: DonneesScores): ScoreCalcule[] {
  const { campagne } = donnees
  const blocs = regrouperNotes(donnees)
  const bilans = bilansNotants(donnees.affectations)

  const agents = new Set([...blocs.manager.keys(), ...blocs.collegues.keys(), ...blocs.clients.keys()])
  // Avec la règle des défaillants, un noté que personne n'a noté apparaît quand même (non classé)
  if (campagne.seuilNotants !== null) {
    for (const [id, bilan] of bilans) if (bilan.nbAttendus > 0) agents.add(id)
  }

  const resultats = [...agents].map((id) => {
    const bilan = bilans.get(id) ?? BILAN_VIDE
    const situation = situationDuNote(bilan, campagne.seuilNotants)
    // Pénalisé : chaque notant défaillant compte 0 dans son bloc (ratio nul, quel que soit le barème)
    if (situation === 'PENALISE') {
      for (const d of bilan.defaillants) cumuler(d.manager ? blocs.manager : blocs.collegues, id, d.evaluateurId, 0, 1)
    }
    return scoreDuNote(id, blocs, bilan, situation, campagne)
  })

  attribuerRangs(resultats.filter((s) => estClasse(s.situation)), (s, rang) => (s.rang = rang))
  return resultats
}
