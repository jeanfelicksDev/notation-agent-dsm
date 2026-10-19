import { redirect } from 'next/navigation'

/** Ancienne page des critères : ils se gèrent désormais dans l'onglet « Critères » de la campagne. */
export default async function CriteresRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/admin/campagnes/${id}?onglet=criteres`)
}
