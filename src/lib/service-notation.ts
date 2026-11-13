/**
 * Service de notation d'un agent — partagé entre le serveur et l'interface.
 *
 * Certains services sont regroupés pour la seule notation afin que leurs agents aient davantage
 * de notants : leurs Pairs se notent entre eux en collègues et partagent leurs managers.
 * Le classement, lui, garde les services d'origine (voir api/admin/classement) : il ne passe
 * jamais par cette fonction.
 */

const MAGASIN_MATERIEL = 'Magasin-Matériel'

/** Service d'origine (sans accents ni casse) → service de notation */
const REGROUPEMENTS: Record<string, string> = {
  magasin: MAGASIN_MATERIEL,
  materiel: MAGASIN_MATERIEL,
}

const cle = (service: string) =>
  service.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Service retenu pour la notation (chaîne vide si l'agent n'a pas de service). */
export function serviceDeNotation(service: string | null | undefined): string {
  const s = service?.trim() ?? ''
  return REGROUPEMENTS[cle(s)] ?? s
}

/** Deux agents relèvent-ils du même service pour la notation (deux agents sans service aussi) ? */
export function memeServiceDeNotation(a: string | null | undefined, b: string | null | undefined): boolean {
  return serviceDeNotation(a) === serviceDeNotation(b)
}
