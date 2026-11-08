import { describe, expect, it } from 'vitest'
import {
  attribuerRangs,
  calculerScoresDepuis,
  type DonneesScores,
  type NoteClientScores,
  type NoteScores,
  type ScoreCalcule,
} from '@/lib/calcul-scores'
import { compteCommeManager } from '@/lib/criteres'
import type { AffectationBilan } from '@/lib/eligibilite'

const POIDS = { poidsManager: 55, poidsCollegues: 45, poidsClient: 25 }

// Exemple d'Awa (manuel, section 9)
const NOTES_MANAGER = [5, 5, 4, 4, 4, 4, 4, 4, 4] // 38 / 45 = 84,4 %
const NOTES_COLLEGUE = [5, 4, 4, 4, 4] // 21 / 25 = 84 %
const NOTES_CLIENT_INTERNE = [4, 4, 4, 4, 4] // 20 / 25 = 80 %
const NOTES_CLIENT_EXTERNE = [5, 5, 4, 4, 4] // 22 / 25 = 88 %

type Evaluation = { affectation: AffectationBilan; notes: NoteScores[] }
type OptionsEvaluation = {
  role?: string
  statut?: 'TERMINEE' | 'EN_ATTENTE' | 'BROUILLON'
  invalidee?: boolean
  clientInterne?: boolean
}

function evaluation(evaluateurId: string, evalueId: string, valeurs: number[], options: OptionsEvaluation = {}): Evaluation {
  return {
    affectation: {
      evaluateurId,
      evalueId,
      statut: options.statut ?? 'TERMINEE',
      invalidee: options.invalidee ?? false,
      clientInterne: options.clientInterne ?? false,
      roleEvaluateur: options.role ?? 'UTILISATEUR',
    },
    notes: valeurs.map((valeur) => ({ evaluateurId, evalueId, valeur, noteMaximale: 5 })),
  }
}

const manager = (id: string, evalueId: string, valeurs: number[], options: OptionsEvaluation = {}) =>
  evaluation(id, evalueId, valeurs, { ...options, role: 'MANAGER' })

const defaillant = (id: string, evalueId: string, options: OptionsEvaluation = {}) =>
  evaluation(id, evalueId, [], { ...options, statut: 'EN_ATTENTE' })

const clientExterne = (source: string, agentId: string, valeurs: number[]): NoteClientScores[] =>
  valeurs.map((valeur) => ({ agentId, source, valeur, noteMaximale: 5 }))

function calculer(seuilNotants: number | null, evaluations: Evaluation[], notesClients: NoteClientScores[] = []) {
  return calculerScoresDepuis({
    campagne: { ...POIDS, seuilNotants },
    affectations: evaluations.map((e) => e.affectation),
    notes: evaluations.flatMap((e) => e.notes),
    notesClients,
  })
}

function score(scores: ScoreCalcule[], id: string): ScoreCalcule {
  const trouve = scores.find((s) => s.utilisateurId === id)
  if (!trouve) throw new Error(`Aucun score pour ${id}`)
  return trouve
}

const awaComplete = [
  manager('M', 'AWA', NOTES_MANAGER),
  evaluation('C', 'AWA', NOTES_COLLEGUE),
  evaluation('I', 'AWA', NOTES_CLIENT_INTERNE),
]
const clientsAwa = clientExterne('Q', 'AWA', NOTES_CLIENT_EXTERNE)

