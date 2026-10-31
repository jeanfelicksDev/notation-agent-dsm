import type { Prisma } from '@prisma/client'

/**
 * Retire un agent devenu non-éligible des campagnes ouvertes : ses affectations et ses notes, comme
 * notant et comme noté, ainsi que ses sessions. Les campagnes clôturées gardent leur historique.
 * Renvoie le nombre d'affectations retirées.
 */
export async function retirerDesCampagnesOuvertes(tx: Prisma.TransactionClient, utilisateurId: string): Promise<number> {
  const enCampagneOuverte = {
    campagne: { statut: 'OUVERTE' as const },
    OR: [{ evaluateurId: utilisateurId }, { evalueId: utilisateurId }],
  }
  await tx.note.deleteMany({ where: enCampagneOuverte })
  const { count } = await tx.affectation.deleteMany({ where: enCampagneOuverte })
  await tx.session.deleteMany({ where: { utilisateurId } })
  return count
}
