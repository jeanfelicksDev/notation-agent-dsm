import prisma from '@/lib/prisma'
import { trouverParIdentifiant } from '@/lib/identifiant'

/** Retrouve un client externe (rôle EXTERNE) par son téléphone ou son identifiant exact. */
export function trouverClientExterne(saisie: string) {
  return trouverParIdentifiant(saisie, { id: true, nom: true, prenom: true }, { role: 'EXTERNE' })
}

/**
 * Agents qu'un client peut évaluer pendant une campagne : ceux qui lui sont affectés s'il en a,
 * sinon tous les agents dont la notation QR est activée.
 */
export async function agentsEvaluablesPar(clientId: string, campagneId: string) {
  const affectations = await prisma.affectation.findMany({
    where: { evaluateurId: clientId, campagneId },
    select: { evalueId: true },
  })

  return prisma.utilisateur.findMany({
    where: {
      qrcodeActif: true,
      role: { in: ['UTILISATEUR', 'MANAGER'] },
      ...(affectations.length > 0 ? { id: { in: affectations.map((a) => a.evalueId) } } : {}),
    },
    select: { id: true, nom: true, prenom: true, service: true, emploi: true },
    orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
  })
}
