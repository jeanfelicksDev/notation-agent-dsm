import Sidebar from '@/components/Sidebar'
import { requireAdmin } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const admin = await requireAdmin()
  if (!admin) {
    redirect('/?reason=admin_required')
  }

  return (
    <div className="min-h-screen bg-canvas">
      <Sidebar admin={{ prenom: admin.prenom, nom: admin.nom }} />
      <div className="dsm-page-with-sidebar flex min-h-screen min-w-0 flex-col">{children}</div>
    </div>
  )
}
