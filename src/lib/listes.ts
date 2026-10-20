/** Listes déroulantes des fiches agents (utilisables côté client et serveur). */

import { ROLES } from '@/lib/roles'

/** Listes libres : l'administrateur ajoute, renomme et supprime leurs valeurs. */
export const LISTES_LIBRES = {
  NATIONALITE: { titre: 'Nationalités', champ: 'nationalite' },
  SERVICE: { titre: 'Services', champ: 'service' },
  DEPARTEMENT: { titre: 'Départements', champ: 'departement' },
  DIRECTION: { titre: 'Directions', champ: 'direction' },
} as const

export type ListeLibre = keyof typeof LISTES_LIBRES
/** ROLE : les quatre rôles déterminent les accès ; seuls leurs libellés se renomment. */
export type NomListe = ListeLibre | 'ROLE'

export const TITRES_LISTES: Record<NomListe, string> = {
  ...Object.fromEntries(Object.entries(LISTES_LIBRES).map(([k, v]) => [k, v.titre])),
  ROLE: 'Rôles',
} as Record<NomListe, string>

export function estListeLibre(v: unknown): v is ListeLibre {
  return typeof v === 'string' && v in LISTES_LIBRES
}

export function estNomListe(v: unknown): v is NomListe {
  return v === 'ROLE' || estListeLibre(v)
}

export type ValeurListe = {
  id: string
  libelle: string
  code: string | null
  parDefaut: boolean
  /** Nombre de fiches agents qui portent cette valeur (ou ce rôle). */
  utilisations: number
}

export type Listes = Record<NomListe, ValeurListe[]>

export const LISTES_VIDES: Listes = { NATIONALITE: [], SERVICE: [], DEPARTEMENT: [], DIRECTION: [], ROLE: [] }

/** Libellé d'un rôle : celui choisi par l'administrateur, sinon le libellé d'origine. */
export function libelleRoleDepuis(listes: Listes, code: string) {
  return listes.ROLE.find((r) => r.code === code)?.libelle ?? ROLES.find((r) => r.valeur === code)?.libelle ?? code
}

/** Valeur proposée par défaut à la création d'un agent (ex. la direction marquée par défaut). */
export function valeurParDefaut(listes: Listes, liste: ListeLibre) {
  return listes[liste].find((v) => v.parDefaut)?.libelle ?? ''
}

export const memeLibelle = (a: string | null | undefined, b: string | null | undefined) =>
  (a ?? '').trim().toLocaleLowerCase('fr') === (b ?? '').trim().toLocaleLowerCase('fr')