describe('calculerScoresDepuis — notants défaillants (seuil de 3)', () => {
  it('Awa notée par tous : 84,84', () => {
    expect(score(calculer(3, awaComplete, clientsAwa), 'AWA')).toMatchObject({
      situation: 'COMPLET',
      nbNotants: 3,
      nbNotantsAttendus: 3,
      scoreCollegues: 82,
      scoreTotal: 84.84,
      rang: 1,
    })
  })

  it('Awa protégée : 3 notants ont soumis, un 4e collègue défaillant est ignoré', () => {
    const scores = calculer(3, [...awaComplete, defaillant('D', 'AWA')], clientsAwa)
    expect(score(scores, 'AWA')).toMatchObject({
      situation: 'PROTEGE',
      nbNotants: 3,
      nbNotantsAttendus: 4,
      scoreCollegues: 82,
      scoreTotal: 84.84,
    })
  })

  it("Awa exclue : le client interne n'a pas soumis, 2 notants sous le seuil → non classée, score indicatif 85,24", () => {
    const scores = calculer(
      3,
      [manager('M', 'AWA', NOTES_MANAGER), evaluation('C', 'AWA', NOTES_COLLEGUE), defaillant('I', 'AWA')],
      clientsAwa
    )
    expect(score(scores, 'AWA')).toMatchObject({
      situation: 'SEUIL_NON_ATTEINT',
      nbNotants: 2,
      nbNotantsAttendus: 3,
      scoreCollegues: 84,
      scoreTotal: 85.24,
      rang: null,
    })
  })

  it('exclue même si ses 2 seuls notants ont soumis', () => {
    const scores = calculer(3, [manager('M', 'AWA', NOTES_MANAGER), evaluation('C', 'AWA', NOTES_COLLEGUE)])
    expect(score(scores, 'AWA')).toMatchObject({ situation: 'SEUIL_NON_ATTEINT', nbNotants: 2, nbNotantsAttendus: 2, rang: null })
  })

  it('un brouillon compte comme défaillant et ses notes sont ignorées', () => {
    const scores = calculer(
      3,
      [
        manager('M', 'AWA', NOTES_MANAGER),
        evaluation('C', 'AWA', NOTES_COLLEGUE),
        evaluation('I', 'AWA', [5, 5, 5, 5, 5], { statut: 'BROUILLON' }),
      ],
      clientsAwa
    )
    expect(score(scores, 'AWA')).toMatchObject({ situation: 'SEUIL_NON_ATTEINT', scoreTotal: 85.24, rang: null })
  })

  it("Awa notée par tous mais qui n'a pas soumis ses propres évaluations : exclue, les autres classés sans elle", () => {
    const scores = calculer(
      3,
      [
        ...awaComplete,
        manager('M', 'B', [3]),
        evaluation('C', 'B', [3]),
        evaluation('I', 'B', [3]),
        evaluation('AWA', 'B', [], { statut: 'BROUILLON' }),
      ],
      clientsAwa
    )
    expect(score(scores, 'AWA')).toMatchObject({ situation: 'NON_NOTANT', scoreTotal: 84.84, rang: null })
    // Le brouillon d'Awa compte comme défaillant chez B, qui reste protégé (3 notants)
    expect(score(scores, 'B')).toMatchObject({ situation: 'PROTEGE', rang: 1 })
  })

  it("un noté qui n'avait personne à noter n'est pas exclu pour autant", () => {
    expect(score(calculer(3, awaComplete, clientsAwa), 'AWA')).toMatchObject({ situation: 'COMPLET', rang: 1 })
  })

  it("un cadre qui n'a pas voté ne pénalise personne", () => {
    const scores = calculer(3, [...awaComplete, defaillant('K', 'AWA', { role: 'CADRE' })])
    expect(score(scores, 'AWA')).toMatchObject({ situation: 'COMPLET', nbNotantsAttendus: 3, scoreCollegues: 82 })
  })

  it('les clients externes (QR) ne comptent pas dans le seuil', () => {
    const scores = calculer(
      3,
      [manager('M', 'A', [4]), evaluation('C', 'A', [4]), defaillant('D', 'A')],
      [...clientExterne('Q1', 'A', [5]), ...clientExterne('Q2', 'A', [5]), ...clientExterne('Q3', 'A', [5])]
    )
    expect(score(scores, 'A')).toMatchObject({ situation: 'SEUIL_NON_ATTEINT', nbNotants: 2, rang: null })
  })

  it("sans aucune note de client externe, la part clients est annulée : Awa reste classée, sans pénalité → 83,34", () => {
    const clientMuet = evaluation('Q', 'AWA', [], { role: 'EXTERNE', statut: 'EN_ATTENTE' })
    const scores = calculer(3, [...awaComplete, clientMuet])
    expect(score(scores, 'AWA')).toMatchObject({
      situation: 'COMPLET',
      nbNotantsAttendus: 3,
      scoreClient: 0,
      scoreCollegues: 82,
      scoreTotal: 83.34,
      rang: 1,
    })
  })

  it('sans note du manager : non classé, sans rang, et les autres sont classés sans lui', () => {
    const scores = calculer(3, [
      defaillant('M', 'A', { role: 'MANAGER' }),
      evaluation('C1', 'A', [5]),
      evaluation('C2', 'A', [5]),
      evaluation('C3', 'A', [5]),
      manager('M', 'B', [1]),
      evaluation('C1', 'B', [1]),
      evaluation('C2', 'B', [1]),
    ])
    expect(score(scores, 'A')).toMatchObject({ situation: 'SANS_MANAGER', rang: null, scoreTotal: 45, nbNotants: 3 })
    expect(score(scores, 'B')).toMatchObject({ situation: 'COMPLET', rang: 1, scoreTotal: 20 })
  })

  it('un manager désigné client interne ne compte pas comme manager', () => {
    const scores = calculer(3, [
      manager('M', 'A', [4], { clientInterne: true }),
      evaluation('C1', 'A', [4]),
      evaluation('C2', 'A', [4]),
    ])
    expect(score(scores, 'A')).toMatchObject({ situation: 'SANS_MANAGER', rang: null })
  })

  it('manager invalidé pour force majeure : Awa reste classée avec 3 notants, part manager neutralisée → 85,63', () => {
    const scores = calculer(
      3,
      [
        manager('M', 'AWA', [], { statut: 'EN_ATTENTE', invalidee: true }),
        ...awaComplete.slice(1),
        evaluation('C2', 'AWA', NOTES_COLLEGUE),
      ],
      clientsAwa
    )
    expect(score(scores, 'AWA')).toMatchObject({
      situation: 'COMPLET',
      managerNeutralise: true,
      scoreTotal: 85.63,
      rang: 1,
    })
  })

  it("manager invalidé : le notant empêché ne compte pas dans le seuil, 2 notants restants → exclue", () => {
    const scores = calculer(
      3,
      [manager('M', 'AWA', [], { statut: 'EN_ATTENTE', invalidee: true }), ...awaComplete.slice(1)],
      clientsAwa
    )
    expect(score(scores, 'AWA')).toMatchObject({ situation: 'SEUIL_NON_ATTEINT', managerNeutralise: true, scoreTotal: 85.33, rang: null })
  })

  it("deux managers, l'un invalidé, l'autre n'a pas soumis : non classé", () => {
    const scores = calculer(3, [
      manager('M1', 'A', [], { statut: 'EN_ATTENTE', invalidee: true }),
      defaillant('M2', 'A', { role: 'MANAGER' }),
      evaluation('C1', 'A', [5]),
      evaluation('C2', 'A', [5]),
      evaluation('C3', 'A', [5]),
    ])
    expect(score(scores, 'A')).toMatchObject({ situation: 'SANS_MANAGER', rang: null })
  })

  it('manager invalidé : le seuil se compte sur les notants restants', () => {
    const scores = calculer(3, [
      manager('M', 'A', [], { statut: 'EN_ATTENTE', invalidee: true }),
      evaluation('C', 'A', NOTES_COLLEGUE),
      defaillant('D', 'A'),
    ])
    expect(score(scores, 'A')).toMatchObject({
      situation: 'SEUIL_NON_ATTEINT',
      managerNeutralise: true,
      scoreCollegues: 84,
      scoreTotal: 84,
      rang: null,
    })
  })

  it('protégé : un bloc collègues vidé par des défaillants est neutralisé', () => {
    const evaluations = [
      manager('M1', 'A', [4, 4, 4, 4, 4]),
      manager('M2', 'A', [4, 4, 4, 4, 4]),
      manager('M3', 'A', [4, 4, 4, 4, 4]),
      defaillant('C1', 'A'),
      defaillant('C2', 'A'),
    ]
    expect(score(calculer(3, evaluations), 'A')).toMatchObject({
      situation: 'PROTEGE',
      colleguesNeutralise: true,
      scoreTotal: 80,
    })
    // Sous le seuil : exclu du classement, score indicatif calculé sans les défaillants
    expect(score(calculer(4, evaluations), 'A')).toMatchObject({
      situation: 'SEUIL_NON_ATTEINT',
      colleguesNeutralise: true,
      scoreTotal: 80,
      rang: null,
    })
  })

  it('ex æquo : même rang, le suivant saute un rang', () => {
    const scores = calculer(3, [
      manager('M', 'A', [4]),
      evaluation('P', 'A', [4]),
      evaluation('Q', 'A', [4]),
      manager('M', 'B', [4]),
      evaluation('P', 'B', [4]),
      evaluation('Q', 'B', [4]),
      manager('M', 'X', [3]),
      evaluation('P', 'X', [3]),
      evaluation('Q', 'X', [3]),
    ])
    expect([score(scores, 'A').rang, score(scores, 'B').rang, score(scores, 'X').rang]).toEqual([1, 1, 3])
  })

  it("fait apparaître en non classé un noté que personne n'a noté", () => {
    expect(calculer(3, [defaillant('M', 'Z', { role: 'MANAGER' })])).toEqual([
      expect.objectContaining({ utilisateurId: 'Z', situation: 'SANS_MANAGER', rang: null, nbNotants: 0, nbNotantsAttendus: 1 }),
    ])
  })
})

