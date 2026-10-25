/** Rôles des comptes et leur présentation (utilisable côté client et serveur). */

export const ROLES = [
  { valeur: 'UTILISATEUR', libelle: 'Pair' },
  { valeur: 'MANAGER', libelle: 'Manager' },
  { valeur: 'ADMIN', libelle: 'Administrateur' },
  { valeur: 'EXTERNE', libelle: 'Client externe' },
  { valeur: 'CADRE', libelle: 'Cadre' },
] as const

export type RoleValeur = (typeof ROLES)[number]['valeur']

export function estRole(v: unknown): v is RoleValeur {
  return ROLES.some((r) => r.valeur === v)
}

export function libelleRole(role: string | null | undefined) {
  return ROLES.find((r) => r.valeur === role)?.libelle ?? 'Pair'
}

/** Comptes qui se connectent avec un PIN et notent depuis /evaluer. */
export const ROLES_A_PIN: readonly string[] = ['UTILISATEUR', 'MANAGER']

/** Personnel de l'annuaire qui ne participe pas aux campagnes : ni noté, ni notant, sans connexion. */
export function estHorsCampagne(role: string | null | undefined) {
  return role === 'CADRE'
}

export const MESSAGE_HORS_CAMPAGNE =
  "Votre compte ne participe pas à la campagne de notation : aucune connexion n'est nécessaire."

/** Page d'accueil d'un utilisateur selon son rôle. */
export function destinationPourRole(role: string): string {
  if (role === 'ADMIN') return '/admin'
  if (role === 'EXTERNE') return '/qr'
  return '/evaluer'
}
