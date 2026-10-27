/**
 * Règles d'attribution des critères — partagées entre le serveur et l'interface.
 *
 * Un critère porte une liste de types d'évaluateurs (`typeEvaluateurs`). L'ancien champ
 * `typeEvaluateur` n'est lu qu'en repli pour les critères créés avant cette liste.
 * `TOUS` désigne tous les évaluateurs INTERNES (manager, collègues, clients internes) :
 * les clients externes (QR) ne notent que les critères explicitement marqués `CLIENT`.
 */

import type { TypeEval } from '@prisma/client'

export const TYPES_INTERNES = ['MANAGER', 'COLLEGUE', 'CLIENT_INTERNE'] as const

export type CritereTypable = {
  typeEvaluateur: string
  typeEvaluateurs?: string[] | null
}

export function typesDuCritere(c: CritereTypable): string[] {
  const brut = c.typeEvaluateurs && c.typeEvaluateurs.length > 0 ? c.typeEvaluateurs : [c.typeEvaluateur]
  return [...new Set(brut.flatMap((t) => (t === 'TOUS' ? [...TYPES_INTERNES] : [t])))]
}

/** Valeur à stocker pour un critère : la liste fait foi, l'ancien champ reçoit le premier type. */
export function normaliserTypes(input: unknown, legacy?: unknown): { typeEvaluateurs: TypeEval[]; typeEvaluateur: TypeEval } {
  const valides = new Set(['MANAGER', 'COLLEGUE', 'CLIENT', 'CLIENT_INTERNE', 'TOUS'])
  const liste = Array.isArray(input) ? input.filter((t): t is string => typeof t === 'string' && valides.has(t)) : []
  const source = liste.length > 0 ? liste : typeof legacy === 'string' && valides.has(legacy) ? [legacy] : ['COLLEGUE']
  const typeEvaluateurs = typesDuCritere({ typeEvaluateur: source[0], typeEvaluateurs: source }) as TypeEval[]
  return { typeEvaluateurs, typeEvaluateur: typeEvaluateurs[0] }
}

export function estClientExterne(c: CritereTypable) {
  return typesDuCritere(c).includes('CLIENT')
}

export function estEvaluateurManager(role: string | null | undefined) {
  return role === 'MANAGER' || role === 'ADMIN'
}

/**
 * Les notes d'une paire comptent dans le bloc Manager seulement si le notant est manager
 * et n'a pas été désigné « client interne » de l'agent ; sinon, bloc collègues / clients internes.
 */
export function compteCommeManager(role: string | null | undefined, clientInterne: boolean): boolean {
  return estEvaluateurManager(role) && !clientInterne
}

/**
 * Critères qu'un évaluateur interne doit noter pour un collaborateur donné
 * (un cadre, notant facultatif, suit exactement les règles des pairs) :
 * - notant désigné « client interne » lors de la répartition, manager compris → critères CLIENT_INTERNE ;
 * - manager → critères MANAGER ;
 * - collègue du même service → critères COLLEGUE ;
 * - agent d'un autre service → critères CLIENT_INTERNE.
 */
export function criteresPourPaire<C extends CritereTypable>(
  criteres: C[],
  evaluateur: { role: string; service: string | null },
  evalue: { service: string | null },
  clientInterne = false
): C[] {
  if (compteCommeManager(evaluateur.role, clientInterne)) {
    return criteres.filter((c) => typesDuCritere(c).includes('MANAGER'))
  }
  const type = clientInterne || evaluateur.service !== evalue.service ? 'CLIENT_INTERNE' : 'COLLEGUE'
  return criteres.filter((c) => typesDuCritere(c).includes(type))
}

export const LIBELLES_TYPES: Record<string, string> = {
  MANAGER: 'Manager',
  COLLEGUE: 'Collègues',
  CLIENT_INTERNE: 'Clients internes',
  CLIENT: 'Clients externes (QR)',
}
