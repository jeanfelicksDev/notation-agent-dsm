import type { Distinction } from '@/lib/distinctions'

/**
 * Séquence de révélation des résultats d'une campagne.
 * Un décompte de 5 à 0 ouvre la séquence, puis les niveaux s'enchaînent seuls :
 * chaque niveau apparaît lentement, carte après carte, et le suivant arrive 3 secondes plus tard.
 * Le Captain est gardé pour la fin : le suspense monte jusqu'au plus haut titre.
 */

export const DEBUT_DECOMPTE = 5

export const ORDRE_REVELATION: readonly Distinction[] = ['SECOND_OFFICER', 'CHIEF_OFFICER', 'CAPTAIN']

const UNE_SECONDE_MS = 1000

/** Pause entre la fin de l'apparition d'un niveau et la révélation du suivant. */
export const PAUSE_ENTRE_NIVEAUX_MS = 3000

/** Décalage entre deux cartes d'un même niveau : les noms apparaissent à une seconde d'intervalle. */
export const DELAI_ENTRE_CARTES_MS = 1000

/** Durée de l'effet d'apparition d'une carte : lent, il se prolonge pendant que la suivante commence. */
export const DUREE_APPARITION_CARTE_MS = 2000

export interface EtatRevelation {
  /** Nombre de niveaux déjà révélés, dans l'ordre de révélation. */
  niveauxReveles: number
  /** Chiffre affiché par le décompte en cours, ou null hors décompte. */
  decompte: number | null
}

export const ETAT_INITIAL: EtatRevelation = { niveauxReveles: 0, decompte: null }

export function estRevele(etat: EtatRevelation, niveau: Distinction): boolean {
  const position = ORDRE_REVELATION.indexOf(niveau)
  return position !== -1 && position < etat.niveauxReveles
}

export function revelationTerminee(etat: EtatRevelation): boolean {
  return etat.niveauxReveles >= ORDRE_REVELATION.length
}

/** Démarre le décompte d'ouverture ; sans effet une fois la séquence commencée. */
export function lancerDecompte(etat: EtatRevelation): EtatRevelation {
  if (etat.decompte !== null || etat.niveauxReveles > 0) return etat
  return { ...etat, decompte: DEBUT_DECOMPTE }
}

/**
 * Étape automatique suivante : le décompte descend jusqu'à 0 et révèle le premier niveau,
 * puis chaque appel révèle le niveau suivant. Sans effet avant le lancement et après le dernier niveau.
 */
export function avancer(etat: EtatRevelation): EtatRevelation {
  if (etat.decompte !== null) {
    return etat.decompte > 0 ? { ...etat, decompte: etat.decompte - 1 } : { niveauxReveles: 1, decompte: null }
  }
  if (etat.niveauxReveles === 0 || revelationTerminee(etat)) return etat
  return { ...etat, niveauxReveles: etat.niveauxReveles + 1 }
}

/** Temps nécessaire pour que toutes les cartes d'un niveau soient apparues. */
export function dureeApparition(nombreDeCartes: number): number {
  if (nombreDeCartes <= 0) return 0
  return (nombreDeCartes - 1) * DELAI_ENTRE_CARTES_MS + DUREE_APPARITION_CARTE_MS
}

/**
 * Délai avant l'étape automatique suivante, ou null quand rien n'est à venir
 * (séquence pas encore lancée, ou terminée).
 * `cartesDuDernierNiveau` : nombre de cartes du niveau qui vient d'être révélé.
 */
export function delaiAvantSuite(etat: EtatRevelation, cartesDuDernierNiveau: number): number | null {
  if (etat.decompte !== null) return UNE_SECONDE_MS
  if (etat.niveauxReveles === 0 || revelationTerminee(etat)) return null
  // Un niveau sans lauréat n'affiche rien : on enchaîne aussitôt, sans pause sur un écran figé.
  if (cartesDuDernierNiveau <= 0) return 0
  return dureeApparition(cartesDuDernierNiveau) + PAUSE_ENTRE_NIVEAUX_MS
}
