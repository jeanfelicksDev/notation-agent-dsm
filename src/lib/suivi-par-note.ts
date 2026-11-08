/**
 * Suivi d'une campagne vu depuis chaque noté : qui doit le noter, et où en est chacun.
 * Règles pures, sans accès à la base (utilisables côté client).
 */

export const ETATS_NOTATION = ['EN_ATTENTE', 'BROUILLON', 'TERMINEE', 'INVALIDEE'] as const
export type EtatNotation = (typeof ETATS_NOTATION)[number]
export type FiltreEtat = 'TOUS' | EtatNotation
export type TriSuivi = 'NOM' | 'RESTANTS'

export type AffectationSuivi = { evaluateurId: string; evalueId: string; statut: string; invalidee?: boolean }
export type NotantSuivi = { evaluateurId: string; etat: EtatNotation; facultatif: boolean }
export type SuiviNote = {
  evalueId: string
  notants: NotantSuivi[]
  compte: Record<EtatNotation, number>
  /** Notants attendus qui n'ont pas encore soumis (hors invalidés et hors votes facultatifs). */
  restants: number
}

/** Une affectation invalidée est écartée, quel que soit son statut. */
export function etatAffectation(a: AffectationSuivi): EtatNotation {
  if (a.invalidee) return 'INVALIDEE'
  if (a.statut === 'TERMINEE' || a.statut === 'BROUILLON') return a.statut
  return 'EN_ATTENTE'
}

/**
 * Statut global d'un évaluateur, sur l'ensemble de ses affectations :
 * - INVALIDEE si l'une est invalidée (l'invalidation porte sur le notant) ;
 * - TERMINEE seulement si toutes sont soumises ;
 * - BROUILLON (en cours) s'il en a entamé ou soumis une partie, par exemple quand un noté
 *   lui a été affecté après sa soumission ;
 * - EN_ATTENTE sinon.
 */
export function statutEvaluateur(affectations: readonly AffectationSuivi[]): EtatNotation {
  if (affectations.some((a) => a.invalidee)) return 'INVALIDEE'
  if (affectations.length > 0 && affectations.every((a) => a.statut === 'TERMINEE')) return 'TERMINEE'
  if (affectations.some((a) => a.statut === 'TERMINEE' || a.statut === 'BROUILLON')) return 'BROUILLON'
  return 'EN_ATTENTE'
}

const estRestant =(n: NotantSuivi) => !n.facultatif && (n.etat === 'EN_ATTENTE' || n.etat === 'BROUILLON')

function bilan(evalueId: string, notants: NotantSuivi[]): SuiviNote {
  const compte = Object.fromEntries(ETATS_NOTATION.map((e) => [e, 0])) as Record<EtatNotation, number>
  for (const n of notants) compte[n.etat]++
  return { evalueId, notants, compte, restants: notants.filter(estRestant).length }
}

/**
 * Regroupe les affectations par noté, dans l'ordre où elles arrivent.
 * Un notant évalue tous ses notés d'un seul tenant (la soumission les verrouille ensemble) :
 * dès qu'il a commencé (un brouillon ou une soumission, hors affectation invalidée),
 * il apparaît « en cours » chez chacun de ses notés encore non commencés.
 */
export function suiviParNote(
  affectations: readonly AffectationSuivi[],
  estFacultatif: (evaluateurId: string) => boolean = () => false
): SuiviNote[] {
  const ontCommence = new Set(
    affectations.filter((a) => ['BROUILLON', 'TERMINEE'].includes(etatAffectation(a))).map((a) => a.evaluateurId)
  )
  const etatDe = (a: AffectationSuivi): EtatNotation => {
    const etat = etatAffectation(a)
    return etat === 'EN_ATTENTE' && ontCommence.has(a.evaluateurId) ? 'BROUILLON' : etat
  }
  const parNote = new Map<string, NotantSuivi[]>()
  for (const a of affectations) {
    const notant = { evaluateurId: a.evaluateurId, etat: etatDe(a), facultatif: estFacultatif(a.evaluateurId) }
    parNote.set(a.evalueId, [...(parNote.get(a.evalueId) ?? []), notant])
  }
  return [...parNote].map(([evalueId, notants]) => bilan(evalueId, notants))
}

/** Ne garde que les notés ayant au moins un notant dans l'état choisi, et pour chacun ces seuls notants. */
export function filtrerSuivi(suivis: readonly SuiviNote[], filtre: FiltreEtat): SuiviNote[] {
  if (filtre === 'TOUS') return [...suivis]
  return suivis
    .filter((s) => s.compte[filtre] > 0)
    .map((s) => ({ ...s, notants: s.notants.filter((n) => n.etat === filtre) }))
}

export function trierSuivi(suivis: readonly SuiviNote[], tri: TriSuivi, nomDe: (id: string) => string): SuiviNote[] {
  const parNom = (a: SuiviNote, b: SuiviNote) => nomDe(a.evalueId).localeCompare(nomDe(b.evalueId), 'fr')
  return [...suivis].sort(tri === 'RESTANTS' ? (a, b) => b.restants - a.restants || parNom(a, b) : parNom)
}
