/**
 * Notants défaillants — règles partagées entre le serveur et l'interface.
 *
 * Un notant « a noté » quand son évaluation est soumise (affectation TERMINEE) et non invalidée ;
 * un brouillon ne compte pas. Les clients externes (QR) ne comptent pas : seuls les notants affectés
 * (manager, collègues, clients internes). Un cadre, dont le vote est facultatif, compte s'il a soumis
 * mais n'est jamais un défaillant. À la clôture, un noté est :
 * - SANS_MANAGER (non classé) s'il n'a aucune note de son manager, sauf manager invalidé pour force majeure ;
 * - COMPLET si tous ses notants ont soumis ;
 * - PROTEGE si au moins `seuilNotants` notants ont soumis, manager compris : les défaillants sont ignorés ;
 * - PENALISE sinon : chaque notant défaillant compte 0 dans la moyenne de son bloc.
 * Une campagne dont le seuil est null suit la règle historique : aucune de ces situations ne s'applique.
 */

import type { SituationScore } from '@prisma/client'
import { compteCommeManager } from '@/lib/criteres'
import { estCadre } from '@/lib/roles'

export type { SituationScore }

export const SEUIL_NOTANTS_PAR_DEFAUT = 3
export const SEUIL_NOTANTS_MAX = 20

export type AffectationBilan = {
  evaluateurId: string
  evalueId: string
  statut: string
  invalidee: boolean
  clientInterne: boolean
  roleEvaluateur: string | null | undefined
}

export type BilanNotants = {
  /** Notants qui ont soumis, hors invalidés */
  nbNotants: number
  /** Notants affectés, hors invalidés */
  nbAttendus: number
  managerSoumis: boolean
  managerInvalide: boolean
  collegueInvalide: boolean
  /** Notants affectés, non invalidés, qui n'ont pas soumis */
  defaillants: { evaluateurId: string; manager: boolean }[]
}

export const BILAN_VIDE: BilanNotants = {
  nbNotants: 0,
  nbAttendus: 0,
  managerSoumis: false,
  managerInvalide: false,
  collegueInvalide: false,
  defaillants: [],
}

/** Bilan des notants de chaque noté, à partir des affectations de la campagne. */
export function bilansNotants(affectations: AffectationBilan[]): Map<string, BilanNotants> {
  const bilans = new Map<string, BilanNotants>()
  for (const a of affectations) {
    if (a.evaluateurId === a.evalueId) continue
    const b = bilans.get(a.evalueId) ?? BILAN_VIDE
    const manager = compteCommeManager(a.roleEvaluateur, a.clientInterne)

    let suivant = b
    if (a.invalidee) {
      suivant = manager ? { ...b, managerInvalide: true } : { ...b, collegueInvalide: true }
    } else if (a.roleEvaluateur === 'EXTERNE') {
      // Un client externe note par QR code : il ne compte pas dans le seuil
    } else if (a.statut === 'TERMINEE') {
      suivant = { ...b, nbNotants: b.nbNotants + 1, nbAttendus: b.nbAttendus + 1, managerSoumis: b.managerSoumis || manager }
    } else if (!estCadre(a.roleEvaluateur)) {
      // Un cadre vote s'il le souhaite : il compte s'il a soumis, jamais comme défaillant
      suivant = { ...b, nbAttendus: b.nbAttendus + 1, defaillants: [...b.defaillants, { evaluateurId: a.evaluateurId, manager }] }
    }
    bilans.set(a.evalueId, suivant)
  }
  return bilans
}

export function situationDuNote(bilan: BilanNotants, seuilNotants: number | null): SituationScore | null {
  if (seuilNotants === null) return null
  // L'invalidation d'un manager n'excuse pas un autre manager, valide, qui n'a pas soumis
  const managerExcuse = bilan.managerInvalide && !bilan.defaillants.some((d) => d.manager)
  if (!bilan.managerSoumis && !managerExcuse) return 'SANS_MANAGER'
  if (bilan.nbNotants >= bilan.nbAttendus) return 'COMPLET'
  return bilan.nbNotants >= seuilNotants ? 'PROTEGE' : 'PENALISE'
}

