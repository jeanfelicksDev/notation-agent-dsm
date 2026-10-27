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
export const ROLES_A_PIN: readonly string[] = ['UTILISATEUR', 'MANAGER', 'CADRE']

/**
 * Cadre : notant facultatif. S'il le souhaite, il note avec les mêmes critères que les pairs,
 * mais il n'est jamais noté ni classé, et ses évaluations en attente ne sont pas relancées.
 */
export function estCadre(role: string | null | undefined): boolean {
  return role === 'CADRE'
}

/** Page d'accueil d'un utilisateur selon son rôle. */
export function destinationPourRole(role: string): string {
  if (role === 'ADMIN') return '/admin'
  if (role === 'EXTERNE') return '/qr'
  return '/evaluer'
}
