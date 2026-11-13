import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { campagneParDefaut } from '@/lib/campagne-par-defaut'
import prisma from '@/lib/prisma'

export const metadata: Metadata = { title: 'Résultats de la campagne' }

// Lue en base à chaque visite : la campagne en cours change d'une campagne à l'autre.
export const dynamic = 'force-dynamic'

/**
 * Adresse courte /resultats, ouverte à tous sans connexion : renvoie vers la page des résultats
 * de la campagne en cours (la campagne ouverte, sinon la plus récente), sans avoir à connaître
 * son identifiant. C'est cette page qui décide de ce qu'un visiteur peut voir.
 */
export default async function ResultatsCampagneEnCoursPage() {
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
