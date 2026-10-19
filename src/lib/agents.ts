/** Valeurs de référence des fiches agents (utilisables côté client et serveur). */

export const SEXES = [
  { valeur: 'M', libelle: 'Masculin' },
  { valeur: 'F', libelle: 'Féminin' },
] as const

/** Ramène les saisies courantes (M, H, Homme, Masculin, F, Femme, Féminin…) à « M » ou « F ». */
export function normaliserSexe(saisie: string | null | undefined): 'M' | 'F' | null {
  const s = (saisie ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase()
  if (!s) return null
  if (['M', 'H', 'HOMME', 'MASCULIN', 'MASC', 'MALE'].includes(s)) return 'M'
  if (['F', 'FEMME', 'FEMININ', 'FEM', 'FEMALE'].includes(s)) return 'F'
  return null
}

export function libelleSexe(sexe: string | null | undefined) {
  return SEXES.find((s) => s.valeur === sexe)?.libelle ?? null
}
