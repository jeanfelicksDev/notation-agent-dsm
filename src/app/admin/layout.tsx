import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { requireAdmin } from '@/lib/auth'

/**
 * Vérification admin et menu, isolés dans un Suspense : un layout qui lit la session
 * bloquerait chaque navigation jusqu'à la réponse de la base. Chaque page et chaque API
 * admin revérifient l'accès de leur côté.
 */
async function NavigationAdmin() {
  const admin = await requireAdmin()
  if (!admin) redirect('/?reason=admin_required')
  return <Sidebar admin={{ prenom: admin.prenom, nom: admin.nom }} />
}

/** Même emprise que le menu, pour que la page ne bouge pas quand il arrive. */
function NavigationSquelette() {
  return (
    <>
      <div aria-hidden className="sticky top-0 z-40 h-14 bg-navy-900 lg:hidden print:hidden" />
      <div aria-hidden className="fixed inset-y-0 left-0 z-50 hidden w-[var(--sidebar-width)] bg-navy-900 lg:block print:hidden" />
    </>
  )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas">
      <Suspense fallback={<NavigationSquelette />}>
        <NavigationAdmin />
      </Suspense>
      <div className="dsm-page-with-sidebar flex min-h-screen min-w-0 flex-col">{children}</div>
    </div>
  )
}
