/**
 * Notants défaillants — règles partagées entre le serveur et l'interface.
 *
 * Un notant « a noté » quand son évaluation est soumise (affectation TERMINEE) et non invalidée ;
 * un brouillon ne compte pas. Les clients externes (QR) ne comptent pas : seuls les notants affectés
 * (manager, collègues, clients internes). Un cadre, dont le vote est facultatif, compte s'il a soumis
 * mais n'est jamais un défaillant. À la clôture, un noté est, dans cet ordre :
 * - NON_NOTANT (non classé) s'il n'a pas soumis ses propres évaluations ; un noté qui n'avait
 *   personne à noter n'est pas concerné ;
 * - SANS_MANAGER (non classé) s'il n'a aucune note de son manager, sauf manager invalidé pour force majeure ;
 * - SEUIL_NON_ATTEINT (non classé) si moins de `seuilNotants` notants ont soumis, manager compris,
 *   même quand tous ses notants ont soumis ; un notant invalidé ne compte pas ;
 * - COMPLET si tous ses notants ont soumis ;
 * - PROTEGE sinon : seuil atteint, les défaillants sont ignorés.
 * Un non-classé garde un score indicatif, calculé sans ses notants défaillants.
 * PENALISE (chaque défaillant comptait 0, mais restait classé) n'est plus attribué : il ne subsiste
 * que dans les scores enregistrés avant la migration 0011.
 * Les clients externes ne pèsent jamais sur la situation : sans leurs notes, la part clients est annulée.
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

/**
 * Notants qui n'ont pas soumis toutes leurs évaluations (brouillon ou non commencée), hors évaluations
 * invalidées et auto-affectations. Les cadres (vote facultatif) et les clients externes n'y figurent jamais.
 */
export function notantsEnRetard(affectations: AffectationBilan[]): Set<string> {
  return new Set(
    affectations
      .filter(
        (a) =>
          a.statut !== 'TERMINEE' &&
          !a.invalidee &&
          a.evaluateurId !== a.evalueId &&
          a.roleEvaluateur !== 'EXTERNE' &&
          !estCadre(a.roleEvaluateur)
      )
      .map((a) => a.evaluateurId)
  )
}

/** `aNote` : le noté a soumis ses propres évaluations (ou n'avait personne à noter). */
export function situationDuNote(bilan: BilanNotants, seuilNotants: number | null, aNote = true): SituationScore | null {
  if (seuilNotants === null) return null
  if (!aNote) return 'NON_NOTANT'
  // L'invalidation d'un manager n'excuse pas un autre manager, valide, qui n'a pas soumis
  const managerExcuse = bilan.managerInvalide && !bilan.defaillants.some((d) => d.manager)
  if (!bilan.managerSoumis && !managerExcuse) return 'SANS_MANAGER'
  if (bilan.nbNotants < seuilNotants) return 'SEUIL_NON_ATTEINT'
  return bilan.nbNotants >= bilan.nbAttendus ? 'COMPLET' : 'PROTEGE'
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
  const enRetard = notantsEnRetard(affectations)
  const previsions = [...bilansNotants(affectations)]
    .filter(([id, b]) => estNote(id) && (b.nbAttendus > 0 || b.managerInvalide))
    .map(([evalueId, bilan]) => ({
      evalueId,
      bilan,
      situation: situationDuNote(bilan, seuilNotants, !enRetard.has(evalueId)) ?? 'COMPLET',
    }))

  const managersEnRetard = new Map<string, number>()
  for (const p of previsions) {
    if (p.situation !== 'SANS_MANAGER') continue
    for (const d of p.bilan.defaillants.filter((x) => x.manager)) {
      managersEnRetard.set(d.evaluateurId, (managersEnRetard.get(d.evaluateurId) ?? 0) + 1)
    }
  }
  return { previsions, managersEnRetard }
}

/** Situations hors classement (non classés, score indicatif). */
export const SITUATIONS_NON_CLASSEES: readonly SituationScore[] = ['NON_NOTANT', 'SANS_MANAGER', 'SEUIL_NON_ATTEINT']

/**
 * Classés : complets et protégés, la règle historique (null), et les pénalisés enregistrés
 * sous l'ancienne règle, qui restaient classés.
 */
export function estClasse(situation: SituationScore | null | undefined): boolean {
  return !situation || !SITUATIONS_NON_CLASSEES.includes(situation)
}

export type BilanCloture = {
  complets: number
  proteges: number
  /** Ancienne règle uniquement */
  penalises: number
  nonNotants: number
  sousSeuil: number
  sansManager: number
}

export function compterSituations(scores: { situation: SituationScore | null }[]): BilanCloture {
  const compter = (situation: SituationScore) => scores.filter((s) => s.situation === situation).length
  return {
    complets: compter('COMPLET'),
    proteges: compter('PROTEGE'),
    penalises: compter('PENALISE'),
    nonNotants: compter('NON_NOTANT'),
    sousSeuil: compter('SEUIL_NON_ATTEINT'),
    sansManager: compter('SANS_MANAGER'),
  }
}

/** Phrase de bilan affichée après une clôture ou un recalcul ; vide en règle historique. */
export function resumerBilanCloture(bilan: BilanCloture | null | undefined): string {
  if (!bilan) return ''
  const n = (nombre: number, mot: string) => `${nombre} ${mot}${nombre > 1 ? 's' : ''}`
  const classes = bilan.complets + bilan.proteges + bilan.penalises
  const nonClasses = bilan.nonNotants + bilan.sousSeuil + bilan.sansManager
  if (classes + nonClasses === 0) return ''

  const detailClasses = [n(bilan.complets, 'complet'), n(bilan.proteges, 'protégé')]
  if (bilan.penalises > 0) detailClasses.push(n(bilan.penalises, 'pénalisé'))
  const phrase = `${n(classes, 'classé')} (${detailClasses.join(', ')}).`
  if (nonClasses === 0) return phrase

  const motifs = [
    bilan.nonNotants > 0 && `${bilan.nonNotants} ${bilan.nonNotants > 1 ? 'n’ont' : 'n’a'} pas noté`,
    bilan.sousSeuil > 0 && `${bilan.sousSeuil} sous le seuil de notants`,
    bilan.sansManager > 0 && `${bilan.sansManager} sans note du manager`,
  ].filter(Boolean)
  return `${phrase} ${n(nonClasses, 'non classé')} : ${motifs.join(', ')}.`
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
    description: 'Ancienne règle : seuil de notants non atteint, chaque notant défaillant comptait 0.',
  },
  SANS_MANAGER: {
    libelle: 'Sans manager',
    description: "Aucune note de son manager (non soumise, ou aucun manager affecté) : il n'est pas classé.",
  },
  NON_NOTANT: {
    libelle: 'N’a pas noté',
    description: "N'a pas soumis ses propres évaluations : il n'est pas classé.",
  },
  SEUIL_NON_ATTEINT: {
    libelle: 'Sous le seuil',
    description: "Trop peu de notants ont soumis leur évaluation, manager compris : il n'est pas classé.",
  },
}
