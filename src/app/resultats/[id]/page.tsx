import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import CeremonieResultats from '@/components/resultats/CeremonieResultats'
import { requireAdmin } from '@/lib/auth'

export const metadata: Metadata = { title: 'Résultats de la campagne' }

/**
 * Page de révélation des résultats d'une campagne, pensée pour être projetée :
 * hors de la mise en page d'administration (pas de barre latérale), mais réservée aux administrateurs.
 */
export default async function ResultatsPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if (!admin) redirect('/?reason=admin_required')

  const { id } = await params
  // La clé repart d'une scène neuve (palmarès et révélation) quand on passe d'une campagne à une autre.
  return <CeremonieResultats key={id} campagneId={id} />
}