describe('calculerScoresDepuis — règle historique (seuil null)', () => {
  it("un manager qui n'a pas soumis compte 0 sur sa part : Awa a 38,4", () => {
    const scores = calculer(null, [defaillant('M', 'AWA', { role: 'MANAGER' }), ...awaComplete.slice(1)], clientsAwa)
    expect(score(scores, 'AWA')).toMatchObject({ situation: null, scoreTotal: 38.4, managerNeutralise: false, rang: 1 })
  })

  it("un noté sans aucune note n'apparaît pas", () => {
    expect(calculer(null, [defaillant('M', 'Z', { role: 'MANAGER' })])).toEqual([])
  })

  it("donne exactement le résultat de l'ancien calcul (300 campagnes aléatoires)", () => {
    for (let graine = 1; graine <= 300; graine++) {
      const donnees = campagneAleatoire(graine)
      const nouveau = calculerScoresDepuis(donnees)
      expect(nouveau.every((s) => s.situation === null)).toBe(true)
      expect(parId(nouveau.map(champsHistoriques))).toEqual(parId(ancienCalcul(donnees)))
    }
  })
})

// ---------------------------------------------------------------------------
// Référence de non-régression : l'algorithme tel qu'il était avant la règle des
// notants défaillants (src/lib/scores.ts, commit 91f4194), réécrit sur données en mémoire.