export type PrevisionNote = { evalueId: string; bilan: BilanNotants; situation: SituationScore }

/**
 * Situation de chaque noté si la campagne était clôturée maintenant, et managers en retard :
 * ceux dont la note manque à des notés qui, sans elle, ne seraient pas classés (avec le nombre de notés concernés).
 */
export function prevoirSituations(
  affectations: AffectationBilan[],
  seuilNotants: number,
  estNote: (id: string) => boolean
): { previsions: PrevisionNote[]; managersEnRetard: Map<string, number> } {
  const previsions = [...bilansNotants(affectations)]
    .filter(([id, b]) => estNote(id) && (b.nbAttendus > 0 || b.managerInvalide))
    .map(([evalueId, bilan]) => ({ evalueId, bilan, situation: situationDuNote(bilan, seuilNotants) ?? 'COMPLET' }))

  const managersEnRetard = new Map<string, number>()
  for (const p of previsions) {
    if (p.situation !== 'SANS_MANAGER') continue
    for (const d of p.bilan.defaillants.filter((x) => x.manager)) {
      managersEnRetard.set(d.evaluateurId, (managersEnRetard.get(d.evaluateurId) ?? 0) + 1)
    }
  }
  return { previsions, managersEnRetard }
}

/** Seul un noté sans note du manager est exclu du classement. */
export function estClasse(situation: SituationScore | null | undefined): boolean {
  return situation !== 'SANS_MANAGER'
}

export type BilanCloture = { complets: number; proteges: number; penalises: number; nonClasses: number }

export function compterSituations(scores: { situation: SituationScore | null }[]): BilanCloture {
  const compter = (situation: SituationScore) => scores.filter((s) => s.situation === situation).length
  return {
    complets: compter('COMPLET'),
    proteges: compter('PROTEGE'),
    penalises: compter('PENALISE'),
    nonClasses: compter('SANS_MANAGER'),
  }
}

/** Phrase de bilan affichée après une clôture ou un recalcul ; vide en règle historique. */
export function resumerBilanCloture(bilan: BilanCloture | null | undefined): string {
  if (!bilan) return ''
  const total = bilan.complets + bilan.proteges + bilan.penalises + bilan.nonClasses
  if (total === 0) return ''
  const n = (nombre: number, mot: string) => `${nombre} ${mot}${nombre > 1 ? 's' : ''}`
  return `${n(bilan.complets, 'complet')}, ${n(bilan.proteges, 'protégé')}, ${n(bilan.penalises, 'pénalisé')}, ${n(bilan.nonClasses, 'non classé')}.`
}

/**
 * Seuil saisi par l'administrateur : null (ou vide) pour la règle historique, sinon un entier
 * de 1 à SEUIL_NOTANTS_MAX. Renvoie undefined si la valeur est invalide.
 */
export function lireSeuilNotants(valeur: unknown): number | null | undefined {
  if (valeur === null || valeur === '') return null
  if (typeof valeur !== 'number' && typeof valeur !== 'string') return undefined
  const seuil = Number(valeur)
  return Number.isInteger(seuil) && seuil >= 1 && seuil <= SEUIL_NOTANTS_MAX ? seuil : undefined
}

export const LIBELLES_SITUATION: Record<SituationScore, { libelle: string; description: string }> = {
  COMPLET: {
    libelle: 'Complet',
    description: 'Tous ses notants ont soumis leur évaluation.',
  },
  PROTEGE: {
    libelle: 'Protégé',
    description: 'Seuil de notants atteint, manager compris : les notants défaillants sont ignorés.',
  },
  PENALISE: {
    libelle: 'Pénalisé',
    description: 'Seuil de notants non atteint : chaque notant défaillant compte 0.',
  },
  SANS_MANAGER: {
    libelle: 'Non classé',
    description: "Aucune note de son manager (non soumise, ou aucun manager affecté) : il n'est pas classé.",
  },
}
