/**
 * Distinctions officielles d'une campagne : il y a un lauréat par entité.
 * - Captain : le meilleur agent de la direction (1 lauréat) ;
 * - Chief officer : le meilleur agent de chaque département ;
 * - 2nd officer : le meilleur agent de chaque service.
 * Les distinctions se cumulent : le Captain est aussi le Chief officer de son département
 * et le 2nd officer de son service.
 * En cas d'ex æquo, c'est l'ordre du classement (total, part manager, part collègues) qui départage.
 */

export type Distinction = 'CAPTAIN' | 'CHIEF_OFFICER' | 'SECOND_OFFICER'

export const LIBELLES_DISTINCTION: Record<Distinction, { titre: string; portee: string }> = {
  CAPTAIN: { titre: 'Captain', portee: 'Meilleur agent de la direction' },
  CHIEF_OFFICER: { titre: 'Chief officer', portee: 'Meilleur agent du département' },
  SECOND_OFFICER: { titre: '2nd officer', portee: 'Meilleur agent du service' },
}

/** Libellé complet d'une distinction, par exemple « Chief officer (meilleur agent du département) ». */
export function libelleComplet(distinction: Distinction): string {
  const { titre, portee } = LIBELLES_DISTINCTION[distinction]
  return `${titre} (${portee.charAt(0).toLowerCase()}${portee.slice(1)})`
}

/** Entités dont l'agent est le premier (agents classés uniquement). */
export interface PremieresPlaces {
  direction: boolean
  departement: boolean
  service: boolean
}

/** Distinctions d'un agent, de la plus haute à la plus locale. */
export function distinctionsDe(premier: PremieresPlaces): Distinction[] {
  const attributions: [boolean, Distinction][] = [
    [premier.direction, 'CAPTAIN'],
    [premier.departement, 'CHIEF_OFFICER'],
    [premier.service, 'SECOND_OFFICER'],
  ]
  return attributions.filter(([estPremier]) => estPremier).map(([, distinction]) => distinction)
}
