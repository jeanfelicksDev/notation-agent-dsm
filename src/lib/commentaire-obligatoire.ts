/**
 * Règle de justification des notes basses : toute note inférieure ou égale au seuil doit être
 * accompagnée d'un commentaire. Partagée par l'écran de notation et la soumission définitive ;
 * les évaluations déjà soumises n'y sont pas soumises (elles restent verrouillées en l'état).
 */
export const SEUIL_COMMENTAIRE_OBLIGATOIRE = 2

/** Une note posée (> 0) au plus égale au seuil exige un commentaire. */
export function commentaireObligatoire(valeur: number): boolean {
  return valeur > 0 && valeur <= SEUIL_COMMENTAIRE_OBLIGATOIRE
}

/** Vrai si la note n'exige pas de commentaire ou en porte un qui n'est pas vide. */
export function noteJustifiee(valeur: number, commentaire: string | null | undefined): boolean {
  return !commentaireObligatoire(valeur) || !!commentaire?.trim()
}