type Champs = Pick<
  ScoreCalcule,
  'utilisateurId' | 'scoreCollegues' | 'scoreManager' | 'scoreClient' | 'scoreTotal' | 'managerNeutralise' | 'colleguesNeutralise'
> & { rang: number | null }

const champsHistoriques = (s: ScoreCalcule): Champs => ({
  utilisateurId: s.utilisateurId,
  scoreCollegues: s.scoreCollegues,
  scoreManager: s.scoreManager,
  scoreClient: s.scoreClient,
  scoreTotal: s.scoreTotal,
  managerNeutralise: s.managerNeutralise,
  colleguesNeutralise: s.colleguesNeutralise,
  rang: s.rang,
})

const parId = (liste: Champs[]) => [...liste].sort((a, b) => a.utilisateurId.localeCompare(b.utilisateurId))

function ancienCalcul({ campagne, affectations, notes, notesClients }: DonneesScores): Champs[] {
  type Groupes = Map<string, Map<string, { val: number; max: number }>>
  const arrondi = (n: number) => Math.round(n * 100) / 100
  const moyenne = (groupes: Map<string, { val: number; max: number }>) => {
    const ratios = [...groupes.values()].filter((g) => g.max > 0).map((g) => g.val / g.max)
    return ratios.length ? (ratios.reduce((a, b) => a + b, 0) / ratios.length) * 100 : null
  }
  const cumuler = (map: Groupes, agent: string, source: string, val: number, max: number) => {
    const parSource = map.get(agent) ?? new Map()
    const g = parSource.get(source) ?? { val: 0, max: 0 }
    g.val += val
    g.max += max
    parSource.set(source, g)
    map.set(agent, parSource)
  }

  const soumises = new Map(
    affectations.filter((a) => a.statut === 'TERMINEE' && !a.invalidee).map((a) => [`${a.evaluateurId}:${a.evalueId}`, a])
  )
  const manager: Groupes = new Map()
  const collegues: Groupes = new Map()
  const clients: Groupes = new Map()
  for (const n of notes) {
    const a = soumises.get(`${n.evaluateurId}:${n.evalueId}`)
    if (!a) continue
    cumuler(compteCommeManager(a.roleEvaluateur, a.clientInterne) ? manager : collegues, n.evalueId, n.evaluateurId, n.valeur, n.noteMaximale || 5)
  }
  for (const nc of notesClients) cumuler(clients, nc.agentId, nc.source, nc.valeur, nc.noteMaximale || 5)

  const managerInvalide = new Set<string>()
  const collegueInvalide = new Set<string>()
  for (const a of affectations.filter((x) => x.invalidee)) {
    ;(compteCommeManager(a.roleEvaluateur, a.clientInterne) ? managerInvalide : collegueInvalide).add(a.evalueId)
  }

  const agents = new Set([...manager.keys(), ...collegues.keys(), ...clients.keys()])
  const poidsClient = Math.min(campagne.poidsClient, campagne.poidsCollegues)
  const poidsTotal = campagne.poidsManager + campagne.poidsCollegues

  const resultats: Champs[] = [...agents].map((id) => {
    const m = manager.has(id) ? moyenne(manager.get(id)!) : null
    const c = collegues.has(id) ? moyenne(collegues.get(id)!) : null
    const q = clients.has(id) ? moyenne(clients.get(id)!) : null
    let partNonManager = 0
    if (c !== null && q !== null && campagne.poidsCollegues > 0) {
      partNonManager = (c * (campagne.poidsCollegues - poidsClient) + q * poidsClient) / campagne.poidsCollegues
    } else {
      partNonManager = c ?? q ?? 0
    }
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

/** Générateur pseudo-aléatoire reproductible (mulberry32). */
function aleatoire(graine: number) {
  let t = graine >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function campagneAleatoire(graine: number): DonneesScores {
  const hasard = aleatoire(graine)
  const entier = (min: number, max: number) => min + Math.floor(hasard() * (max - min + 1))
  const roles = ['MANAGER', 'MANAGER', 'CADRE', 'EXTERNE']
  const personnes = Array.from({ length: 8 }, (_, i) => ({ id: `P${i}`, role: roles[i] ?? 'UTILISATEUR' }))
  const statuts = ['TERMINEE', 'TERMINEE', 'EN_ATTENTE', 'BROUILLON'] as const

  const affectations: AffectationBilan[] = []
  const notes: NoteScores[] = []
  for (const evaluateur of personnes) {
    for (const evalue of personnes) {
      if (evaluateur === evalue || hasard() < 0.6) continue
      const statut = statuts[entier(0, statuts.length - 1)]
      affectations.push({
        evaluateurId: evaluateur.id,
        evalueId: evalue.id,
        statut,
        invalidee: hasard() < 0.1,
        clientInterne: hasard() < 0.15,
        roleEvaluateur: evaluateur.role,
      })
      if (statut === 'EN_ATTENTE') continue
      const nbCriteres = entier(1, 4)
      for (let k = 0; k < nbCriteres; k++) {
        notes.push({ evaluateurId: evaluateur.id, evalueId: evalue.id, valeur: entier(1, 5), noteMaximale: hasard() < 0.2 ? 0 : 5 })
      }
    }
  }

  const notesClients: NoteClientScores[] = []
  for (const agent of personnes) {
    const nbClients = entier(0, 2)
    for (let c = 0; c < nbClients; c++) {
      for (let k = 0; k < 3; k++) notesClients.push({ agentId: agent.id, source: `Q${c}`, valeur: entier(1, 5), noteMaximale: 5 })
    }
  }

  const poidsManager = entier(0, 100)
  return {
    campagne: { poidsManager, poidsCollegues: 100 - poidsManager, poidsClient: entier(0, 40), seuilNotants: null },
    affectations,
    notes,
    notesClients,
  }
}
