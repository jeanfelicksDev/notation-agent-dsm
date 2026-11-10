import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { campagneParDefaut } from '@/lib/campagne-par-defaut'
import prisma from '@/lib/prisma'

export const metadata: Metadata = { title: 'Résultats de la campagne' }

/**
 * Adresse courte /resultats : renvoie vers la page des résultats de la campagne en cours
 * (la campagne ouverte, sinon la plus récente), sans avoir à connaître son identifiant.
 */
export default async function ResultatsCampagneEnCoursPage() {
  const admin = await requireAdmin()
  if (!admin) redirect('/?reason=admin_required')

  const campagnes = await prisma.campagne.findMany({
    select: { id: true, statut: true },
    orderBy: { dateDebut: 'desc' },
  })
  const campagne = campagneParDefaut(campagnes)
  if (campagne) redirect(`/resultats/${campagne.id}`)

  return (
    <main className="flex min-h-dvh items-center justify-center bg-navy-950 px-6 text-center text-lg text-navy-100">
      <p>Aucune campagne n’a encore été créée : il n’y a pas de résultats à afficher.</p>
    </main>
  )
}
