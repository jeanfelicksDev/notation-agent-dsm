/**
 * Distinctions officielles d'une campagne, attribuées sur le classement général
 * (toutes entités confondues, agents classés uniquement) :
 * - Captain : 1er ;
 * - Chief officer : 2e ;
 * - 2nd officer : 3e.
 * Le premier de chaque département et de chaque service reste désigné, sans distinction officielle.
 * En cas d'ex æquo, c'est l'ordre du classement (total, part manager, part collègues) qui départage.
 */

export type Distinction = 'CAPTAIN' | 'CHIEF_OFFICER' | 'SECOND_OFFICER'

const ORDRE: readonly Distinction[] = ['CAPTAIN', 'CHIEF_OFFICER', 'SECOND_OFFICER']

export const LIBELLES_DISTINCTION: Record<Distinction, { titre: string; rang: string }> = {
  CAPTAIN: { titre: 'Captain', rang: '1er toutes entités confondues' },
  CHIEF_OFFICER: { titre: 'Chief officer', rang: '2e toutes entités confondues' },
  SECOND_OFFICER: { titre: '2nd officer', rang: '3e toutes entités confondues' },
}

/** Distinction d'un agent selon sa position (0 = premier) dans le classement général trié. */
export function distinctionSelonPosition(position: number): Distinction | null {
  return ORDRE[position] ?? null
}

export type Officiers<T> = { captain: T | null; chiefOfficer: T | null; secondOfficer: T | null }

/** Les trois officiers, d'après le classement général déjà trié. */
export function officiers<T>(classementGeneral: readonly T[]): Officiers<T> {
  return {
    captain: classementGeneral[0] ?? null,
    chiefOfficer: classementGeneral[1] ?? null,
    secondOfficer: classementGeneral[2] ?? null,
  }
}
