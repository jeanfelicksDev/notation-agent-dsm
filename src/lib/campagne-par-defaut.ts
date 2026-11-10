/**
 * Campagne affichée quand aucune n'est demandée explicitement :
 * la campagne ouverte, sinon la plus récente.
 * `campagnes` doit être triée de la plus récente à la plus ancienne.
 */
export function campagneParDefaut<T extends { statut: string }>(campagnes: readonly T[]): T | null {
  return campagnes.find((campagne) => campagne.statut === 'OUVERTE') ?? campagnes[0] ?? null
}
