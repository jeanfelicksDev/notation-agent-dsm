/**
 * Périmètre d'un client externe — règles pures, utilisables côté client et serveur.
 *
 * L'administration peut affecter à un client les agents qu'il doit évaluer (onglet Répartition,
 * disposition « Clients externes ») :
 * - des agents lui sont affectés → il évalue exactement ceux-là : l'affectation vaut autorisation,
 *   que la notation QR de l'agent soit activée ou non ;
 * - aucune affectation → il peut évaluer tous les agents dont la notation QR est activée.
 */
import type { Prisma } from '@prisma/client'
import { emailEstReel, type CoordonneesClient } from '@/lib/identifiant-client'

export const ROLES_EVALUABLES_PAR_CLIENT = ['UTILISATEUR', 'MANAGER'] as const

/** Filtre Prisma des agents qu'un client peut évaluer, selon les agents qui lui sont affectés. */
export function filtreAgentsEvaluables(agentsAffectes: readonly string[]): Prisma.UtilisateurWhereInput {
  const role = { in: [...ROLES_EVALUABLES_PAR_CLIENT] }
  return agentsAffectes.length > 0 ? { role, id: { in: [...agentsAffectes] } } : { role, qrcodeActif: true }
}

/** Coordonnée à afficher pour reconnaître un client : son téléphone, sinon son vrai e-mail. */
export function coordonneeClient({ telephone, email }: Partial<CoordonneesClient>): string | null {
  const tel = telephone?.trim()
  if (tel) return tel
  return emailEstReel(email) ? email : null
}
